import { decryptSecret } from "./store.js";

export class ProviderError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ProviderError";
    this.status = options.status || 502;
    this.code = options.code || "PROVIDER_ERROR";
    this.detail = options.detail || "";
  }
}

function base(provider) {
  return String(provider.baseUrl || "").trim().replace(/\/+$/, "");
}

function chatEndpoint(provider) {
  const url = base(provider);
  if (!url) throw new ProviderError("Base URL 为空", { status: 400 });
  if (provider.protocol === "azure") {
    const apiVersion = provider.apiVersion || "2024-10-21";
    const deployment = provider.deployment || provider.model || "";
    if (url.includes("/openai/deployments/")) {
      return `${url}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
    }
    return `${url}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  }
  if (/\/chat\/completions$/i.test(url)) return url;
  return `${url}/chat/completions`;
}

function modelsEndpoint(provider) {
  const url = base(provider);
  if (!url) throw new ProviderError("Base URL 为空", { status: 400 });
  if (/\/models$/i.test(url)) return url;
  return `${url}/models`;
}

function headersFor(provider, apiKey) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    ...(provider.headers && typeof provider.headers === "object" ? provider.headers : {}),
  };
  if (apiKey) {
    if (provider.protocol === "azure") headers["api-key"] = apiKey;
    else headers.Authorization = `Bearer ${apiKey}`;
  }
  if (provider.organization) headers["OpenAI-Organization"] = provider.organization;
  return headers;
}

async function readError(response) {
  let text = "";
  try {
    text = await response.text();
  } catch {}
  let message = text;
  try {
    const json = JSON.parse(text);
    message = json?.error?.message || json?.message || json?.detail || text;
  } catch {}
  return new ProviderError(
    String(message || `HTTP ${response.status}`).slice(0, 500),
    { status: response.status, code: `HTTP_${response.status}`, detail: text.slice(0, 1000) },
  );
}

function normalizeText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.text || part?.content || ""))
      .join("");
  }
  return "";
}

async function parseStream(response, handlers) {
  if (!response.body) return { content: "", reasoning: "", usage: null };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoning = "";
  let usage = null;

  const handle = (data) => {
    if (!data || data === "[DONE]") return;
    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }
    if (payload?.error) {
      throw new ProviderError(payload.error.message || "上游返回错误", { status: 502 });
    }
    const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
    const delta = choice?.delta || choice?.message || {};
    const reason = delta.reasoning_content ?? delta.reasoning;
    if (typeof reason === "string" && reason) {
      reasoning += reason;
      handlers.onReasoning?.(reason);
    }
    const text = normalizeText(delta.content);
    if (text) {
      content += text;
      handlers.onDelta?.(text);
    }
    if (payload.usage) {
      usage = payload.usage;
      handlers.onUsage?.(payload.usage);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let at;
    while ((at = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, at);
      buffer = buffer.slice(at + 2);
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) handle(data);
    }
  }
  if (buffer.trim()) {
    const data = buffer
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (data) handle(data);
  }
  return { content, reasoning, usage };
}

export async function chatOpenAI(provider, options) {
  const apiKey = provider.apiKeyEnc ? await decryptSecret(provider.apiKeyEnc) : "";
  const body = {
    model: options.model || provider.model,
    messages: options.messages,
    stream: true,
    temperature: options.temperature ?? provider.temperature ?? 0.7,
  };
  const maxKey = provider.maxTokensField === "max_completion_tokens" ? "max_completion_tokens" : "max_tokens";
  body[maxKey] = options.maxTokens ?? provider.maxTokens ?? 4096;
  if (options.topP !== undefined) body.top_p = options.topP;
  if (provider.extraBody && typeof provider.extraBody === "object") Object.assign(body, provider.extraBody);
  if (provider.protocol === "azure") delete body.model;

  const response = await fetch(chatEndpoint(provider), {
    method: "POST",
    headers: headersFor(provider, apiKey),
    body: JSON.stringify(body),
    signal: options.signal,
  }).catch((error) => {
    throw new ProviderError(`无法连接 ${provider.name || "接口"}：${error.message}`, {
      status: 0,
      code: "NETWORK",
    });
  });

  if (!response.ok) throw await readError(response);
  return parseStream(response, options);
}

export async function fetchModels(provider) {
  const apiKey = provider.apiKeyEnc ? await decryptSecret(provider.apiKeyEnc) : "";
  const response = await fetch(modelsEndpoint(provider), {
    headers: headersFor(provider, apiKey),
    signal: AbortSignal.timeout(20000),
  }).catch((error) => {
    throw new ProviderError(`无法连接 ${provider.name || "接口"}：${error.message}`, {
      status: 0,
      code: "NETWORK",
    });
  });
  if (!response.ok) throw await readError(response);
  const payload = await response.json();
  const list = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : Array.isArray(payload)
        ? payload
        : [];
  return list
    .map((item) => {
      if (typeof item === "string") return { id: item, name: item, vision: false };
      const id = item.id || item.name || item.model;
      if (!id) return null;
      const input = item.architecture?.input_modalities || item.input_modalities || [];
      return {
        id,
        name: item.display_name || item.name || id,
        contextWindow: item.context_length || item.context_window || item.max_context_length || 128000,
        maxTokens: item.max_output_tokens || item.max_tokens || 4096,
        vision: Array.isArray(input) && input.includes("image"),
        source: "live",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function testProvider(provider, timeoutMs = 25000) {
  const started = Date.now();
  let models = [];
  let modelsError = "";
  try {
    models = await fetchModels(provider);
  } catch (error) {
    modelsError = error instanceof Error ? error.message : String(error);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("test timeout")), timeoutMs);
  try {
    const model = provider.model || models[0]?.id;
    if (!model) throw new ProviderError("没有可用模型，请先填写模型 ID", { status: 400 });
    let text = "";
    await chatOpenAI(provider, {
      model,
      messages: [
        { role: "system", content: "You are a connectivity check. Reply with one short word." },
        { role: "user", content: "ping" },
      ],
      maxTokens: 8,
      temperature: 0,
      signal: controller.signal,
      onDelta: (chunk) => {
        text += chunk;
      },
    });
    return {
      ok: true,
      latencyMs: Date.now() - started,
      model,
      models: models.length,
      modelsError,
      sample: text.slice(0, 80),
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      model: provider.model || models[0]?.id || "",
      models: models.length,
      modelsError,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}
