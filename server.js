import http from "node:http";
import { promises as fs, existsSync as fsSyncExists, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  Store, DATA_DIR, PUBLIC_DIR, UPLOAD_DIR, AVATAR_DIR, uid, now,
  decryptSecret, encryptSecret, mergeModels,
} from "./lib/store.js";
import { WorkBuddyBridge, WorkBuddyError } from "./lib/workbuddy.js";
import { WorkBuddyDownloader } from "./lib/downloads.js";
import { chatOpenAI, fetchModels, testProvider, ProviderError } from "./lib/openai.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Strip a possible UTF-8 BOM: some Windows tooling still writes one, and
// JSON.parse rejects it.
const APP_VERSION = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8").replace(/^\uFEFF/, ""),
).version;
const STORE = new Store();
const WORKBUDDY = new WorkBuddyBridge();
const DOWNLOADER = new WorkBuddyDownloader();
const SETTINGS = {
  host: "127.0.0.1",
  basePort: Number(process.env.OWNCHAT_PORT) || 17321,
  // --open  : launch a window AND quit when it closes
  // --managed: only quit when the window closes; the launcher opens the window
  //            itself, so the window has exactly one owner
  open: process.argv.includes("--open"),
  managed: process.argv.includes("--open") || process.argv.includes("--managed"),
};
// Demo mode: skip the third-party integration entirely so screenshots and tests
// never pick up a developer's real signed-in account.
const DEMO = process.env.OWNCHAT_DEMO === "1";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};
let appCloseTimer = null;

/* ---------- single instance ---------- */
// Two servers writing the same data/ directory would corrupt conversations.
// The lock is advisory: it records the pid and is cleaned up on exit.
const LOCK_FILE = path.join(DATA_DIR, "server.lock");

function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

async function acquireInstanceLock() {
  const write = async () => {
    const handle = await fs.open(LOCK_FILE, "wx");
    try {
      await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: Date.now() }));
    } finally {
      await handle.close();
    }
  };
  try {
    await write();
    return true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  let owner = null;
  try {
    owner = JSON.parse(await fs.readFile(LOCK_FILE, "utf8"));
  } catch {}
  if (owner?.pid && pidAlive(owner.pid)) return false;
  await fs.rm(LOCK_FILE, { force: true });
  await write();
  return true;
}

function releaseInstanceLock() {
  try {
    const owner = JSON.parse(readFileSync(LOCK_FILE, "utf8"));
    if (owner?.pid === process.pid) rmSync(LOCK_FILE, { force: true });
  } catch {}
}

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function sendJson(res, status, value) {
  if (res.writableEnded) return;
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, text, type = "text/plain; charset=utf-8") {
  if (res.writableEnded) return;
  const body = Buffer.from(String(text));
  res.writeHead(status, { "Content-Type": type, "Content-Length": body.length });
  res.end(body);
}

async function readBody(req, limit = 30 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("请求体过大");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req, limit) {
  const body = await readBody(req, limit);
  if (body.length === 0) return {};
  return JSON.parse(body.toString("utf8"));
}

function sse(res, event, data) {
  if (res.writableEnded) return;
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {}
}

function sanitizeName(name) {
  return String(name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(dataUrl || ""));
  if (!match) throw new Error("仅支持 PNG / JPEG / WebP / GIF 图片");
  const mime = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.length > 12 * 1024 * 1024) throw new Error("图片超过 12MB");
  const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
  return { mime, ext, buffer };
}

async function saveImage(dataUrl, dir, prefix) {
  const { ext, buffer } = parseDataUrl(dataUrl);
  await fs.mkdir(dir, { recursive: true });
  const name = `${prefix}-${uid()}.${ext}`;
  await fs.writeFile(path.join(dir, name), buffer);
  return name;
}

function imageUrlFor(dir, name) {
  return dir === AVATAR_DIR ? `/media/avatars/${name}` : `/media/uploads/${name}`;
}

async function readImageAsDataUrl(url) {
  if (typeof url !== "string" || url === "") return "";
  if (url.startsWith("data:")) return url;
  if (url.startsWith("/media/uploads/")) {
    const name = path.basename(url);
    try {
      const buffer = await fs.readFile(path.join(UPLOAD_DIR, name));
      const ext = path.extname(name).toLowerCase();
      const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "image/jpeg";
      return `data:${mime};base64,${buffer.toString("base64")}`;
    } catch {
      return "";
    }
  }
  return url;
}

