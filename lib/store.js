import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
export const DATA_DIR = path.join(ROOT, "data");
export const PUBLIC_DIR = path.join(ROOT, "public");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const AVATAR_DIR = path.join(DATA_DIR, "avatars");
export const CONVERSATION_DIR = path.join(DATA_DIR, "conversations");
const INDEX_FILE = path.join(DATA_DIR, "index.json");
const KEY_FILE = path.join(DATA_DIR, ".master-key");

export const now = () => Date.now();
export const uid = (prefix = "") => `${prefix}${crypto.randomUUID().replace(/-/g, "").slice(0, 22)}`;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function ensureDirs() {
  await Promise.all([
    fs.mkdir(DATA_DIR, { recursive: true }),
    fs.mkdir(UPLOAD_DIR, { recursive: true }),
    fs.mkdir(AVATAR_DIR, { recursive: true }),
    fs.mkdir(CONVERSATION_DIR, { recursive: true }),
  ]);
}

async function writeAtomic(file, text) {
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, text, "utf8");
  await fs.rename(tmp, file);
}

let masterKeyCache;

async function masterKey() {
  if (masterKeyCache) return masterKeyCache;
  await ensureDirs();
  try {
    const raw = await fs.readFile(KEY_FILE, "utf8");
    const key = Buffer.from(raw.trim(), "base64");
    if (key.length === 32) {
      masterKeyCache = key;
      return key;
    }
  } catch {}
  const key = crypto.randomBytes(32);
  await fs.writeFile(KEY_FILE, key.toString("base64"), { encoding: "utf8", mode: 0o600 });
  masterKeyCache = key;
  return key;
}

