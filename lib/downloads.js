import { promises as fs, createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { once } from "node:events";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { ROOT } from "./store.js";

const execFileAsync = promisify(execFile);

export const WORKBUDDY_VERSION = "5.8.3";
export const WORKBUDDY_PAGE = "https://www.workbuddy.cn/docs/workbuddy/Download-History";
export const WORKBUDDY_URL =
  process.env.OWNCHAT_WORKBUDDY_URL ||
  "https://acc-1258344699.cos.ap-guangzhou.myqcloud.com/workbuddy/saas/win32-x64-user/WorkBuddy-win32-x64-user-5.8.3.41334564-db0e9b51.exe";
const FILENAME = path.basename(new URL(WORKBUDDY_URL).pathname) || `WorkBuddy-${WORKBUDDY_VERSION}.exe`;

export class WorkBuddyDownloader {
  constructor(logger = console) {
    this.logger = logger;
    this.dir = process.env.OWNCHAT_DOWNLOAD_DIR || path.join(ROOT, "downloads", "WorkBuddy");
    this.finalPath = path.join(this.dir, FILENAME);
    this.partPath = `${this.finalPath}.part`;
    this.metaPath = path.join(this.dir, "meta.json");
    this.controller = null;
    this.state = {
      state: "idle",
      version: WORKBUDDY_VERSION,
      url: WORKBUDDY_URL,
      page: WORKBUDDY_PAGE,
      filename: FILENAME,
      dir: this.dir,
      finalPath: this.finalPath,
      received: 0,
      total: 0,
      percent: 0,
      speed: 0,
      eta: null,
      error: "",
      signature: null,
      sha256: "",
      startedAt: 0,
      completedAt: 0,
    };
  }

  async init() {
    await fs.mkdir(this.dir, { recursive: true });
    try {
      const meta = JSON.parse(await fs.readFile(this.metaPath, "utf8"));
      Object.assign(this.state, meta, {
        state: meta.state === "downloading" ? "paused" : meta.state === "verifying" ? "done" : meta.state || "idle",
      });
    } catch {}
    await this.refresh();
    return this;
  }

  async refresh() {
    if (this.state.state === "verifying") return this.snapshot();
    try {
      const stat = await fs.stat(this.finalPath);
      this.state.state = "done";
      this.state.received = stat.size;
      this.state.total = this.state.total || stat.size;
      this.state.percent = 100;
      this.state.completedAt = this.state.completedAt || stat.mtimeMs;
      return this.snapshot();
    } catch {}
    try {
      const stat = await fs.stat(this.partPath);
      if (this.state.state !== "downloading") {
        this.state.state = "paused";
        this.state.received = stat.size;
        this.state.percent = this.state.total ? Math.min(99, (stat.size / this.state.total) * 100) : 0;
      }
    } catch {
      if (this.state.state !== "downloading" && this.state.state !== "done") this.state.state = "idle";
    }
    return this.snapshot();
  }

  snapshot() {
    return {
      ...this.state,
      percent: Number(this.state.percent.toFixed(1)),
      speedLabel: this.state.speed ? `${formatBytes(this.state.speed)}/s` : "",
      receivedLabel: formatBytes(this.state.received),
      totalLabel: this.state.total ? formatBytes(this.state.total) : "",
    };
  }

  async status() {
    await this.refresh();
    return this.snapshot();
  }

  async start() {
    await fs.mkdir(this.dir, { recursive: true });
    try {
      const stat = await fs.stat(this.finalPath);
      if (stat.size > 0) {
        this.state.state = "done";
        this.state.received = stat.size;
        this.state.percent = 100;
        return this.snapshot();
      }
    } catch {}
    if (this.state.state === "downloading") return this.snapshot();
    this.controller = new AbortController();
    this.state = {
      ...this.state,
      state: "downloading",
      error: "",
      startedAt: Date.now(),
      speed: 0,
      eta: null,
    };
    this.run(this.controller.signal).catch((error) => {
      if (error?.name === "AbortError" || this.controller?.signal.aborted) {
        this.state.state = "paused";
        this.state.speed = 0;
      } else {
        this.state.state = "error";
        this.state.error = error instanceof Error ? error.message : String(error);
        this.logger.error?.("[download] WorkBuddy failed:", error);
      }
      this.persist().catch(() => {});
    });
    return this.snapshot();
  }

  async run(signal) {
    let resumeAt = 0;
    try {
      const stat = await fs.stat(this.partPath);
      resumeAt = stat.size;
    } catch {}

    const headers = { "User-Agent": "OwnChat/0.1 WorkBuddyDownloader" };
    if (resumeAt > 0) headers.Range = `bytes=${resumeAt}-`;

    const response = await fetch(WORKBUDDY_URL, { headers, redirect: "follow", signal });
    if (!response.ok && response.status !== 206) {
      if (response.status === 416 && resumeAt > 0) {
        await fs.rm(this.partPath, { force: true });
        return this.run(signal);
      }
      throw new Error(`下载失败：HTTP ${response.status}`);
    }

    const resumed = response.status === 206 && resumeAt > 0;
    if (!resumed) resumeAt = 0;
    const length = Number(response.headers.get("content-length")) || 0;
    const total = resumed ? resumeAt + length : length;
    this.state.total = total;
    this.state.received = resumeAt;
    this.state.percent = total ? (resumeAt / total) * 100 : 0;

    const stream = createWriteStream(this.partPath, { flags: resumed ? "a" : "w" });
    let lastPersist = 0;
    let lastBytes = resumeAt;
    let lastTime = Date.now();

    try {
      const readable = Readable.fromWeb(response.body);
      for await (const chunk of readable) {
        if (signal.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
        if (!stream.write(chunk)) await once(stream, "drain");
        this.state.received += chunk.length;
        if (total) this.state.percent = Math.min(99.9, (this.state.received / total) * 100);
        const now = Date.now();
        if (now - lastTime >= 800) {
          const delta = this.state.received - lastBytes;
          this.state.speed = (delta / (now - lastTime)) * 1000;
          this.state.eta = this.state.speed > 0 && total ? Math.max(0, (total - this.state.received) / this.state.speed) : null;
          lastBytes = this.state.received;
          lastTime = now;
        }
        if (now - lastPersist >= 1000) {
          lastPersist = now;
          this.persist().catch(() => {});
        }
      }
      stream.end();
      await once(stream, "finish");
    } catch (error) {
      stream.destroy();
      throw error;
    }

    const stat = await fs.stat(this.partPath);
    if (total && stat.size !== total) {
      throw new Error(`下载不完整：${formatBytes(stat.size)} / ${formatBytes(total)}`);
    }
    await fs.rename(this.partPath, this.finalPath);
    this.state.state = "verifying";
    this.state.received = stat.size;
    this.state.total = stat.size;
    this.state.percent = 100;
    this.state.speed = 0;
    this.state.eta = 0;
    this.state.completedAt = Date.now();
    await this.persist();
    this.state.sha256 = await sha256File(this.finalPath);
    this.state.signature = await verifySignature(this.finalPath);
    this.state.state = "done";
    await this.persist();
    this.logger.log?.(`[download] WorkBuddy ${WORKBUDDY_VERSION} -> ${this.finalPath}`);
  }

  async cancel() {
    this.controller?.abort();
    this.controller = null;
    if (this.state.state === "downloading") this.state.state = "paused";
    await this.persist().catch(() => {});
    return this.status();
  }

  async persist() {
    await fs.mkdir(this.dir, { recursive: true });
    const meta = {
      state: this.state.state,
      version: this.state.version,
      url: this.state.url,
      received: this.state.received,
      total: this.state.total,
      percent: this.state.percent,
      sha256: this.state.sha256,
      signature: this.state.signature,
      completedAt: this.state.completedAt,
    };
    await fs.writeFile(this.metaPath, JSON.stringify(meta, null, 2), "utf8");
  }

  async openFolder() {
    await fs.mkdir(this.dir, { recursive: true });
    try {
      await fs.access(this.finalPath);
      spawn("explorer.exe", [`/select,${this.finalPath}`], { detached: true, stdio: "ignore" }).unref();
    } catch {
      spawn("explorer.exe", [this.dir], { detached: true, stdio: "ignore" }).unref();
    }
  }

  async runInstaller() {
    await fs.access(this.finalPath);
    const child = spawn(this.finalPath, [], { detached: true, stdio: "ignore" });
    child.unref();
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unit]}`;
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function verifySignature(file) {
  const escaped = file.replace(/'/g, "''");
  const script = [
    "$ErrorActionPreference='SilentlyContinue'",
    `$s=Get-AuthenticodeSignature -LiteralPath '${escaped}'`,
    "if($null -eq $s){ '{}' } else { $s | Select-Object @{n='Status';e={[string]$_.Status}},@{n='Signer';e={$_.SignerCertificate.Subject}} | ConvertTo-Json -Compress }",
  ].join("; ");
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { timeout: 25000, windowsHide: true, encoding: "utf8" },
    );
    const parsed = JSON.parse(String(stdout || "{}"));
    return { status: parsed.Status || "Unknown", signer: parsed.Signer || "" };
  } catch (error) {
    return { status: "Unknown", signer: "", error: error instanceof Error ? error.message : String(error) };
  }
}