function imageUrlFromMarkdown(markdown) {
  const images = [];
  const regex = /!\[[^\]]*\]\((\/media\/uploads\/[^)]+)\)/g;
  let match;
  while ((match = regex.exec(markdown || ""))) images.push({ url: match[1] });
  return images;
}

async function buildMessages(conversation, persona, history, maxChars, caps = null) {
  const system = persona?.systemPrompt || "你是一个乐于助人的 AI 助手。请用中文回答。";
  const tokenBudget = Number(caps?.contextWindow) > 0 ? Number(caps.contextWindow) : 0;
  const budget = tokenBudget ? Math.min(maxChars, tokenBudget * 2) : maxChars;
  const mapped = [];
  for (const message of history) {
    if (!message || message.kind === "divider") continue;
    if (message.role !== "user" && message.role !== "assistant") continue;
    if (message.role === "assistant" && (message.status === "error" || message.status === "stopped")) continue;
    if (!message.content && !(message.images && message.images.length)) continue;
    if (message.role === "assistant") {
      mapped.push({ role: "assistant", content: String(message.content || "") });
      continue;
    }
    const images = Array.isArray(message.images) ? message.images : [];
    if (images.length === 0) {
      mapped.push({ role: "user", content: String(message.content || "") });
    } else {
      const parts = [];
      if (message.content) parts.push({ type: "text", text: String(message.content) });
      for (const image of images) {
        const dataUrl = await readImageAsDataUrl(image.url);
        if (dataUrl) parts.push({ type: "image_url", image_url: { url: dataUrl } });
      }
      mapped.push({ role: "user", content: parts });
    }
  }

  const selected = [];
  let used = system.length;
  for (let i = mapped.length - 1; i >= 0; i--) {
    const message = mapped[i];
    const length = typeof message.content === "string"
      ? message.content.length
      : JSON.stringify(message.content).length;
    if (selected.length > 0 && used + length > budget) break;
    selected.unshift(message);
    used += length;
  }
  return {
    messages: [{ role: "system", content: system }, ...selected],
    dropped: mapped.length - selected.length,
    used,
  };
}

function findProvider(id) {
  return STORE.rawProvider(id);
}

function modelInfo(provider, modelId) {
  return (provider?.models || []).find((m) => m.id === modelId) || null;
}

function modelCapabilities(provider, modelId) {
  const info = modelInfo(provider, modelId) || {};
  return {
    vision: info.vision !== undefined ? Boolean(info.vision) : Boolean(provider?.supportsVision),
    contextWindow: Number(info.contextWindow) || Number(provider?.contextWindow) || 128000,
    maxOutput: Number(info.maxOutput || info.maxTokens) || Number(provider?.maxTokens) || 4096,
    reasoningEffort: info.reasoningEffort || provider?.reasoningEffort || "",
  };
}

function compareVersions(a, b) {
  const pa = String(a || "0").replace(/^v/i, "").split(/[.+-]/).map((n) => Number.parseInt(n, 10) || 0);
  const pb = String(b || "0").replace(/^v/i, "").split(/[.+-]/).map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const left = pa[i] || 0;
    const right = pb[i] || 0;
    if (left !== right) return left > right ? 1 : -1;
  }
  return 0;
}

const UPDATE_CACHE = { at: 0, data: null };

