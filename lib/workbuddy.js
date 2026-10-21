import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const PLUGIN_NAME = "dsh-connect-workbuddy";
const CACHE_TTL = 5 * 60 * 1000;

const VISION_IDS = new Set([
  "glm-5.3-flash",
  "glm-5.3-flashx",
  "glm-5v-turbo",
  "deepseek-v4.1-flash",
  "minimax-m3.1-flash",
  "kimi-k2.8-preview",
  "mimo-v2.6-pro",
]);

export class WorkBuddyError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "WorkBuddyError";
    this.code = options.code || "WORKBUDDY_ERROR";
    this.status = options.status || 502;
    this.kind = options.kind || "server";
  }
}

function dshHome() {
  return process.env.DSH_HOME?.trim() || path.join(os.homedir(), ".dsh");
}

async function findPluginCore() {
  const profiles = path.join(dshHome(), "profiles");
  let names = [];
  try {
    names = (await fs.readdir(profiles, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {}
  names.sort((a, b) => (a === "desktop" ? -1 : b === "desktop" ? 1 : a.localeCompare(b)));

  const roots = [
    ...names.map((name) => path.join(profiles, name, "node_modules", PLUGIN_NAME, "lib")),
    path.join(dshHome(), "node_modules", PLUGIN_NAME, "lib"),
  ];

  for (const lib of roots) {
    try {
      const files = (await fs.readdir(lib)).filter((name) => /^host-heartbeat-.*\.js$/.test(name));
      if (files.length === 0) continue;
      const stats = await Promise.all(
        files.map(async (name) => ({ name, mtime: (await fs.stat(path.join(lib, name))).mtimeMs })),
      );
      stats.sort((a, b) => b.mtime - a.mtime);
      return path.join(lib, stats[0].name);
    } catch {}
  }
  throw new Error(
    "未找到 dsh-connect-workbuddy。请先在 DSH 中安装并登录该插件，或设置 DSH_HOME。",
  );
}

function findExport(ns, name, fallback) {
  const found = Object.values(ns).find((value) => typeof value === "function" && value.name === name);
  if (typeof found === "function") return found;
  if (fallback && typeof ns[fallback] === "function") return ns[fallback];
  throw new Error(`dsh-connect-workbuddy 版本不兼容：缺少 ${name} 导出`);
}

function normalizeModel(model) {
  const id = String(model.id || "");
  return {
    id,
    name: String(model.name || id),
    contextWindow: Number(model.contextWindow) || 128000,
    maxTokens: Number(model.maxTokens) || 4096,
    creditMultiplier: typeof model.creditMultiplier === "number" ? model.creditMultiplier : null,
    reasoning: model.reasoning || null,
    vision: VISION_IDS.has(id),
    source: "workbuddy",
  };
}

function errorFromResult(result) {
  const detail = result.detail;
  const bits = [];
  if (detail?.upstreamCode !== undefined) bits.push(`code ${detail.upstreamCode}`);
  if (detail?.requestId) bits.push(`requestId ${detail.requestId}`);
  const hint = detail?.displayMsg || detail?.tips || "";
  const text = hint || String(result.message || "").slice(0, 360);
  return new WorkBuddyError(
    bits.length ? `${text}（${bits.join("，")}）` : text || "WorkBuddy 上游请求失败",
    {
      status: result.status || 502,
      kind: result.kind || "server",
      code: `WORKBUDDY_${String(result.kind || "ERROR").toUpperCase()}`,
    },
  );
}

async function parseSSE(response, handlers) {
  if (!response.body) return { content: "", reasoning: "", usage: null, finishReason: "" };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoning = "";
  let usage = null;
  let finishReason = "";

  const handleData = (data) => {
    if (!data || data === "[DONE]") return false;
    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      return true;
    }
    if (payload?.error) {
      throw new WorkBuddyError(payload.error.message || "WorkBuddy 流式返回错误", {
        status: 502,
        kind: "server",
      });
    }
    const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
    const delta = choice?.delta || {};
    const reason = delta.reasoning_content ?? delta.reasoning;
    if (typeof reason === "string" && reason) {
      reasoning += reason;
      handlers.onReasoning?.(reason);
    }
    let text = "";
    if (typeof delta.content === "string") text = delta.content;
    else if (Array.isArray(delta.content)) {
      text = delta.content.map((part) => (typeof part === "string" ? part : part?.text || "")).join("");
    }
    if (text) {
      content += text;
      handlers.onDelta?.(text);
    }
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    if (payload.usage) {
      usage = payload.usage;
      handlers.onUsage?.(payload.usage);
    }
    return true;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) handleData(data);
    }
  }
  if (buffer.trim()) {
    const data = buffer
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (data) handleData(data);
  }
  return { content, reasoning, usage, finishReason };
}

export class WorkBuddyBridge {
  constructor(logger = console) {
    this.logger = logger;
    this.module = null;
    this.client = null;
    this.stores = null;
    this.cache = { cn: { at: 0, models: [] }, global: { at: 0, models: [] } };
    this.ready = false;
    this.error = "";
    this.pluginPath = "";
  }