export async function encryptSecret(value) {
  if (typeof value !== "string" || value === "") return "";
  const key = await masterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export async function decryptSecret(value) {
  if (typeof value !== "string" || !value.startsWith("v1.")) return "";
  try {
    const [, ivB64, tagB64, dataB64] = value.split(".");
    const key = await masterKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

const SYSTEM_PROMPTS = {
  deepseek:
    "你是 DeepSeek 娘，一个冷静、敏锐、说话简洁的 AI 助手。你擅长把复杂问题拆开讲清楚，偶尔带一点傲娇，但不刻薄。回答用中文，除非用户要求其他语言。不要自称模型，不要编造事实；不确定时直接说明。",
  glm:
    "你是 GLM 娘，博学、温柔、条理清晰。你喜欢先给结论，再给步骤；遇到不确定的信息会明确说明。回答用中文，语气自然，不说教，不堆砌术语。",
  hy3:
    "你是混元 Hy3 娘，元气、直接、好奇心强。你擅长快速给出可执行方案，也会主动提醒风险。回答用中文，简洁有力，别写空话。",
};

function defaultIndex() {
  return {
    version: 1,
    settings: {
      userName: "我",
      userAvatar: "/avatars/user.svg",
      sendKey: "enter",
      contextChars: 48000,
      historyLimit: 24,
      imageProvider: {
        kind: "pollinations",
        baseUrl: "",
        model: "flux",
        size: "768x768",
        apiKeyEnc: "",
      },
    },
    providers: [
      {
        id: "workbuddy-cn",
        kind: "workbuddy",
        region: "cn",
        name: "WorkBuddy 国内",
        enabled: true,
        accountId: "",
        models: [],
        modelsFetchedAt: 0,
        supportsVision: true,
        temperature: 0.7,
        maxTokens: 4096,
        createdAt: now(),
      },
      {
        id: "workbuddy-global",
        kind: "workbuddy",
        region: "global",
        name: "WorkBuddy 国际",
        enabled: true,
        accountId: "",
        models: [],
        modelsFetchedAt: 0,
        supportsVision: true,
        temperature: 0.7,
        maxTokens: 4096,
        createdAt: now(),
      },
    ],
    personas: [
      {
        id: "deepseek",
        name: "DeepSeek娘",
        avatar: "/avatars/deepseek.svg",
        accent: "#4D6BFE",
        systemPrompt: SYSTEM_PROMPTS.deepseek,
        providerId: "workbuddy-cn",
        modelId: "deepseek-v4.1-flash",
        builtin: true,
      },
      {
        id: "glm",
        name: "GLM娘",
        avatar: "/avatars/glm.svg",
        accent: "#8B5CF6",
        systemPrompt: SYSTEM_PROMPTS.glm,
        providerId: "workbuddy-cn",
        modelId: "glm-5.3-flash",
        builtin: true,
      },
      {
        id: "hy3",
        name: "Hy3娘",
        avatar: "/avatars/hy3.svg",
        accent: "#F97316",
        systemPrompt: SYSTEM_PROMPTS.hy3,
        providerId: "workbuddy-cn",
        modelId: "hy3",
        builtin: true,
      },
    ],
    conversations: [],
  };
}

export class Store {
  constructor() {
    this.index = null;
    this.queue = Promise.resolve();
  }

  async init() {
    await ensureDirs();
    try {
      this.index = JSON.parse(await fs.readFile(INDEX_FILE, "utf8"));
    } catch {
      this.index = defaultIndex();
      await this.persist();
    }
    this.normalize();
    return this;
  }

  normalize() {
    const base = defaultIndex();
    this.index.settings = { ...base.settings, ...(this.index.settings || {}) };
    this.index.settings.imageProvider = {
      ...base.settings.imageProvider,
      ...(this.index.settings.imageProvider || {}),
    };
    this.index.providers = Array.isArray(this.index.providers) ? this.index.providers : base.providers;
    this.index.personas = Array.isArray(this.index.personas) ? this.index.personas : base.personas;
    this.index.conversations = Array.isArray(this.index.conversations) ? this.index.conversations : [];
    // v0.1 seed avatars were .png placeholders before the built-in vector art landed.
    const seedMap = {
      "/avatars/deepseek.png": "/avatars/deepseek.svg",
      "/avatars/glm.png": "/avatars/glm.svg",
      "/avatars/hy3.png": "/avatars/hy3.svg",
    };
    for (const persona of this.index.personas) {
      if (seedMap[persona.avatar]) persona.avatar = seedMap[persona.avatar];
    }
  }

  enqueue(fn) {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }

  async persist() {
    await this.enqueue(async () => {
      await ensureDirs();
      await writeAtomic(INDEX_FILE, JSON.stringify(this.index, null, 2));
    });
  }

  settings() {
    return clone(this.index.settings);
  }

  async updateSettings(patch = {}) {
    const next = { ...this.index.settings, ...patch };
    if (patch.imageProvider) {
      const current = this.index.settings.imageProvider || {};
      const incoming = { ...patch.imageProvider };
      if (typeof incoming.apiKey === "string" && incoming.apiKey !== "") {
        incoming.apiKeyEnc = await encryptSecret(incoming.apiKey);
      }
      delete incoming.apiKey;
      next.imageProvider = { ...current, ...incoming };
    }
    this.index.settings = next;
    await this.persist();
    return this.settings();
  }

  providers() {
    return this.index.providers.map((p) => this.sanitizeProvider(p));
  }

  rawProvider(id) {
    return this.index.providers.find((p) => p.id === id);
  }

  sanitizeProvider(provider) {
    const p = clone(provider);
    const hasKey = Boolean(p.apiKeyEnc);
    delete p.apiKeyEnc;
    return { ...p, hasKey };
  }

  async upsertProvider(input, id = "") {
    const existing = id ? this.rawProvider(id) : undefined;
    const p = existing ? clone(existing) : {
      id: uid("p_"),
      createdAt: now(),
      models: [],
      modelsFetchedAt: 0,
      enabled: true,
      supportsVision: false,
      temperature: 0.7,
      maxTokens: 4096,
    };
    const allowed = [
      "name", "kind", "region", "baseUrl", "protocol", "organization", "apiVersion",
      "deployment", "model", "displayName", "contextWindow", "maxOutput", "temperature",
      "topP", "supportsVision", "supportsStreaming", "headers", "extraBody", "timeoutMs",
      "enabled", "accountId", "models", "modelsFetchedAt", "systemPrompt",
    ];
    for (const key of allowed) {
      if (input[key] !== undefined) p[key] = input[key];
    }
    if (typeof input.apiKey === "string" && input.apiKey !== "") {
      p.apiKeyEnc = await encryptSecret(input.apiKey);
    }
    if (input.clearKey) delete p.apiKeyEnc;
    p.name = String(p.name || "未命名接口").trim();
    p.kind = p.kind === "workbuddy" ? "workbuddy" : "openai";
    if (p.kind === "openai") {
      p.baseUrl = String(p.baseUrl || "").trim().replace(/\/+$/, "");
      p.protocol = p.protocol === "azure" ? "azure" : "openai";
      p.models = Array.isArray(p.models) ? p.models : [];
    } else {
      p.region = p.region === "global" ? "global" : "cn";
    }
    if (!existing) this.index.providers.push(p);
    await this.persist();
    return this.sanitizeProvider(p);
  }

  async deleteProvider(id) {
    this.index.providers = this.index.providers.filter((p) => p.id !== id);
    this.index.conversations = this.index.conversations.map((c) =>
      c.providerId === id ? { ...c, providerId: "", modelId: "" } : c,
    );
    await this.persist();
  }

  personas() {
    return clone(this.index.personas);
  }

  persona(id) {
    return clone(this.index.personas.find((p) => p.id === id));
  }

  async upsertPersona(input, id = "") {
    const existing = id ? this.index.personas.find((p) => p.id === id) : undefined;
    const p = existing ? clone(existing) : {
      id: uid("persona_"),
      builtin: false,
      createdAt: now(),
      accent: "#15AC70",
    };
    for (const key of ["name", "avatar", "accent", "systemPrompt", "providerId", "modelId"]) {
      if (input[key] !== undefined) p[key] = input[key];
    }
    p.name = String(p.name || "未命名人格").trim();
    if (!existing) this.index.personas.push(p);
    await this.persist();
    return clone(p);
  }

  async deletePersona(id) {
    const p = this.index.personas.find((x) => x.id === id);
    if (!p || p.builtin) return false;
    this.index.personas = this.index.personas.filter((x) => x.id !== id);
    this.index.conversations = this.index.conversations.map((c) =>
      c.personaId === id ? { ...c, personaId: "deepseek" } : c,
    );
    await this.persist();
    return true;
  }

  conversations() {
    return clone(this.index.conversations);
  }

  conversation(id) {
    return clone(this.index.conversations.find((c) => c.id === id));
  }

  async createConversation(input = {}) {
    const persona = this.index.personas.find((p) => p.id === input.personaId) || this.index.personas[0];
    const providerId = input.providerId || persona.providerId;
    const modelId = input.modelId || persona.modelId;
    const c = {
      id: uid("c_"),
      title: input.title || "新对话",
      personaId: persona.id,
      providerId,
      modelId,
      pinned: false,
      unread: 0,
      createdAt: now(),
      updatedAt: now(),
      lastPreview: "",
    };
    this.index.conversations.unshift(c);
    await this.persist();
    await this.saveMessages(c.id, []);
    return clone(c);
  }

  async updateConversation(id, patch = {}) {
    const c = this.index.conversations.find((x) => x.id === id);
    if (!c) return null;
    for (const key of ["title", "personaId", "providerId", "modelId", "pinned", "unread", "lastPreview"]) {
      if (patch[key] !== undefined) c[key] = patch[key];
    }
    c.updatedAt = now();
    await this.persist();
    return clone(c);
  }

  async deleteConversation(id) {
    this.index.conversations = this.index.conversations.filter((c) => c.id !== id);
    await this.persist();
    await fs.rm(path.join(CONVERSATION_DIR, `${id}.json`), { force: true });
  }

  messagesPath(id) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("invalid conversation id");
    return path.join(CONVERSATION_DIR, `${id}.json`);
  }

  async messages(id) {
    try {
      const doc = JSON.parse(await fs.readFile(this.messagesPath(id), "utf8"));
      return Array.isArray(doc.messages) ? doc.messages : [];
    } catch {
      return [];
    }
  }

  async saveMessages(id, messages) {
    await this.enqueue(async () => {
      await ensureDirs();
      await writeAtomic(this.messagesPath(id), JSON.stringify({ id, messages }, null, 2));
    });
  }

  async appendMessage(id, message) {
    const messages = await this.messages(id);
    messages.push(message);
    await this.saveMessages(id, messages);
    return message;
  }

  async replaceMessage(conversationId, message) {
    const messages = await this.messages(conversationId);
    const index = messages.findIndex((m) => m.id === message.id);
    if (index >= 0) messages[index] = message;
    else messages.push(message);
    await this.saveMessages(conversationId, messages);
    return message;
  }

  async exportData() {
    const conversations = [];
    for (const c of this.index.conversations) {
      conversations.push({ ...c, messages: await this.messages(c.id) });
    }
    const providers = this.index.providers.map((p) => {
      const clean = clone(p);
      delete clean.apiKeyEnc;
      return clean;
    });
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: this.index.settings,
      providers,
      personas: this.index.personas,
      conversations,
    };
  }
}