async function checkUpdate(force = false) {
  const fresh = UPDATE_CACHE.data && Date.now() - UPDATE_CACHE.at < 6 * 60 * 60 * 1000;
  if (!force && fresh) return UPDATE_CACHE.data;
  const result = {
    current: APP_VERSION,
    latest: APP_VERSION,
    hasUpdate: false,
    url: "https://github.com/KovacBro/OwnChat/releases/latest",
    notes: "",
    publishedAt: "",
    error: "",
  };
  try {
    const response = await fetch("https://api.github.com/repos/KovacBro/OwnChat/releases/latest", {
      headers: { Accept: "application/vnd.github+json", "User-Agent": `OwnChat/${APP_VERSION}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`GitHub 返回 ${response.status}`);
    const release = await response.json();
    const tag = String(release.tag_name || "").replace(/^v/i, "");
    if (tag) {
      result.latest = tag;
      result.hasUpdate = compareVersions(tag, APP_VERSION) > 0;
      result.url = release.html_url || result.url;
      result.notes = String(release.body || "").slice(0, 4000);
      result.publishedAt = release.published_at || "";
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  UPDATE_CACHE.at = Date.now();
  UPDATE_CACHE.data = result;
  return result;
}

function diagnosticId(code, status) {
  return `EU-${String(code || "ERR").replace(/[^A-Z0-9_]/gi, "").slice(0, 12)}-${status || 0}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function isRetryable(error) {
  if (!error) return false;
  if (error.retryable !== undefined) return Boolean(error.retryable);
  const status = Number(error.status) || 0;
  return status === 0 || status === 429 || status >= 500;
}

function modelLabel(provider, modelId) {
  return modelInfo(provider, modelId)?.name || modelId;
}

async function saveProviderModels(providerId, models) {
  const provider = findProvider(providerId);
  if (!provider) return [];
  provider.models = mergeModels(provider.models, models);
  provider.modelsFetchedAt = Date.now();
  await STORE.persist();
  return provider.models;
}

function providerSupportsVision(provider, modelId) {
  if (provider.kind === "workbuddy") {
    const info = modelInfo(provider, modelId);
    if (info) return Boolean(info.vision);
    return Boolean(provider.supportsVision);
  }
  const info = modelInfo(provider, modelId);
  return Boolean(info?.vision || provider.supportsVision);
}

const DEMO_STATUS = {
  available: false,
  signedIn: false,
  accounts: [],
  error: "演示模式：未加载本地账号",
  models: [],
};

async function enrichProviders() {
  const statuses = DEMO
    ? { cn: { ...DEMO_STATUS, region: "cn" }, global: { ...DEMO_STATUS, region: "global" } }
    : { cn: await WORKBUDDY.status("cn"), global: await WORKBUDDY.status("global") };
  const providers = STORE.providers().map((provider) => {
    if (provider.kind === "workbuddy") {
      const status = statuses[provider.region] || null;
      return {
        ...provider,
        status,
        models: provider.models?.length ? provider.models : status?.models || [],
      };
    }
    return provider;
  });
  return { providers, statuses };
}

async function bootstrap() {
  const { providers, statuses } = await enrichProviders();
  return {
    version: APP_VERSION,
    demo: DEMO,
    settings: STORE.settings(),
    providers,
    personas: STORE.personas(),
    conversations: STORE.conversations(),
    workbuddy: statuses,
    download: DEMO ? null : await DOWNLOADER.status(),
  };
}

async function generateImage({ prompt, negative = "", seed, width = 768, height = 768 }) {
  const settings = STORE.settings();
  const config = settings.imageProvider || { kind: "pollinations", model: "flux" };
  const finalPrompt = negative ? `${prompt}, avoid: ${negative}` : prompt;
  const numericSeed = Number.isFinite(Number(seed)) ? Number(seed) : Math.floor(Math.random() * 1_000_000);

  if (!config.kind || config.kind === "pollinations") {
    const query = new URLSearchParams({
      width: String(width),
      height: String(height),
      seed: String(numericSeed),
      nologo: "true",
      model: config.model || "flux",
    });
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?${query}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(120000) }).catch((error) => {
      const timedOut = error?.name === "TimeoutError" || /abort|timeout/i.test(String(error?.message || ""));
      throw new ProviderError(
        timedOut
          ? "免费生图接口超时（当前可能限流 / 排队）。请稍后重试，或在「设置 → 头像生成」里填写自己的图片 API。"
          : `生图接口连接失败：${error.message}`,
        { status: 0, code: timedOut ? "IMAGE_TIMEOUT" : "IMAGE_NETWORK" },
      );
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new ProviderError(
        response.status === 402
          ? "免费生图接口当前限流（402）。请稍后重试，或在设置里填写自己的图片 API。"
          : `生图接口返回 ${response.status}${text ? `：${text.slice(0, 160)}` : ""}`,
        { status: response.status, code: "IMAGE_HTTP" },
      );
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return { buffer, mime: response.headers.get("content-type") || "image/jpeg" };
  }

  if (!config.baseUrl) throw new ProviderError("未配置图片 API 地址", { status: 400 });
  const apiKey = config.apiKeyEnc ? await decryptSecret(config.apiKeyEnc) : "";
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const endpoint = baseUrl.endsWith("/images/generations") ? baseUrl : `${baseUrl}/images/generations`;
  const isSilicon = config.kind === "siliconflow";
  const body = isSilicon
    ? {
        model: config.model || "Kwai-Kolors/Kolors",
        prompt: finalPrompt,
        negative_prompt: negative,
        image_size: `${width}x${height}`,
        batch_size: 1,
        num_inference_steps: 20,
        guidance_scale: 7.5,
      }
    : {
        model: config.model || "gpt-image-1",
        prompt: finalPrompt,
        n: 1,
        size: `${width}x${height}`,
        response_format: "b64_json",
      };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ProviderError(`图片 API 返回 ${response.status}：${text.slice(0, 240)}`, {
      status: response.status,
      code: "IMAGE_HTTP",
    });
  }
  const payload = await response.json();
  const first = payload?.data?.[0] || payload?.images?.[0] || payload?.output?.[0];
  let b64 = first?.b64_json;
  let url = first?.url || (typeof first === "string" ? first : "");
  if (!b64 && url) {
    const imageResponse = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (!imageResponse.ok) throw new ProviderError("下载生图结果失败", { status: 502 });
    return {
      buffer: Buffer.from(await imageResponse.arrayBuffer()),
      mime: imageResponse.headers.get("content-type") || "image/jpeg",
    };
  }
  if (!b64) throw new ProviderError("图片 API 没有返回图片", { status: 502 });
  return { buffer: Buffer.from(b64, "base64"), mime: "image/png" };
}

async function handleApi(req, res, url) {
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, version: APP_VERSION });
  }

  if (req.method === "GET" && pathname === "/api/bootstrap") {
    return sendJson(res, 200, await bootstrap());
  }

  if (req.method === "GET" && pathname === "/api/workbuddy/status") {
    return sendJson(res, 200, {
      cn: await WORKBUDDY.status("cn"),
      global: await WORKBUDDY.status("global"),
    });
  }

  if (req.method === "GET" && pathname === "/api/downloads/workbuddy/status") {
    return sendJson(res, 200, await DOWNLOADER.status());
  }

  if (req.method === "POST" && pathname === "/api/downloads/workbuddy/start") {
    return sendJson(res, 200, await DOWNLOADER.start());
  }

  if (req.method === "POST" && pathname === "/api/downloads/workbuddy/cancel") {
    return sendJson(res, 200, await DOWNLOADER.cancel());
  }

  if (req.method === "POST" && pathname === "/api/downloads/workbuddy/open") {
    await DOWNLOADER.openFolder();
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/downloads/workbuddy/run") {
    try {
      await DOWNLOADER.runInstaller();
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 404, { error: `安装包尚未下载完成：${error.message}` });
    }
  }

  if (req.method === "POST" && pathname === "/api/workbuddy/account") {
    const body = await readJson(req);
    const region = body.region === "global" ? "global" : "cn";
    await WORKBUDDY.selectAccount(region, body.accountId || "");
    const provider = STORE.rawProvider(region === "global" ? "workbuddy-global" : "workbuddy-cn");
    if (provider) {
      provider.accountId = body.accountId || "";
      provider.models = [];
      await STORE.persist();
    }
    return sendJson(res, 200, await WORKBUDDY.status(region));
  }

  if (req.method === "POST" && pathname === "/api/workbuddy/models") {
    const body = await readJson(req);
    const region = body.region === "global" ? "global" : "cn";
    const provider = STORE.rawProvider(region === "global" ? "workbuddy-global" : "workbuddy-cn");
    if (!provider) return sendJson(res, 404, { error: "Provider 不存在" });
    try {
      const result = await WORKBUDDY.models(region, Boolean(body.refresh));
      const models = await saveProviderModels(provider.id, result.models);
      return sendJson(res, 200, { ...result, models, providerId: provider.id });
    } catch (error) {
      return sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (req.method === "GET" && pathname === "/api/conversations") {
    return sendJson(res, 200, { conversations: STORE.conversations() });
  }

  if (req.method === "POST" && pathname === "/api/conversations") {
    const body = await readJson(req);
    const conversation = await STORE.createConversation(body);
    return sendJson(res, 200, { conversation });
  }

  if (req.method === "GET" && pathname === "/api/search") {
    const query = url.searchParams.get("q") || "";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 60, 1), 200);
    return sendJson(res, 200, { query, results: await STORE.searchMessages(query, limit) });
  }

  if (req.method === "POST" && pathname === "/api/conversations/bulk-delete") {
    const body = await readJson(req);
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    if (ids.length === 0) return sendJson(res, 400, { error: "没有选中会话" });
    const removed = await STORE.deleteMany(ids);
    return sendJson(res, 200, { removed, conversations: STORE.conversations() });
  }

  if (req.method === "POST" && pathname === "/api/import") {
    try {
      const body = await readJson(req);
      const added = await STORE.importData(body);
      return sendJson(res, 200, { added, conversations: STORE.conversations() });
    } catch (error) {
      return sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (req.method === "GET" && pathname === "/api/update") {
    return sendJson(res, 200, await checkUpdate(url.searchParams.has("force")));
  }

  const convMatch = /^\/api\/conversations\/([a-zA-Z0-9_-]+)$/.exec(pathname);
  if (convMatch && req.method === "PATCH") {
    const body = await readJson(req);
    const id = convMatch[1];
    const before = STORE.conversation(id);
    if (!before) return sendJson(res, 404, { error: "会话不存在" });
    if (body.modelId && body.modelId !== before.modelId) {
      const provider = findProvider(body.providerId || before.providerId) || findProvider("workbuddy-cn");
      const label = body.modelLabel || modelLabel(provider, body.modelId);
      await STORE.appendMessage(id, {
        id: uid("m_"),
        role: "system",
        kind: "divider",
        content: `已切换到 ${label}`,
        createdAt: now(),
        status: "complete",
      });
    }
    const conversation = await STORE.updateConversation(id, body);
    return sendJson(res, 200, { conversation });
  }

  const convExport = /^\/api\/conversations\/([a-zA-Z0-9_-]+)\/export$/.exec(pathname);
  if (convExport && req.method === "GET") {
    const payload = await STORE.exportConversation(convExport[1]);
    if (!payload) return sendJson(res, 404, { error: "会话不存在" });
    return sendJson(res, 200, payload);
  }

  if (convMatch && req.method === "DELETE") {
    await STORE.deleteConversation(convMatch[1]);
    return sendJson(res, 200, { ok: true });
  }

  const msgMatch = /^\/api\/conversations\/([a-zA-Z0-9_-]+)\/messages$/.exec(pathname);
  if (msgMatch && req.method === "GET") {
    return sendJson(res, 200, { messages: await STORE.messages(msgMatch[1]) });
  }

  if (req.method === "POST" && pathname === "/api/providers") {
    const body = await readJson(req);
    const provider = await STORE.upsertProvider(body, body.id || "");
    return sendJson(res, 200, { provider });
  }

  if (req.method === "POST" && pathname === "/api/personas") {
    const body = await readJson(req);
    const persona = await STORE.upsertPersona(body, body.id || "");
    return sendJson(res, 200, { persona });
  }

  const personaMatch = /^\/api\/personas\/([a-zA-Z0-9_-]+)$/.exec(pathname);
  if (personaMatch && req.method === "DELETE") {
    const ok = await STORE.deletePersona(personaMatch[1]);
    return sendJson(res, ok ? 200 : 400, { ok, error: ok ? undefined : "预置人格不能删除" });
  }

  const providerMatch = /^\/api\/providers\/([a-zA-Z0-9_-]+)$/.exec(pathname);
  if (providerMatch && req.method === "DELETE") {
    await STORE.deleteProvider(providerMatch[1]);
    return sendJson(res, 200, { ok: true });
  }

  const providerTest = /^\/api\/providers\/([a-zA-Z0-9_-]+)\/test$/.exec(pathname);
  if (providerTest && req.method === "POST") {
    const provider = findProvider(providerTest[1]);
    if (!provider) return sendJson(res, 404, { error: "接口不存在" });
    if (provider.kind === "workbuddy") {
      const status = await WORKBUDDY.status(provider.region);
      if (!status.signedIn) return sendJson(res, 200, { ok: false, error: status.error || "未登录" });
      try {
        const result = await WORKBUDDY.models(provider.region, true);
        const models = await saveProviderModels(provider.id, result.models);
        return sendJson(res, 200, { ok: true, models: models.length, sample: "凭据有效，模型列表已刷新" });
      } catch (error) {
        return sendJson(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return sendJson(res, 200, await testProvider(provider));
  }

  const providerModels = /^\/api\/providers\/([a-zA-Z0-9_-]+)\/models$/.exec(pathname);
  if (providerModels && req.method === "POST") {
    const provider = findProvider(providerModels[1]);
    if (!provider) return sendJson(res, 404, { error: "接口不存在" });
    try {
      if (provider.kind === "workbuddy") {
        const result = await WORKBUDDY.models(provider.region, true);
        const models = await saveProviderModels(provider.id, result.models);
        return sendJson(res, 200, { ...result, models });
      }
      const fetched = await fetchModels(provider);
      const models = await saveProviderModels(provider.id, fetched);
      return sendJson(res, 200, { models, source: "live" });
    } catch (error) {
      return sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  const capMatch = /^\/api\/providers\/([a-zA-Z0-9_-]+)\/capabilities$/.exec(pathname);
  if (capMatch && req.method === "POST") {
    const provider = findProvider(capMatch[1]);
    if (!provider) return sendJson(res, 404, { error: "接口不存在" });
    const body = await readJson(req);
    const modelId = String(body.modelId || "").trim();
    if (!modelId) return sendJson(res, 400, { error: "缺少 modelId" });
    provider.models = Array.isArray(provider.models) ? provider.models : [];
    let model = provider.models.find((m) => m.id === modelId);
    if (!model) {
      model = { id: modelId, name: modelId, vision: false, contextWindow: 128000, maxOutput: 4096 };
      provider.models.push(model);
    }
    if (body.vision !== undefined) model.vision = Boolean(body.vision);
    if (body.contextWindow !== undefined) model.contextWindow = Math.max(0, Number(body.contextWindow) || 0);
    if (body.maxOutput !== undefined) model.maxOutput = Math.max(0, Number(body.maxOutput) || 0);
    if (body.reasoningEffort !== undefined) model.reasoningEffort = String(body.reasoningEffort || "");
    if (body.name !== undefined && String(body.name).trim()) model.name = String(body.name).trim().slice(0, 120);
    await STORE.persist();
    return sendJson(res, 200, { model });
  }

  if (req.method === "PATCH" && pathname === "/api/settings") {
    const body = await readJson(req);
    return sendJson(res, 200, { settings: await STORE.updateSettings(body) });
  }

  if (req.method === "POST" && pathname === "/api/upload") {
    const body = await readJson(req);
    const name = await saveImage(body.dataUrl, UPLOAD_DIR, "img");
    return sendJson(res, 200, { url: imageUrlFor(UPLOAD_DIR, name), name: sanitizeName(body.name || name) });
  }

  if (req.method === "POST" && pathname === "/api/avatars") {
    const body = await readJson(req);
    const name = await saveImage(body.dataUrl, AVATAR_DIR, "avatar");
    return sendJson(res, 200, { url: imageUrlFor(AVATAR_DIR, name) });
  }

  if (req.method === "POST" && pathname === "/api/avatars/generate") {
    const body = await readJson(req);
    if (!body.prompt || String(body.prompt).trim().length < 4) {
      return sendJson(res, 400, { error: "请填写头像提示词" });
    }
    try {
      const image = await generateImage({
        prompt: String(body.prompt),
        negative: String(body.negative || ""),
        seed: body.seed,
        width: Number(body.width) || 768,
        height: Number(body.height) || 768,
      });
      const ext = image.mime.includes("png") ? "png" : image.mime.includes("webp") ? "webp" : "jpg";
      const name = `gen-${uid()}.${ext}`;
      await fs.writeFile(path.join(AVATAR_DIR, name), image.buffer);
      return sendJson(res, 200, { url: imageUrlFor(AVATAR_DIR, name), mime: image.mime });
    } catch (error) {
      return sendJson(res, 502, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (req.method === "GET" && pathname === "/api/export") {
    return sendJson(res, 200, await STORE.exportData());
  }

  if (req.method === "POST" && pathname === "/api/chat") {
    return handleChat(req, res);
  }

  if (req.method === "POST" && pathname === "/api/app/closed") {
    if (SETTINGS.managed && !STORE.settings().keepRunning) {
      clearTimeout(appCloseTimer);
      appCloseTimer = setTimeout(() => {
        log("OwnChat window closed; shutting down");
        process.exit(0);
      }, 8000);
    }
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/ping") {
    clearTimeout(appCloseTimer);
    appCloseTimer = null;
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: "Not found" });
}

async function handleChat(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    return sendJson(res, 400, { error: error instanceof Error ? error.message : "请求体错误" });
  }

  const conversation = STORE.conversation(body.conversationId);
  if (!conversation) return sendJson(res, 404, { error: "会话不存在" });
  if (!conversation.providerId || !conversation.modelId) {
    return sendJson(res, 400, { error: "当前会话还没有绑定模型，请先选择模型" });
  }
  const provider = findProvider(conversation.providerId);
  if (!provider) return sendJson(res, 400, { error: "模型接口不存在，请重新选择" });
  const persona = STORE.persona(conversation.personaId) || STORE.personas()[0];
  const caps = modelCapabilities(provider, conversation.modelId);

  const messages = await STORE.messages(conversation.id);
  let userMessage;

  if (body.retry) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userMessage = messages[i];
        break;
      }
    }
    if (!userMessage) return sendJson(res, 400, { error: "没有可重试的消息" });
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && messages[i].status === "error") {
        messages.splice(i, 1);
      } else if (messages[i].role === "user") {
        break;
      }
    }
    await STORE.saveMessages(conversation.id, messages);
  } else {
    const content = String(body.content || "").trim();
    const images = Array.isArray(body.images) ? body.images.filter((img) => img && img.url).slice(0, 4) : [];
    if (!content && images.length === 0) return sendJson(res, 400, { error: "消息为空" });
    if (images.length > 0 && !caps.vision) {
      return sendJson(res, 400, {
        error: "当前模型未标记为支持图片。请切换支持视觉的模型，或在接口设置里打开“支持图片”。",
      });
    }
    userMessage = {
      id: uid("m_"),
      role: "user",
      kind: "text",
      content,
      images,
      createdAt: now(),
      status: "complete",
    };
    messages.push(userMessage);
    await STORE.saveMessages(conversation.id, messages);
  }

  const assistantId = uid("m_");
  const assistant = {
    id: assistantId,
    role: "assistant",
    kind: "text",
    content: "",
    reasoning: "",
    images: [],
    providerId: provider.id,
    modelId: conversation.modelId,
    createdAt: now(),
    status: "streaming",
    usage: null,
  };

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  sse(res, "meta", {
    conversationId: conversation.id,
    userMessageId: userMessage.id,
    assistantMessageId: assistantId,
    providerId: provider.id,
    modelId: conversation.modelId,
    persona: { id: persona.id, name: persona.name, avatar: persona.avatar, accent: persona.accent },
  });

  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  const history = messages.filter((m) => m.id !== assistantId);
  let content = "";
  let reasoning = "";
  let usage = null;
  let dropped = 0;

  try {
    const built = await buildMessages(
      conversation,
      persona,
      history,
      STORE.settings().contextChars || 48000,
      caps,
    );
    dropped = built.dropped;
    if (dropped > 0) sse(res, "notice", { type: "trimmed", dropped, used: built.used });

    const handlers = {
      onDelta: (text) => {
        content += text;
        sse(res, "delta", { text });
      },
      onReasoning: (text) => {
        reasoning += text;
        sse(res, "reasoning", { text });
      },
      onUsage: (value) => {
        usage = value;
        sse(res, "usage", value);
      },
    };

    const request = {
      model: conversation.modelId,
      messages: built.messages,
      temperature: body.temperature ?? provider.temperature ?? 0.7,
      maxTokens: Math.min(Number(body.maxTokens || caps.maxOutput || provider.maxTokens || 4096), 128000),
      reasoningEffort: caps.reasoningEffort,
      signal: controller.signal,
      ...handlers,
    };

    const run = () =>
      provider.kind === "workbuddy"
        ? WORKBUDDY.chat(provider.region, request)
        : chatOpenAI(provider, request);

    try {
      await run();
    } catch (error) {
      const canRetry = !controller.signal.aborted && content === "" && reasoning === "" && isRetryable(error);
      if (!canRetry) throw error;
      log(`chat retry after ${error?.code || error?.name || "error"}: ${error?.message || error}`);
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (controller.signal.aborted) throw error;
      await run();
    }

    assistant.content = content;
    assistant.reasoning = reasoning;
    assistant.usage = usage;
    assistant.truncated = dropped;
    assistant.status = controller.signal.aborted ? "stopped" : "complete";
    await STORE.replaceMessage(conversation.id, assistant);

    const preview = content.replace(/\s+/g, " ").trim().slice(0, 70);
    const patch = {
      lastPreview: preview || "（无内容）",
      updatedAt: now(),
      unread: 0,
    };
    if (conversation.title === "新对话" && userMessage.content) {
      patch.title = userMessage.content.replace(/\s+/g, " ").slice(0, 18);
    }
    await STORE.updateConversation(conversation.id, patch);
    sse(res, "done", { message: assistant });
  } catch (error) {
    const aborted = controller.signal.aborted;
    const message = aborted
      ? "已停止生成"
      : error instanceof Error
        ? error.message
        : String(error);
    assistant.content = content;
    assistant.reasoning = reasoning;
    assistant.usage = usage;
    assistant.truncated = dropped;
    assistant.status = aborted ? "stopped" : "error";
    assistant.error = aborted ? "" : message;
    assistant.diagnostic = aborted ? "" : diagnosticId(error?.code || "CHAT_ERROR", error?.status || 502);
    await STORE.replaceMessage(conversation.id, assistant);
    await STORE.updateConversation(conversation.id, {
      lastPreview: aborted ? "已停止生成" : `错误：${message}`.slice(0, 70),
      updatedAt: now(),
    });
    if (!aborted) {
      sse(res, "error", {
        code: error?.code || "CHAT_ERROR",
        status: error?.status || 502,
        message,
        diagnostic: assistant.diagnostic,
      });
    }
    sse(res, "done", { message: assistant, aborted });
  } finally {
    if (!res.writableEnded) res.end();
  }
}

async function serveStatic(req, res, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return sendText(res, 400, "Bad request");
  }
  let file;
  if (pathname === "/" || pathname === "") {
    file = path.join(PUBLIC_DIR, "index.html");
  } else if (pathname.startsWith("/media/uploads/")) {
    file = path.join(UPLOAD_DIR, path.basename(pathname));
  } else if (pathname.startsWith("/media/avatars/")) {
    file = path.join(AVATAR_DIR, path.basename(pathname));
  } else {
    file = path.join(PUBLIC_DIR, pathname);
  }
  const resolved = path.resolve(file);
  const allowed = [PUBLIC_DIR, UPLOAD_DIR, AVATAR_DIR].some((dir) => resolved === dir || resolved.startsWith(dir + path.sep));
  if (!allowed) return sendText(res, 403, "Forbidden");
  try {
    const stat = await fs.stat(resolved);
    if (stat.isDirectory()) return sendText(res, 404, "Not found");
    const data = await fs.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": data.length,
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=60",
    });
    res.end(data);
  } catch {
    sendText(res, 404, "Not found");
  }
}