  async init() {
    if (this.ready) return this;
    try {
      const corePath = await findPluginCore();
      const ns = await import(pathToFileURL(corePath).href);
      const CredentialStore = findExport(ns, "WorkBuddyCredentialStore", "y");
      const UpstreamClient = findExport(ns, "WorkBuddyUpstreamClient", "F");
      this.prepareChatBody = findExport(ns, "prepareChatBody", "W");
      this.fallbackModelsFor = findExport(ns, "fallbackModelsFor", "h");
      this.client = new UpstreamClient((message) => this.logger.warn?.("[workbuddy]", message));
      this.stores = {
        cn: new CredentialStore({
          region: "cn",
          refresh: (credential) => this.client.refreshToken(credential),
        }),
        global: new CredentialStore({
          region: "global",
          refresh: (credential) => this.client.refreshToken(credential),
        }),
      };
      this.pluginPath = corePath;
      this.ready = true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.ready = false;
    }
    return this;
  }

  store(region) {
    if (!this.ready || !this.stores) throw new Error(this.error || "WorkBuddy 插件尚未就绪");
    return this.stores[region === "global" ? "global" : "cn"];
  }

  async status(region) {
    await this.init();
    const key = region === "global" ? "global" : "cn";
    if (!this.ready) {
      return {
        available: false,
        region: key,
        signedIn: false,
        accounts: [],
        error: this.error,
        pluginPath: "",
      };
    }
    try {
      const store = this.store(key);
      const rawAccounts = await store.accounts();
      const accounts = rawAccounts.map((account) => ({
        id: account.id,
        accountName: account.accountName,
        domain: account.domain,
        tokenExpiresAtMs: account.tokenExpiresAtMs,
        selected: account.selected,
      }));
      const current = await store.current();
      const account = accounts.find((a) => a.selected) || accounts[0] || null;
      return {
        available: true,
        region: key,
        signedIn: Boolean(current),
        accounts,
        account: account
          ? { id: account.id, name: account.accountName, domain: account.domain, expiresAtMs: account.tokenExpiresAtMs }
          : null,
        error: accounts.length === 0 ? "本机没有该区域的 WorkBuddy 登录态" : "",
        pluginPath: this.pluginPath,
        models: this.cache[key]?.models || [],
      };
    } catch (error) {
      return {
        available: true,
        region: key,
        signedIn: false,
        accounts: [],
        error: error instanceof Error ? error.message : String(error),
        pluginPath: this.pluginPath,
        models: this.cache[key]?.models || [],
      };
    }
  }

  async selectAccount(region, accountId) {
    await this.init();
    const store = this.store(region);
    store.selectAccount(accountId || "");
    this.cache[region === "global" ? "global" : "cn"] = { at: 0, models: [] };
  }

  async models(region, force = false) {
    await this.init();
    const key = region === "global" ? "global" : "cn";
    if (!this.ready) throw new Error(this.error || "WorkBuddy 插件尚未就绪");
    const cached = this.cache[key];
    if (!force && cached.models.length > 0 && Date.now() - cached.at < CACHE_TTL) {
      return { models: cached.models, source: "cache" };
    }
    const store = this.store(key);
    const credential = await store.resolve();
    let models;
    try {
      models = (await this.client.fetchModels(credential)).map(normalizeModel);
    } catch (error) {
      const fallback = this.fallbackModelsFor(key).map(normalizeModel);
      this.logger.warn?.("[workbuddy] model fetch failed, using fallback:", error?.message || error);
      models = fallback;
    }
    this.cache[key] = { at: Date.now(), models };
    return { models, source: "live" };
  }

  async chat(region, options) {
    await this.init();
    const key = region === "global" ? "global" : "cn";
    if (!this.ready) throw new WorkBuddyError(this.error || "WorkBuddy 插件尚未就绪", { status: 503 });
    const store = this.store(key);
    let credential = await store.resolve().catch((error) => {
      throw new WorkBuddyError(error instanceof Error ? error.message : String(error), {
        status: 401,
        kind: "auth",
        code: "WORKBUDDY_NOT_SIGNED_IN",
      });
    });

    const body = {
      model: options.model,
      messages: options.messages,
      stream: true,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    };
    if (options.topP !== undefined) body.top_p = options.topP;
    if (typeof options.reasoningEffort === "string" && options.reasoningEffort) {
      body.reasoning_effort = options.reasoningEffort;
    }
    const prepared = this.prepareChatBody(JSON.stringify(body));

    let result = await this.client.chatStream(credential, prepared, options.signal);
    if (!result.ok && (result.status === 401 || result.status === 403)) {
      try {
        store.invalidateScan();
        credential = await store.resolve();
        result = await this.client.chatStream(credential, prepared, options.signal);
      } catch {}
    }
    if (!result.ok) throw errorFromResult(result);

    const parsed = await parseSSE(result.response, {
      onDelta: options.onDelta,
      onReasoning: options.onReasoning,
      onUsage: options.onUsage,
    });
    return parsed;
  }

  clearCache() {
    this.cache = { cn: { at: 0, models: [] }, global: { at: 0, models: [] } };
  }
}