async function main() {
  await STORE.init();
  if (!(await acquireInstanceLock())) {
    log("OwnChat is already running; reusing the existing instance.");
    process.exit(0);
  }
  process.on("exit", releaseInstanceLock);
  await DOWNLOADER.init();
  if (!DEMO) {
    WORKBUDDY.init().then(async () => {
      for (const region of ["cn", "global"]) {
        const status = await WORKBUDDY.status(region).catch(() => null);
        if (!status?.signedIn) continue;
        try {
          const result = await WORKBUDDY.models(region, true);
          await saveProviderModels(region === "global" ? "workbuddy-global" : "workbuddy-cn", result.models);
          log(`WorkBuddy ${region}: ${result.models.length} models`);
        } catch (error) {
          log(`WorkBuddy ${region} model refresh failed:`, error.message);
        }
      }
    });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, url);
      } else {
        await serveStatic(req, res, url);
      }
    } catch (error) {
      log("request failed:", error);
      if (!res.headersSent) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      log(`port ${server.address()?.port || ""} in use, retrying`);
    } else {
      log("server error:", error);
    }
  });

  let port = SETTINGS.basePort;
  const listen = (candidate) =>
    new Promise((resolve, reject) => {
      const onError = (error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(candidate, SETTINGS.host);
    });

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await listen(port);
      break;
    } catch (error) {
      if (error.code !== "EADDRINUSE" || attempt === 4) throw error;
      port += 1;
    }
  }

  const url = `http://${SETTINGS.host}:${port}`;
  await fs.writeFile(path.join(DATA_DIR, "server.pid"), String(process.pid));
  await fs.writeFile(path.join(DATA_DIR, "runtime.json"), JSON.stringify({ url, pid: process.pid, startedAt: Date.now() }));
  log(`OwnChat running at ${url}`);

  if (SETTINGS.open) {
    const edgeCandidates = [
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    ];
    const edge = edgeCandidates.find((candidate) => {
      try {
        return requireExists(candidate);
      } catch {
        return false;
      }
    });
    if (edge) {
      const child = spawn(edge, [
        `--app=${url}/?app=1`,
        "--window-size=1180,780",
        "--no-first-run",
        "--no-default-browser-check",
        `--user-data-dir=${path.join(DATA_DIR, "edge-profile")}`,
      ], { detached: true, stdio: "ignore" });
      child.unref();
    } else {
      spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    }
  }
}

function requireExists(file) {
  return fsSyncExists(file);
}

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
