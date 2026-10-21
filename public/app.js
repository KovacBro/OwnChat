/* OwnChat — zero-dependency frontend */
window.__errors = window.__errors || [];
window.addEventListener("error", (event) => {
  window.__errors.push({ message: event.message, source: event.filename, line: event.lineno });
});
window.addEventListener("unhandledrejection", (event) => {
  window.__errors.push({ message: String(event.reason?.message || event.reason), unhandled: true });
});
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  boot: null,
  settings: {},
  providers: [],
  personas: [],
  conversations: [],
  workbuddy: { cn: null, global: null },
  view: "chat",
  activeId: null,
  messages: {},
  loadingMessages: new Set(),
  streaming: {},
  search: "",
  filter: "active",
  searchResults: [],
  searching: false,
  searchTimer: null,
  theme: "system",
  update: null,
  attachments: [],
  emojiOpen: false,
  avatarStudio: null,
  pendingFiles: false,
  download: null,
  downloadTimer: null,
};

const PRESETS = {
  qiusuo: {
    name: "求索",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    role: "通用对话与写作",
    note: "中文强、按量计费、模型少而稳",
    platform: true,
  },
  bailian: {
    name: "百炼",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    role: "长上下文与多模态",
    note: "通义千问全系，长文档、图片、企业级稳定",
    platform: true,
  },
  fangzhou: {
    name: "方舟",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "",
    role: "豆包系列 · 角色与语音",
    note: "需先在方舟控制台创建推理接入点，模型名填 ep- 开头",
    platform: true,
  },
  openrouter: {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "",
    note: "部分 :free 模型；需注册 Key",
  },
  gemini: {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    model: "",
    note: "Flash 系列有免费额度；限流",
  },
  groq: {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "",
    note: "免费层；限流",
  },
  siliconflow: {
    name: "硅基流动",
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "",
    note: "注册赠送额度 / 部分免费模型",
  },
  zhipu: {
    name: "智谱 BigModel",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "",
    note: "GLM-Flash 系列曾有免费额度",
  },
  modelscope: {
    name: "ModelScope",
    baseUrl: "https://api-inference.modelscope.cn/v1",
    model: "",
    note: "每日免费调用额度",
  },
  mistral: {
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    model: "",
    note: "Experiment 免费计划；限流",
  },
  cerebras: {
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    model: "",
    note: "免费层；限流",
  },
  github: {
    name: "GitHub Models",
    baseUrl: "https://models.github.ai/inference",
    model: "",
    note: "GitHub Token；免费额度",
  },
  ollama: {
    name: "Ollama 本地",
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "",
    note: "本地模型，无需 Key",
  },
  custom: {
    name: "自定义接口",
    baseUrl: "",
    model: "",
    note: "任意 OpenAI 兼容 API",
  },
};

// 平台直连：独立于「娘」人格存在的三个预设入口
const PLATFORM_PRESETS = ["qiusuo", "bailian", "fangzhou"];

const AVATAR_PROMPTS = {
  deepseek: {
    name: "DeepSeek娘",
    short: "蓝发 · 鲸鱼发饰 · 冷静",
    avatar: "/avatars/deepseek.svg",
    prompt:
      "1girl, DeepSeek AI mascot, long deep navy-blue hair with cyan highlights, calm blue eyes, small whale hairpin, white futuristic hoodie with silver accents, intelligent calm expression, anime key visual, 2D cel shading, clean light background, upper body, looking at viewer, masterpiece, best quality, ultra-detailed",
    negative: "lowres, bad anatomy, bad hands, text, watermark, logo, photorealistic, 3d, realistic, extra fingers",
  },
  glm: {
    name: "GLM娘",
    short: "紫发 · 星光发饰 · 知性",
    avatar: "/avatars/glm.svg",
    prompt:
      "1girl, GLM AI mascot, lavender-purple twin-tail hair, violet eyes, glowing hexagon star hairpin, white and purple techwear jacket, gentle confident smile, anime key visual, 2D cel shading, clean light background, upper body, looking at viewer, masterpiece, best quality, ultra-detailed",
    negative: "lowres, bad anatomy, bad hands, text, watermark, logo, photorealistic, 3d, realistic, extra fingers",
  },
  hy3: {
    name: "Hy3娘",
    short: "橙发 · 混元环 · 元气",
    avatar: "/avatars/hy3.svg",
    prompt:
      "1girl, Hunyuan Hy3 AI mascot, coral-orange hair with flame-like tips, amber eyes, small glowing ring hair ornament, red and white sporty techwear, energetic smile, anime key visual, 2D cel shading, clean light background, upper body, looking at viewer, masterpiece, best quality, ultra-detailed",
    negative: "lowres, bad anatomy, bad hands, text, watermark, logo, photorealistic, 3d, realistic, extra fingers",
  },
  generic: {
    name: "通用 AI 娘",
    short: "原创 · 自定义发色 / 配饰",
    avatar: "/avatars/model.svg",
    prompt:
      "1girl, original AI mascot, futuristic techwear, glowing circuit hair ornament, expressive anime eyes, soft rim light, clean gradient background, anime key visual, 2D cel shading, upper body, looking at viewer, masterpiece, best quality, ultra-detailed",
    negative: "lowres, bad anatomy, bad hands, text, watermark, logo, photorealistic, 3d, realistic, extra fingers",
  },
};

const EMOJIS = {
  常用: ["😀","😄","😁","😊","🙂","😉","😍","🥰","😘","😎","🤔","🫡","😴","😭","😤","🥹","😅","😂","🤣","🙃","😇","🤯","😱","🥳"],
  表情: ["🤗","🤭","🫢","🤫","😶","😐","😑","😬","🙄","😯","😲","😳","🥺","😢","😥","😰","😋","😛","😜","🤪","😝","🤤","😷","🤒"],
  手势: ["👍","👎","👌","✌️","🤞","🤟","🤘","👏","🙌","🙏","🤝","💪","👋","🖐️","✋","🫶","👉","👈","👆","👇","☝️","✊","👊","🫰"],
  符号: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","✨","⭐","🌟","🔥","🎉","🎊","💯","✅","❌","⚠️","💡","📌","🎵","☕","🌙"],
};

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initialOf(name) {
  return String(name || "?").trim().slice(0, 1) || "?";
}

function avatarHTML(src, name, cls = "avatar") {
  const initial = esc(initialOf(name));
  return `<div class="${cls}"><img src="${esc(src || "")}" alt="" loading="lazy" onerror="this.style.display='none';this.parentNode.classList.add('fallback');this.parentNode.textContent='${initial}'"></div>`;
}

function modelOf(provider, modelId) {
  return (provider?.models || []).find((m) => m.id === modelId);
}

function modelName(provider, modelId) {
  return modelOf(provider, modelId)?.name || modelId || "未选择模型";
}

function personaForModel(modelId) {
  const id = String(modelId || "").toLowerCase();
  if (id.startsWith("glm-")) return "glm";
  if (id.startsWith("deepseek-")) return "deepseek";
  if (id.startsWith("hy3") || id.startsWith("hy4") || id.startsWith("space-bunny")) return "hy3";
  return "";
}

function providerOf(id) {
  return state.providers.find((p) => p.id === id);
}

function personaOf(id) {
  return state.personas.find((p) => p.id === id) || state.personas[0];
}

function convOf(id) {
  return state.conversations.find((c) => c.id === id);
}

function providerReady(provider) {
  if (!provider) return false;
  if (provider.kind === "workbuddy") return Boolean(provider.status?.signedIn);
  return Boolean(provider.baseUrl);
}

function providerStatusText(provider) {
  if (!provider) return "未配置";
  if (provider.kind === "workbuddy") {
    if (!provider.status) return "检测中…";
    if (!provider.status.available) return "插件不可用";
    if (!provider.status.signedIn) return "未登录";
    return `已连接 · ${provider.status.account?.name || "WorkBuddy"}`;
  }
  return provider.enabled === false ? "已停用" : "已配置";
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "昨天";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatUsage(usage) {
  if (!usage || typeof usage !== "object") return "";
  const prompt = Number(usage.prompt_tokens ?? usage.prompt ?? 0);
  const completion = Number(usage.completion_tokens ?? usage.completion ?? 0);
  if (!prompt && !completion) return "";
  if (prompt && completion) return `↑${prompt} ↓${completion}`;
  return `${Number(usage.total_tokens) || prompt + completion} tokens`;
}

function plainText(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " [代码] ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function md(text) {
  let value = esc(text || "");
  const blocks = [];
  value = value.replace(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    const index = blocks.push(`<pre><code>${code.replace(/\n$/, "")}</code></pre>`) - 1;
    return `\u0000${index}\u0000`;
  });
  value = value.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  value = value.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  value = value.replace(/\u0000(\d+)\u0000/g, (_m, index) => blocks[Number(index)] || "");
  return value;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: options.body ? { "Content-Type": "application/json", ...(options.headers || {}) } : options.headers,
    ...options,
  });
  const type = response.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof data === "object" ? data.error || data.message : data;
    throw new Error(message || `请求失败 (${response.status})`);
  }
  return data;
}

function toast(message, kind = "") {
  const root = $("#toastRoot");
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(4px)";
    el.style.transition = "all .2s";
    setTimeout(() => el.remove(), 220);
  }, 3200);
}

function openModal({ title, sub = "", body, foot = "", wide = false, narrow = false, onMount }) {
  const root = $("#modalRoot");
  root.innerHTML = `
    <div class="modal-mask" data-modal-mask>
      <div class="modal ${wide ? "wide" : ""} ${narrow ? "narrow" : ""}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div><h2>${esc(title)}</h2>${sub ? `<div class="modal-sub">${esc(sub)}</div>` : ""}</div>
          <button class="icon-btn" data-close-modal title="关闭"><svg><use href="#i-close"/></svg></button>
        </div>
        <div class="modal-body" id="modalBody">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ""}
      </div>
    </div>`;
  root.querySelector("[data-close-modal]").onclick = closeModal;
  root.querySelector("[data-modal-mask]").addEventListener("mousedown", (event) => {
    if (event.target === event.currentTarget) closeModal();
  });
  onMount?.(root);
}

function closeModal() {
  $("#modalRoot").innerHTML = "";
}

function closeEmoji() {
  state.emojiOpen = false;
  $("#emojiRoot").innerHTML = "";
}

/* ---------- boot ---------- */
async function init() {
  const params = new URLSearchParams(location.search);
  if (params.has("app")) document.body.classList.add("in-app");
  const initialView = params.get("view");
  if (initialView && ["chat", "personas", "providers", "settings"].includes(initialView)) {
    state.view = initialView;
  }
  bindGlobal();
  applyTheme();
  try {
    const boot = await api("/api/bootstrap");
    state.boot = boot;
    state.settings = boot.settings || {};
    state.providers = boot.providers || [];
    state.personas = boot.personas || [];
    state.conversations = boot.conversations || [];
    state.workbuddy = boot.workbuddy || { cn: null, global: null };
    state.download = boot.download || null;
    if (state.conversations.length) {
      state.activeId = state.conversations[0].id;
      await loadMessages(state.activeId);
    }
    applyTheme();
    renderAll();
    setTimeout(refreshWorkBuddyModels, 400);
    setTimeout(() => checkForUpdates(false), 1800);
  } catch (error) {
    $("#main").innerHTML = `<div class="empty-chat"><div class="notice red">加载失败：${esc(error.message)}</div></div>`;
  }
  setInterval(() => {
    fetch("/api/ping", { method: "POST" }).catch(() => {});
  }, 5000);
  window.addEventListener("beforeunload", () => {
    navigator.sendBeacon?.("/api/app/closed", "1");
  });
}

function bindGlobal() {
  $$(".rail-btn[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      if (state.view === "chat" && !state.activeId && state.conversations.length) {
        state.activeId = state.conversations[0].id;
        loadMessages(state.activeId).then(renderAll);
      }
      renderAll();
    });
  });
  $("#newChatBtn").addEventListener("click", openNewChat);
  $("#searchInput").addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(runSearch, 220);
    renderSidebar();
  });
  $$("#convTabs [data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      state.search = "";
      const input = $("#searchInput");
      if (input) input.value = "";
      renderSidebar();
    });
  });
  $("#meBtn").addEventListener("click", openSettings);
  $("#aboutBtn").addEventListener("click", openAbout);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
      closeEmoji();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
      event.preventDefault();
      openNewChat();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      $("#searchInput").focus();
    }
  });
  $("#fileInput").addEventListener("change", async (event) => {
    await addFiles([...event.target.files]);
    event.target.value = "";
  });
}

function renderAll() {
  renderRail();
  renderSidebar();
  renderMain();
  renderSidebarFoot();
}

function renderRail() {
  $$(".rail-btn[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
  $("#meAvatar").src = state.settings.userAvatar || "/avatars/user.svg";
  $("#meAvatar").onerror = () => {
    $("#meAvatar").style.display = "none";
  };
}

function renderSidebar() {
  const root = $("#convList");
  $$("#convTabs [data-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });
  if (state.search) return renderSearchResults();
  const showArchived = state.filter === "archived";
  const filtered = state.conversations
    .filter((c) => (showArchived ? Boolean(c.archived) : !c.archived))
    .sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  if (filtered.length === 0) {
    root.innerHTML = `<div class="empty-list">${showArchived ? "还没有归档的会话" : "还没有会话<br>点击右上角 ＋ 开始"}</div>`;
    return;
  }
  root.innerHTML = filtered
    .map((c) => {
      const persona = personaOf(c.personaId);
      const provider = providerOf(c.providerId);
      const active = c.id === state.activeId && state.view === "chat";
      const streaming = Boolean(state.streaming[c.id]);
      return `
        <div class="conv ${active ? "active" : ""}" data-conv-id="${c.id}">
          ${avatarHTML(persona?.avatar, persona?.name, "avatar")}
          <div class="conv-main">
            <div class="conv-top">
              <span class="conv-name">${esc(c.title || "新对话")}</span>
              <span class="conv-time">${esc(formatTime(c.updatedAt))}</span>
            </div>
            <div class="preview">
              ${streaming ? `<span class="chip">生成中</span>` : provider ? `<span class="chip">${esc(modelName(provider, c.modelId))}</span>` : ""}
              <span class="preview-text">${esc(plainText(c.lastPreview) || "开始聊天…")}</span>
              ${c.unread ? '<i class="unread-dot"></i>' : ""}
            </div>
          </div>
        </div>`;
    })
    .join("");
  $$("[data-conv-id]", root).forEach((el) => {
    el.addEventListener("click", () => selectConversation(el.dataset.convId));
    el.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      selectConversation(el.dataset.convId, false);
      openConversationMenu(el.dataset.convId);
    });
  });
}

function renderSidebarFoot() {
  const root = $("#sidebarFoot");
  const cn = state.workbuddy?.cn;
  if (cn?.signedIn) {
    root.innerHTML = `<i class="dot"></i><span>${esc(cn.account?.name || "已登录")}${cn.account?.domain ? ` · ${esc(cn.account.domain)}` : ""}</span><button data-detect-wb>刷新</button>`;
    $("[data-detect-wb]", root).onclick = detectWorkBuddy;
    return;
  }
  const ready = state.providers.filter((provider) => provider.enabled !== false && providerReady(provider));
  const label = ready.length
    ? `${ready[0].name} · ${(ready[0].models || []).length} 个模型`
    : "还没有可用接口";
  root.innerHTML = `<i class="dot ${ready.length ? "" : "off"}"></i><span>${esc(label)}</span><button data-detect-wb>刷新</button>`;
  $("[data-detect-wb]", root).onclick = detectWorkBuddy;
}

async function detectWorkBuddy() {
  try {
    const data = await api("/api/workbuddy/status");
    state.workbuddy = data;
    toast(data.cn?.signedIn ? `WorkBuddy 已连接：${data.cn.account?.name || ""}` : "未检测到 WorkBuddy 登录态", data.cn?.signedIn ? "ok" : "err");
    const boot = await api("/api/bootstrap");
    state.providers = boot.providers || [];
    renderAll();
  } catch (error) {
    toast(error.message, "err");
  }
}

async function refreshWorkBuddyModels() {
  for (const provider of state.providers.filter((p) => p.kind === "workbuddy" && p.status?.signedIn)) {
    try {
      const result = await api("/api/workbuddy/models", {
        method: "POST",
        body: JSON.stringify({ region: provider.region, refresh: false }),
      });
      provider.models = result.models || provider.models;
      provider.modelsFetchedAt = Date.now();
    } catch {}
  }
  renderMain();
  renderSidebar();
}

/* ---------- navigation ---------- */
async function selectConversation(id, rerender = true) {
  if (!id) return;
  state.view = "chat";
  state.activeId = id;
  state.attachments = [];
  closeEmoji();
  if (!state.messages[id]) await loadMessages(id);
  if (state.conversations.find((c) => c.id === id)?.unread) {
    const c = convOf(id);
    c.unread = 0;
    api(`/api/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ unread: 0 }) }).catch(() => {});
  }
  if (rerender) renderAll();
}

async function loadMessages(id) {
  if (state.loadingMessages.has(id)) return;
  state.loadingMessages.add(id);
  try {
    const data = await api(`/api/conversations/${id}/messages`);
    state.messages[id] = data.messages || [];
  } catch (error) {
    toast(`读取消息失败：${error.message}`, "err");
    state.messages[id] = [];
  } finally {
    state.loadingMessages.delete(id);
  }
}

/* ---------- main render ---------- */
function renderMain() {
  if (state.view === "providers") return renderProviders();
  if (state.view === "personas") return renderPersonas();
  if (state.view === "settings") return renderSettings();
  renderChat();
}

function renderEmptyChat() {
  const cards = state.personas
    .filter((p) => !p.hidden)
    .slice(0, 6)
    .map((p) => {
      const provider = providerOf(p.providerId);
      return `
        <button class="persona-start" data-start-persona="${p.id}">
          ${avatarHTML(p.avatar, p.name, "avatar")}
          <strong>${esc(p.name)}</strong>
          <span>${esc(modelName(provider, p.modelId))}${provider?.kind === "workbuddy" && !provider.status?.signedIn ? " · 未连接" : ""}</span>
        </button>`;
    })
    .join("");
  const online = state.workbuddy?.cn?.signedIn;
  $("#main").innerHTML = `
    <div class="empty-chat">
      <div class="empty-logo"><svg><use href="#i-chat"/></svg></div>
      <h1>OwnChat</h1>
      <p>每个聊天窗，都可以是不同的大模型。</p>
      <div class="persona-start-grid">${cards}</div>
      <div class="empty-hint">
        <span><kbd>Enter</kbd> 发送</span>
        <span><kbd>Shift</kbd> + <kbd>Enter</kbd> 换行</span>
        <span><kbd>Ctrl</kbd> + <kbd>N</kbd> 新对话</span>
      </div>
      ${online ? "" : `<div class="notice" style="margin-top:20px;max-width:560px">WorkBuddy 尚未连接。可以到「API 接口」检查本地 WorkBuddy，或添加一个免费 / 自定义接口。</div>`}
    </div>`;
  $$("[data-start-persona]").forEach((button) => {
    button.onclick = () => createConversation(button.dataset.startPersona);
  });
}

function renderChat() {
  if (!state.activeId) return renderEmptyChat();
  const conversation = convOf(state.activeId);
  if (!conversation) return renderEmptyChat();
  const persona = personaOf(conversation.personaId);
  const provider = providerOf(conversation.providerId);
  const messages = state.messages[conversation.id] || [];
  const streaming = state.streaming[conversation.id];
  const online = providerReady(provider);
  $("#main").innerHTML = `
    <header class="chat-head">
      ${avatarHTML(persona?.avatar, persona?.name, "avatar")}
      <div class="head-copy">
        <div class="head-name">${esc(persona?.name || "AI")}</div>
        <div class="head-sub">
          <span class="dot" style="background:${online ? "var(--accent)" : "#c7c7cc"}"></span>
          <span>${esc(provider ? provider.name : "未绑定接口")}</span>
        </div>
      </div>
      <button class="model-pill" data-model-picker title="切换模型">
        ${esc(modelName(provider, conversation.modelId))}
        <svg><use href="#i-chevron"/></svg>
      </button>
      <span class="conn ${online ? "" : "off"}"><i></i>${online ? "已连接" : "未连接"}</span>
      <div class="head-actions">
        <button class="icon-btn" data-pin-conv title="置顶"><svg><use href="#i-pin"/></svg></button>
        <button class="icon-btn" data-conv-menu title="更多"><svg><use href="#i-more"/></svg></button>
      </div>
    </header>
    <div class="chat-body">
      <div class="messages" id="messages">${renderMessageList(messages, streaming, persona)}</div>
      <div class="composer-wrap">
        <div class="composer" id="composer">
          <div class="attachments" id="attachments"></div>
          <textarea id="composerInput" placeholder="输入消息，Enter 发送，Shift+Enter 换行">${esc(state.draft?.[conversation.id] || "")}</textarea>
          <div class="composer-tools">
            <button class="tool-btn" data-emoji-btn title="Emoji"><svg><use href="#i-smile"/></svg></button>
            <button class="tool-btn" data-image-btn title="图片"><svg><use href="#i-image"/></svg></button>
            <button class="tool-btn" data-file-btn title="文件（即将支持）"><svg><use href="#i-paper"/></svg></button>
            <button class="tool-btn" data-snip-btn title="截图（即将支持）"><svg><use href="#i-scissor"/></svg></button>
            ${streaming
              ? `<button class="send-btn stop" data-stop-btn><svg><use href="#i-stop"/></svg>停止</button>`
              : `<button class="send-btn" data-send-btn><svg><use href="#i-send"/></svg>发送</button>`}
          </div>
        </div>
      </div>
    </div>`;
  bindChatEvents(conversation, persona, provider);
  renderAttachments();
  requestAnimationFrame(scrollMessagesBottom);
}

function renderMessageList(messages, streaming, persona) {
  if (messages.length === 0 && !streaming) {
    return `<div class="empty-list" style="margin:auto;max-width:380px;border:0;background:transparent">和 ${esc(persona?.name || "AI")} 打个招呼吧。<br><span class="muted">背后是真实的大模型，不是预设话术。</span></div>`;
  }
  let lastTime = 0;
  return messages
    .map((message, index) => {
      if (message.kind === "divider") return `<div class="divider">${esc(message.content)}</div>`;
      const isUser = message.role === "user";
      const time = message.createdAt || 0;
      const showTime = time - lastTime > 5 * 60 * 1000;
      lastTime = time;
      const isStreaming = streaming && message.id === streaming.tempId;
      return `${showTime && time ? `<div class="time-sep">${esc(formatDateTime(time))}</div>` : ""}
        ${renderMessage(message, isUser, persona, isStreaming, index === messages.length - 1)}`;
    })
    .join("");
}

function renderMessage(message, isUser, persona, isStreaming, isLast) {
  const name = isUser ? state.settings.userName || "我" : persona?.name || "AI";
  const avatar = isUser ? state.settings.userAvatar || "/avatars/user.svg" : persona?.avatar;
  const content = isStreaming ? message.content : message.content;
  const error = message.status === "error";
  const stopped = message.status === "stopped";
  const bubbleClass = error ? "bubble error" : "bubble";
  const reasoning = message.reasoning
    ? `<details class="reasoning"><summary>思考过程</summary><pre>${esc(message.reasoning)}</pre></details>`
    : "";
  const typing = isStreaming && !content && !message.reasoning;
  const images = (message.images || [])
    .map((image) => `<img src="${esc(image.url)}" alt="" loading="lazy">`)
    .join("");
  const actions = isStreaming ? "" : isUser
    ? `<div class="msg-actions"><button data-copy-message="${message.id}"><svg><use href="#i-copy"/></svg>复制</button></div>`
    : `<div class="msg-actions">
         <button data-copy-message="${message.id}"><svg><use href="#i-copy"/></svg>复制</button>
         ${isLast || error ? `<button data-retry-message="${message.id}"><svg><use href="#i-refresh"/></svg>重试</button>` : ""}
       </div>`;
  const usageText = isUser || state.settings.showTokenUsage === false ? "" : formatUsage(message.usage);
  const errorText = error
    ? `<div class="bubble error">${esc(message.error || "生成失败")}${
        message.diagnostic
          ? `<div class="diag"><button data-copy-diag="${esc(message.diagnostic)}" title="复制诊断码">${esc(message.diagnostic)}</button></div>`
          : ""
      }${message.content ? `<div style="margin-top:6px;color:#555;white-space:pre-wrap">${esc(message.content)}</div>` : ""}</div>`
    : `<div class="${bubbleClass}"><span class="bubble-content">${md(content)}</span>${images}${typing ? `<span class="typing"><i></i><i></i><i></i></span>` : ""}${isStreaming && content ? '<span class="cursor"></span>' : ""}${stopped ? `<div class="muted small" style="margin-top:4px">已停止生成</div>` : ""}</div>`;
  const trimNote = Number(message.truncated) > 0
    ? `<div class="trim-note">已省略较早的 ${Number(message.truncated)} 条消息（超出当前模型的上下文预算）</div>`
    : "";
  return `
    <div class="message ${isUser ? "user" : "ai"}" data-message-id="${message.id}">
      ${avatarHTML(avatar, name, "avatar")}
      <div class="msg-body">
        <div class="msg-meta">${esc(name)}${isUser ? "" : ` · ${esc(message.modelId || "")}`}${usageText ? ` · <span class="usage">${esc(usageText)}</span>` : ""}</div>
        ${reasoning}
        ${errorText}
        ${trimNote}
        ${actions}
      </div>
    </div>`;
}

function bindChatEvents(conversation, persona, provider) {
  const input = $("#composerInput");
  const send = $("[data-send-btn]");
  const stop = $("[data-stop-btn]");
  const resize = () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 170)}px`;
  };
  input.addEventListener("input", () => {
    state.draft = state.draft || {};
    state.draft[conversation.id] = input.value;
    resize();
  });
  input.addEventListener("keydown", (event) => {
    const enterSends = (state.settings.sendKey || "enter") === "enter";
    if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && enterSends) {
      event.preventDefault();
      sendMessage();
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      sendMessage();
    }
  });
  input.addEventListener("paste", async (event) => {
    const items = [...(event.clipboardData?.items || [])];
    const files = items.filter((item) => item.type.startsWith("image/")).map((item) => item.getAsFile()).filter(Boolean);
    if (files.length) {
      event.preventDefault();
      await addFiles(files);
    }
  });
  const composer = $("#composer");
  composer.addEventListener("dragover", (event) => {
    event.preventDefault();
    composer.style.borderColor = "#9eddbd";
  });
  composer.addEventListener("dragleave", () => {
    composer.style.borderColor = "";
  });
  composer.addEventListener("drop", async (event) => {
    event.preventDefault();
    composer.style.borderColor = "";
    const files = [...(event.dataTransfer?.files || [])].filter((file) => file.type.startsWith("image/"));
    await addFiles(files);
  });
  $("[data-emoji-btn]")?.addEventListener("click", (event) => openEmoji(event.currentTarget));
  $("[data-image-btn]")?.addEventListener("click", () => $("#fileInput").click());
  $("[data-file-btn]")?.addEventListener("click", () => toast("文件发送将在后续版本开放"));
  $("[data-snip-btn]")?.addEventListener("click", () => toast("截图发送将在后续版本开放"));
  send?.addEventListener("click", sendMessage);
  stop?.addEventListener("click", () => stopStreaming(conversation.id));
  $("[data-model-picker]")?.addEventListener("click", openModelPicker);
  $(".chat-head .avatar")?.addEventListener("click", () => openAvatarStudio(persona));
  $(".head-name")?.addEventListener("click", () => openPersonaForm(persona));
  $("[data-pin-conv]")?.addEventListener("click", async () => {
    const c = convOf(conversation.id);
    await api(`/api/conversations/${conversation.id}`, { method: "PATCH", body: JSON.stringify({ pinned: !c.pinned }) });
    c.pinned = !c.pinned;
    renderSidebar();
    toast(c.pinned ? "已置顶" : "已取消置顶", "ok");
  });
  $("[data-conv-menu]")?.addEventListener("click", () => openConversationMenu(conversation.id));
  $("#messages")?.addEventListener("click", async (event) => {
    const copy = event.target.closest("[data-copy-message]");
    if (copy) {
      const message = (state.messages[conversation.id] || []).find((m) => m.id === copy.dataset.copyMessage);
      if (message) {
        await navigator.clipboard?.writeText(message.content || "").catch(() => {});
        toast("已复制", "ok");
      }
      return;
    }
    const retry = event.target.closest("[data-retry-message]");
    if (retry) return retryLast(conversation.id);
    const diag = event.target.closest("[data-copy-diag]");
    if (diag) {
      await navigator.clipboard?.writeText(diag.dataset.copyDiag || "").catch(() => {});
      toast("诊断码已复制", "ok");
    }
  });
  resize();
}

function renderAttachments() {
  const root = $("#attachments");
  if (!root) return;
  if (state.attachments.length === 0) {
    root.innerHTML = "";
    return;
  }
  root.innerHTML = state.attachments
    .map((image, index) => `
      <div class="attachment">
        <img src="${esc(image.url)}" alt="">
        <button data-remove-attachment="${index}" title="移除"><svg><use href="#i-close"/></svg></button>
      </div>`)
    .join("");
  $$("[data-remove-attachment]", root).forEach((button) => {
    button.onclick = () => {
      state.attachments.splice(Number(button.dataset.removeAttachment), 1);
      renderAttachments();
    };
  });
}

function scrollMessagesBottom() {
  const el = $("#messages");
  if (el) el.scrollTop = el.scrollHeight;
}

/* ---------- sending ---------- */
async function sendMessage() {
  const conversation = convOf(state.activeId);
  if (!conversation) return;
  if (state.streaming[conversation.id]) return;
  const input = $("#composerInput");
  const content = (input?.value || "").trim();
  const images = state.attachments.slice();
  if (!content && images.length === 0) return;
  if (input) {
    input.value = "";
    input.style.height = "56px";
  }
  if (state.draft) state.draft[conversation.id] = "";
  state.attachments = [];
  renderAttachments();

  const tempUser = {
    id: `temp-user-${Date.now()}`,
    role: "user",
    kind: "text",
    content,
    images,
    createdAt: Date.now(),
    status: "complete",
  };
  const tempAssistant = {
    id: `temp-ai-${Date.now()}`,
    role: "assistant",
    kind: "text",
    content: "",
    reasoning: "",
    images: [],
    providerId: conversation.providerId,
    modelId: conversation.modelId,
    createdAt: Date.now(),
    status: "streaming",
  };
  state.messages[conversation.id] = [...(state.messages[conversation.id] || []), tempUser, tempAssistant];
  state.streaming[conversation.id] = {
    tempId: tempAssistant.id,
    content: "",
    reasoning: "",
    controller: new AbortController(),
    userMessage: tempUser,
  };
  renderChat();
  renderSidebar();
  await streamIntoConversation(conversation, {
    content,
    images,
    tempAssistant,
  });
}

async function streamIntoConversation(conversation, { content, images, tempAssistant }) {
  const runtime = state.streaming[conversation.id];
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: conversation.id,
        content,
        images,
      }),
      signal: runtime.controller.signal,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `请求失败 (${response.status})`);
    }
    await readSSE(response, (event, data) => {
      if (event === "meta") {
        tempAssistant.providerId = data.providerId;
        tempAssistant.modelId = data.modelId;
      } else if (event === "delta") {
        runtime.content += data.text || "";
        tempAssistant.content = runtime.content;
        patchStreamingBubble(conversation.id, tempAssistant, false);
      } else if (event === "reasoning") {
        runtime.reasoning += data.text || "";
        tempAssistant.reasoning = runtime.reasoning;
        patchStreamingBubble(conversation.id, tempAssistant, false);
      } else if (event === "usage") {
        tempAssistant.usage = data;
      } else if (event === "notice") {
        if (data?.type === "trimmed") tempAssistant.truncated = Number(data.dropped) || 0;
      } else if (event === "error") {
        tempAssistant.diagnostic = data.diagnostic || "";
        throw new Error(data.message || "生成失败");
      } else if (event === "done") {
        finishStreaming(conversation.id, tempAssistant.id, data.message);
      }
    });
    if (state.streaming[conversation.id]) {
      finishStreaming(conversation.id, tempAssistant.id, { ...tempAssistant, status: "complete" });
    }
  } catch (error) {
    if (runtime.controller.signal.aborted) {
      tempAssistant.status = "stopped";
      tempAssistant.content = runtime.content;
      tempAssistant.reasoning = runtime.reasoning;
      finishStreaming(conversation.id, tempAssistant.id, tempAssistant, true);
    } else {
      tempAssistant.status = "error";
      tempAssistant.content = runtime.content;
      tempAssistant.reasoning = runtime.reasoning;
      tempAssistant.error = error.message;
      finishStreaming(conversation.id, tempAssistant.id, tempAssistant, false);
      toast(error.message, "err");
    }
  }
}

function patchStreamingBubble(conversationId, tempAssistant, scroll = true) {
  const el = document.querySelector(`[data-message-id="${tempAssistant.id}"]`);
  if (!el) {
    renderChat();
    return;
  }
  const body = el.querySelector(".msg-body");
  const content = tempAssistant.content || "";
  const reasoning = tempAssistant.reasoning || "";
  let html = "";
  if (reasoning) html += `<details class="reasoning" ${content ? "" : "open"}><summary>思考过程</summary><pre>${esc(reasoning)}</pre></details>`;
  html += `<div class="bubble"><span class="bubble-content">${md(content)}</span>${content ? '<span class="cursor"></span>' : `<span class="typing"><i></i><i></i><i></i></span>`}</div>`;
  const meta = body.querySelector(".msg-meta");
  const oldReasoning = body.querySelector(".reasoning");
  if (oldReasoning) oldReasoning.remove();
  const oldBubble = body.querySelector(".bubble");
  if (oldBubble) oldBubble.remove();
  meta?.insertAdjacentHTML("afterend", html);
  if (scroll) scrollMessagesBottom();
}

function finishStreaming(conversationId, tempId, finalMessage, refresh = false) {
  const runtime = state.streaming[conversationId];
  const conversation = convOf(conversationId);
  delete state.streaming[conversationId];
  const list = state.messages[conversationId] || [];
  const index = list.findIndex((m) => m.id === tempId);
  if (index >= 0) {
    if (finalMessage?.id && finalMessage.id !== tempId) list.splice(index, 1, finalMessage);
    else list.splice(index, 1, finalMessage);
  }
  if (conversation) {
    conversation.lastPreview = plainText(finalMessage?.content || "").slice(0, 70) || (finalMessage?.status === "stopped" ? "已停止生成" : conversation.lastPreview);
    conversation.updatedAt = Date.now();
    if (conversation.title === "新对话" && runtime?.userMessage?.content) {
      conversation.title = runtime.userMessage.content.replace(/\s+/g, " ").slice(0, 18);
    }
  }
  if (refresh) {
    loadMessages(conversationId).then(() => {
      renderChat();
      renderSidebar();
    });
  } else {
    renderChat();
    renderSidebar();
  }
}

function stopStreaming(conversationId) {
  const runtime = state.streaming[conversationId];
  if (runtime) {
    runtime.controller.abort();
  }
}

async function retryLast(conversationId) {
  if (state.streaming[conversationId]) return;
  const list = state.messages[conversationId] || [];
  const lastUser = [...list].reverse().find((m) => m.role === "user");
  if (!lastUser) return;
  const tempAssistant = {
    id: `temp-ai-${Date.now()}`,
    role: "assistant",
    kind: "text",
    content: "",
    reasoning: "",
    images: [],
    providerId: convOf(conversationId)?.providerId,
    modelId: convOf(conversationId)?.modelId,
    createdAt: Date.now(),
    status: "streaming",
  };
  state.messages[conversationId] = list.filter((m) => !(m.role === "assistant" && m.status === "error"));
  state.messages[conversationId].push(tempAssistant);
  state.streaming[conversationId] = {
    tempId: tempAssistant.id,
    content: "",
    reasoning: "",
    controller: new AbortController(),
    userMessage: lastUser,
  };
  renderChat();
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, retry: true }),
    signal: state.streaming[conversationId].controller.signal,
  }).catch((error) => {
    toast(error.message, "err");
    return null;
  });
  if (!response?.ok) {
    const data = await response?.json().catch(() => ({}));
    const runtime = state.streaming[conversationId];
    delete state.streaming[conversationId];
    state.messages[conversationId] = (state.messages[conversationId] || []).filter((m) => m.id !== runtime?.tempId);
    toast(data?.error || "重试失败", "err");
    renderChat();
    return;
  }
  const runtime = state.streaming[conversationId];
  await readSSE(response, (event, data) => {
    if (event === "delta") {
      runtime.content += data.text || "";
      tempAssistant.content = runtime.content;
      patchStreamingBubble(conversationId, tempAssistant);
    } else if (event === "reasoning") {
      runtime.reasoning += data.text || "";
      tempAssistant.reasoning = runtime.reasoning;
      patchStreamingBubble(conversationId, tempAssistant);
    } else if (event === "usage") {
      tempAssistant.usage = data;
    } else if (event === "notice") {
      if (data?.type === "trimmed") tempAssistant.truncated = Number(data.dropped) || 0;
    } else if (event === "error") {
      tempAssistant.status = "error";
      tempAssistant.error = data.message;
      tempAssistant.diagnostic = data.diagnostic || "";
      finishStreaming(conversationId, tempAssistant.id, tempAssistant, true);
    } else if (event === "done") {
      finishStreaming(conversationId, tempAssistant.id, data.message);
    }
  });
  if (state.streaming[conversationId]) {
    finishStreaming(conversationId, tempAssistant.id, { ...tempAssistant, status: "complete" });
  }
}

async function readSSE(response, handler) {
  if (!response.body) throw new Error("浏览器不支持流式响应");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let at;
    while ((at = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, at);
      buffer = buffer.slice(at + 2);
      const event = /^event:\s*(.+)$/m.exec(block)?.[1]?.trim();
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!event || !data) continue;
      let payload;
      try {
        payload = JSON.parse(data);
      } catch {
        payload = data;
      }
      await handler(event, payload);
    }
  }
}

/* ---------- model picker ---------- */
function openModelPicker() {
  const conversation = convOf(state.activeId);
  if (!conversation) return;
  const groups = state.providers
    .filter((p) => p.enabled !== false)
    .map((provider) => {
      const models = (provider.models || []).filter((m) => m.id);
      if (models.length === 0) return "";
      return `
        <div class="form-section-title" style="margin-top:10px">${esc(provider.name)}
          <span class="tag ${providerReady(provider) ? "green" : "red"}" style="margin-left:6px">${providerReady(provider) ? "可用" : "未连接"}</span>
        </div>
        <div class="template-list">
          ${models.map((model) => {
            const caps = [
              model.vision ? "图片" : "",
              Number(model.contextWindow) >= 1000 ? `${Math.round(Number(model.contextWindow) / 1000)}K` : "",
              model.reasoningEffort ? "推理" : "",
            ].filter(Boolean);
            return `
            <div class="model-row">
              <button class="template" data-pick-model="${esc(model.id)}" data-pick-provider="${esc(provider.id)}" ${providerReady(provider) ? "" : "disabled"}>
                <span class="t-icon" style="background:${provider.kind === "workbuddy" ? "#e8f7ef" : "#f0f0f3"};color:${provider.kind === "workbuddy" ? "#0d8051" : "#666"}">${esc(initialOf(model.name))}</span>
                <span style="min-width:0"><strong>${esc(model.name)}</strong><span>${esc(model.id)}${caps.length ? ` · ${esc(caps.join(" · "))}` : ""}${model.creditMultiplier ? ` · x${model.creditMultiplier}` : ""}</span></span>
                ${conversation.modelId === model.id && conversation.providerId === provider.id ? `<span class="tag green" style="margin-left:auto">当前</span>` : ""}
              </button>
              <button class="icon-btn model-cfg" data-cfg-model="${esc(model.id)}" data-cfg-provider="${esc(provider.id)}" title="模型能力"><svg><use href="#i-gear"/></svg></button>
            </div>`;
          }).join("")}
        </div>`;
    })
    .join("");
  openModal({
    title: "切换模型",
    sub: "只影响当前会话，历史保留",
    wide: true,
    body: groups || `<div class="empty-list">还没有可用模型。请先在「API 接口」中配置。</div>`,
    onMount: (root) => {
      $$("[data-pick-model]", root).forEach((button) => {
        button.onclick = async () => {
          const provider = providerOf(button.dataset.pickProvider);
          const modelId = button.dataset.pickModel;
          const currentPersona = personaOf(conversation.personaId);
          const mappedPersona = personaForModel(modelId);
          try {
            const data = await api(`/api/conversations/${conversation.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                providerId: provider.id,
                modelId,
                personaId: currentPersona?.builtin && mappedPersona ? mappedPersona : conversation.personaId,
                modelLabel: modelName(provider, modelId),
              }),
            });
            Object.assign(conversation, data.conversation);
            await loadMessages(conversation.id);
            state.messages[conversation.id] = state.messages[conversation.id] || [];
            closeModal();
            renderAll();
            toast(`已切换到 ${modelName(provider, modelId)}`, "ok");
          } catch (error) {
            toast(error.message, "err");
          }
        };
      });
      $$("[data-cfg-model]", root).forEach((button) => {
        button.onclick = (event) => {
          event.stopPropagation();
          const target = providerOf(button.dataset.cfgProvider);
          const model = modelOf(target, button.dataset.cfgModel) || { id: button.dataset.cfgModel, name: button.dataset.cfgModel };
          openModelCapabilities(target, model);
        };
      });
    },
  });
}

/* ---------- new chat ---------- */
function openNewChat() {
  const personaCards = state.personas
    .filter((persona) => !persona.hidden)
    .map((persona) => {
      const provider = providerOf(persona.providerId);
      const ready = providerReady(provider);
      return `
        <button class="template" data-new-persona="${persona.id}" style="padding:12px">
          ${avatarHTML(persona.avatar, persona.name, "avatar")}
          <span style="min-width:0"><strong>${esc(persona.name)}</strong><span>${esc(modelName(provider, persona.modelId))}${ready ? "" : " · 未连接"}</span></span>
        </button>`;
    })
    .join("");
  const platformCards = PLATFORM_PRESETS.map((key) => {
    const preset = PRESETS[key];
    if (!preset) return "";
    const provider = platformProvider(key);
    const ready = provider ? providerReady(provider) : false;
    const count = provider?.models?.length || 0;
    const badge = !provider ? "未配置" : count ? `${count} 个模型` : "待拉取模型";
    return `
      <button class="template platform-card" data-platform="${key}">
        <span class="t-icon" style="background:#e8f7ef;color:#0d8051">${esc(initialOf(preset.name))}</span>
        <span style="min-width:0"><strong>${esc(preset.name)}</strong><span>${esc(preset.role)}</span></span>
        <span class="tag ${ready && count ? "green" : ""}" style="margin-left:auto">${esc(badge)}</span>
      </button>`;
  }).join("");
  const modelGroups = state.providers
    .filter((provider) => (provider.models || []).length)
    .map((provider) => `
      <div class="form-section-title" style="margin-top:10px">${esc(provider.name)}
        <span class="tag ${providerReady(provider) ? "green" : "red"}" style="margin-left:6px">${providerReady(provider) ? "可用" : "未连接"}</span>
      </div>
      <div class="template-list">
        ${provider.models.map((model) => `
          <button class="template" data-new-model="${esc(model.id)}" data-new-provider="${esc(provider.id)}" ${providerReady(provider) ? "" : "disabled"}>
            <span class="t-icon" style="background:#f0f0f3;color:#666">${esc(initialOf(model.name))}</span>
            <span style="min-width:0"><strong>${esc(model.name)}</strong><span>${esc(model.id)}${model.vision ? " · 图片" : ""}</span></span>
          </button>`).join("")}
      </div>`)
    .join("");
  openModal({
    title: "新建会话",
    sub: "人格与平台直连二选一；也可以从任意已配置的模型开始",
    wide: true,
    body: `
      <div class="form-section-title" style="margin-top:0">人格</div>
      <div class="template-list" style="grid-template-columns:1fr 1fr">${personaCards}</div>
      <div class="form-section-title">平台直连 <span class="muted small" style="font-weight:400">（不绑定人格，使用默认助手）</span></div>
      <div class="template-list">${platformCards}</div>
      <details style="margin-top:16px">
        <summary style="cursor:pointer;font-size:12px;font-weight:600;color:#3d3d43">从任意模型开始 <span class="muted small" style="font-weight:400">（会自动创建临时人格）</span></summary>
        <div style="max-height:260px;overflow-y:auto;padding-right:4px">${modelGroups || '<div class="empty-list" style="margin-top:10px">还没有可用模型</div>'}</div>
      </details>
      <div class="notice" style="margin-top:12px">平台直连用的是你填的 Key；未配置时点一下会直接打开配置表单。</div>`,
    onMount: (root) => {
      $$("[data-new-persona]", root).forEach((button) => {
        button.onclick = () => createConversation(button.dataset.newPersona);
      });
      $$("[data-platform]", root).forEach((button) => {
        button.onclick = () => startFromPlatform(button.dataset.platform);
      });
      $$("[data-new-model]", root).forEach((button) => {
        button.onclick = () => createConversationForModel(button.dataset.newProvider, button.dataset.newModel);
      });
    },
  });
}

function platformProvider(key) {
  return state.providers.find((provider) => provider.preset === key) || null;
}

async function startFromPlatform(key) {
  const preset = PRESETS[key];
  if (!preset) return;
  const provider = platformProvider(key);
  if (!provider) {
    closeModal();
    openProviderForm(null, key);
    setTimeout(() => toast(`填好 ${preset.name} 的 Key，点「拉取模型」就能用了`), 120);
    return;
  }
  if (!providerReady(provider) || !(provider.models || []).length) {
    closeModal();
    openProviderForm(provider, key);
    setTimeout(() => toast(`补上 Key 或点一次「拉取模型」`), 120);
    return;
  }
  await createConversationOn(provider.id, provider.models[0].id);
}

async function createConversationOn(providerId, modelId) {
  try {
    const data = await api("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ personaId: "assistant", providerId, modelId }),
    });
    state.conversations.unshift(data.conversation);
    state.messages[data.conversation.id] = [];
    closeModal();
    state.view = "chat";
    state.activeId = data.conversation.id;
    renderAll();
    setTimeout(() => $("#composerInput")?.focus(), 60);
  } catch (error) {
    toast(error.message, "err");
  }
}

async function createConversationForModel(providerId, modelId) {
  const provider = providerOf(providerId);
  const model = modelOf(provider, modelId);
  if (!provider || !model) return toast("模型不存在", "err");
  const existing = state.personas.find((p) => p.providerId === providerId && p.modelId === modelId);
  if (existing) return createConversation(existing.id);
  try {
    const data = await api("/api/personas", {
      method: "POST",
      body: JSON.stringify({
        name: model.name,
        avatar: "/avatars/model.svg",
        accent: "#15AC70",
        systemPrompt: `你是 ${model.name}，一个乐于助人的 AI 助手。请用中文回答，先给结论，再给必要步骤；不确定时直接说明，不要编造。`,
        providerId,
        modelId,
      }),
    });
    state.personas.push(data.persona);
    await createConversation(data.persona.id);
  } catch (error) {
    toast(error.message, "err");
  }
}

async function createConversation(personaId) {
  const persona = personaOf(personaId);
  try {
    const data = await api("/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        personaId: personaId,
        providerId: persona.providerId,
        modelId: persona.modelId,
      }),
    });
    state.conversations.unshift(data.conversation);
    state.messages[data.conversation.id] = [];
    closeModal();
    state.view = "chat";
    state.activeId = data.conversation.id;
    renderAll();
    setTimeout(() => $("#composerInput")?.focus(), 60);
  } catch (error) {
    toast(error.message, "err");
  }
}

function openConversationMenu(id) {
  const conversation = convOf(id);
  if (!conversation) return;
  openModal({
    title: "会话操作",
    narrow: true,
    body: `
      <div class="field" style="margin-bottom:12px">
        <label>会话名称</label>
        <input id="renameInput" value="${esc(conversation.title)}">
      </div>
      <div class="row" style="flex-wrap:wrap">
        <button class="btn" data-act-pin>${conversation.pinned ? "取消置顶" : "置顶会话"}</button>
        <button class="btn" data-act-archive><svg><use href="#i-archive"/></svg>${conversation.archived ? "取消归档" : "归档"}</button>
        <button class="btn" data-act-export><svg><use href="#i-download"/></svg>导出</button>
        <button class="btn danger" data-act-delete>删除会话</button>
      </div>`,
    foot: `<div class="spacer"></div><button class="btn" data-close>取消</button><button class="btn primary" data-act-save>保存名称</button>`,
    onMount: (root) => {
      $("[data-close]", root).onclick = closeModal;
      $("[data-act-pin]", root).onclick = async () => {
        await api(`/api/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ pinned: !conversation.pinned }) });
        conversation.pinned = !conversation.pinned;
        closeModal();
        renderSidebar();
      };
      $("[data-act-archive]", root).onclick = async () => {
        const next = !conversation.archived;
        try {
          await api(`/api/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ archived: next }) });
          conversation.archived = next;
          closeModal();
          renderSidebar();
          toast(next ? "已归档，可在「已归档」里找到" : "已取消归档", "ok");
        } catch (error) {
          toast(error.message, "err");
        }
      };
      $("[data-act-export]", root).onclick = () => {
        closeModal();
        exportConversation(id);
      };
      $("[data-act-delete]", root).onclick = () => {
        openModal({
          title: "删除会话",
          narrow: true,
          body: `<div class="confirm-text">确定删除「${esc(conversation.title)}」？消息记录会被移除，无法恢复。</div>`,
          foot: `<div class="spacer"></div><button class="btn" data-close>取消</button><button class="btn danger" data-confirm>删除</button>`,
          onMount: (modal) => {
            $("[data-close]", modal).onclick = closeModal;
            $("[data-confirm]", modal).onclick = async () => {
              await api(`/api/conversations/${id}`, { method: "DELETE" });
              state.conversations = state.conversations.filter((c) => c.id !== id);
              delete state.messages[id];
              if (state.activeId === id) state.activeId = state.conversations[0]?.id || null;
              closeModal();
              renderAll();
              toast("会话已删除", "ok");
            };
          },
        });
      };
      $("[data-act-save]", root).onclick = async () => {
        const title = $("#renameInput", root).value.trim() || "新对话";
        await api(`/api/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
        conversation.title = title;
        closeModal();
        renderSidebar();
        renderChat();
      };
    },
  });
}

/* ---------- emoji ---------- */
function openEmoji(anchor) {
  if (state.emojiOpen) return closeEmoji();
  state.emojiOpen = true;
  const root = $("#emojiRoot");
  const categories = Object.keys(EMOJIS);
  root.innerHTML = `
    <div class="emoji-panel open" id="emojiPanel">
      <div class="emoji-tabs">${categories.map((name, index) => `<button data-emoji-tab="${name}" class="${index === 0 ? "active" : ""}">${name}</button>`).join("")}</div>
      <div class="emoji-grid" id="emojiGrid"></div>
    </div>`;
  const render = (name) => {
    $("#emojiGrid").innerHTML = EMOJIS[name].map((emoji) => `<button data-emoji="${emoji}">${emoji}</button>`).join("");
    $$("[data-emoji-tab]").forEach((button) => button.classList.toggle("active", button.dataset.emojiTab === name));
    $$("[data-emoji]").forEach((button) => {
      button.onclick = () => insertAtCursor(button.dataset.emoji);
    });
  };
  $$("[data-emoji-tab]").forEach((button) => {
    button.onclick = () => render(button.dataset.emojiTab);
  });
  render(categories[0]);
  const panel = $("#emojiPanel");
  const rect = anchor.getBoundingClientRect();
  const width = 292;
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  const top = Math.max(8, rect.top - 250);
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  setTimeout(() => {
    document.addEventListener("mousedown", function onDoc(event) {
      if (!panel.contains(event.target) && event.target !== anchor) {
        closeEmoji();
        document.removeEventListener("mousedown", onDoc);
      }
    });
  }, 0);
}

function insertAtCursor(text) {
  const input = $("#composerInput");
  if (!input) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  input.selectionStart = input.selectionEnd = start + text.length;
  input.dispatchEvent(new Event("input"));
  input.focus();
}

/* ---------- images ---------- */
async function addFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      toast("目前只支持图片", "err");
      continue;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast("图片超过 15MB，已跳过", "err");
      continue;
    }
    try {
      const dataUrl = await compressImage(file);
      const data = await api("/api/upload", {
        method: "POST",
        body: JSON.stringify({ dataUrl, name: file.name }),
      });
      state.attachments.push({ url: data.url, name: file.name });
      renderAttachments();
    } catch (error) {
      toast(`图片上传失败：${error.message}`, "err");
    }
  }
}

function compressImage(file) {
  if (file.type === "image/gif") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const max = 1600;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const type = file.type === "image/png" ? "image/png" : "image/jpeg";
        resolve(canvas.toDataURL(type, 0.86));
      };
      image.onerror = reject;
      image.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- providers ---------- */
function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m} 分 ${String(s).padStart(2, "0")} 秒` : `${s} 秒`;
}

function downloadStateLabel(download) {
  if (!download) return "正在读取下载状态…";
  if (download.state === "downloading") {
    const eta = formatEta(download.eta);
    return `下载中 ${download.percent}% · ${download.receivedLabel} / ${download.totalLabel || "…"}${download.speedLabel ? ` · ${download.speedLabel}` : ""}${eta ? ` · 剩余 ${eta}` : ""}`;
  }
  if (download.state === "verifying") return `下载完成 · 正在校验 SHA-256 与数字签名…`;
  if (download.state === "paused") return `已暂停 · ${download.receivedLabel} / ${download.totalLabel || "…"}，可继续下载`;
  if (download.state === "done") {
    const sig = download.signature?.status;
    const sigText = sig === "Valid" ? "签名有效" : sig ? `签名 ${sig}` : "签名未校验";
    return `已下载 · ${download.receivedLabel} · ${sigText}`;
  }
  if (download.state === "error") return `下载失败：${download.error || "未知错误"}`;
  return `未下载 · 官方 Windows 安装包 ${download.version || "5.8.3"} · 约 421.6 MB`;
}

function renderDownloadCard() {
  const d = state.download;
  const phase = d?.state || "idle";
  const active = phase === "downloading" || phase === "verifying";
  const done = phase === "done";
  const pct = Math.max(0, Math.min(100, Number(d?.percent) || 0));
  const sig = d?.signature?.status;
  const sigBad = done && sig && sig !== "Valid";
  const pathLabel = d?.dir || "E:\\OwnChat\\downloads\\WorkBuddy";
  return `
    <div class="card provider-card download-card" id="wbDownloadCard">
      <div class="p-icon" style="background:#e8f7ef;color:#0d8051"><svg><use href="#i-download"/></svg></div>
      <div class="p-main">
        <div class="p-name">WorkBuddy 客户端 <span class="tag green">官方</span> <span class="tag">v${esc(d?.version || "5.8.3")}</span>
          ${done ? `<span class="tag green">已下载</span>` : ""}
          ${sigBad ? `<span class="tag amber">签名 ${esc(sig)}</span>` : ""}
        </div>
        <div class="p-sub">${esc(downloadStateLabel(d))}</div>
        <div class="download-progress"><i style="width:${pct}%"></i></div>
        <div class="download-meta"><span>${esc(pathLabel)}</span>${d?.sha256 && done ? `<span>SHA-256 ${esc(d.sha256.slice(0, 16))}…</span>` : ""}</div>
      </div>
      <div class="p-actions download-actions">
        ${active ? `<button class="btn small" data-dl-cancel>暂停</button>` : ""}
        ${done
          ? `<button class="btn small primary" data-dl-run>运行安装包</button><button class="btn small" data-dl-open>打开文件夹</button>`
          : `<button class="btn small primary" data-dl-start>${phase === "paused" || phase === "error" ? "继续下载" : "下载"}</button>`}
        <button class="btn small ghost" data-dl-page>官方页面</button>
      </div>
    </div>`;
}

function bindDownloadUI(root = document) {
  $("[data-dl-start]", root)?.addEventListener("click", async () => {
    try {
      state.download = await api("/api/downloads/workbuddy/start", { method: "POST" });
      updateDownloadCard();
      scheduleDownloadPoll();
    } catch (error) {
      toast(error.message, "err");
    }
  });
  $("[data-dl-cancel]", root)?.addEventListener("click", async () => {
    try {
      state.download = await api("/api/downloads/workbuddy/cancel", { method: "POST" });
      updateDownloadCard();
    } catch (error) {
      toast(error.message, "err");
    }
  });
  $("[data-dl-open]", root)?.addEventListener("click", async () => {
    try {
      await api("/api/downloads/workbuddy/open", { method: "POST" });
      toast("已打开下载文件夹", "ok");
    } catch (error) {
      toast(error.message, "err");
    }
  });
  $("[data-dl-run]", root)?.addEventListener("click", async () => {
    try {
      await api("/api/downloads/workbuddy/run", { method: "POST" });
      toast("安装程序已启动", "ok");
    } catch (error) {
      toast(error.message, "err");
    }
  });
  $("[data-dl-page]", root)?.addEventListener("click", () => {
    const url = state.download?.page || "https://www.workbuddy.cn/docs/workbuddy/Download-History";
    window.open(url, "_blank", "noopener");
  });
}

function updateDownloadCard() {
  if (state.view !== "providers") return;
  const old = $("#wbDownloadCard");
  if (!old) return;
  old.outerHTML = renderDownloadCard();
  bindDownloadUI();
}

function scheduleDownloadPoll() {
  clearTimeout(state.downloadTimer);
  const active = state.download?.state === "downloading" || state.download?.state === "verifying";
  if (!active || state.view !== "providers") return;
  state.downloadTimer = setTimeout(async () => {
    await refreshDownloadStatus();
    scheduleDownloadPoll();
  }, 1200);
}

async function refreshDownloadStatus() {
  try {
    state.download = await api("/api/downloads/workbuddy/status");
    updateDownloadCard();
  } catch {}
}

function renderProviders() {
  const cards = state.providers
    .map((provider) => {
      const isWB = provider.kind === "workbuddy";
      const status = provider.status;
      const ready = providerReady(provider);
      const dot = ready ? "on" : status && status.available ? "err" : "";
      const expiry = status?.account?.expiresAtMs ? new Date(status.account.expiresAtMs) : null;
      const expiryText = expiry
        ? `${expiry.getMonth() + 1}/${expiry.getDate()} ${String(expiry.getHours()).padStart(2, "0")}:${String(expiry.getMinutes()).padStart(2, "0")}`
        : "";
      const sub = isWB
        ? `${provider.region === "global" ? "国际" : "国内"} · ${providerStatusText(provider)}${expiryText ? ` · Token 至 ${expiryText}` : ""} · ${(provider.models || []).length} 个模型`
        : `${provider.baseUrl || "未填写地址"} · ${(provider.models || []).length} 个模型`;
      return `
        <div class="card provider-card" data-provider-card="${provider.id}">
          <div class="p-icon" style="${isWB ? "background:#e8f7ef;color:#0d8051" : ""}"><svg><use href="${isWB ? "#i-server" : "#i-plug"}"/></svg></div>
          <div class="p-main">
            <div class="p-name"><i class="status-dot ${dot}"></i>${esc(provider.name)} ${isWB ? `<span class="tag green">${provider.region === "global" ? "国际" : "国内"}</span>` : ""} ${provider.hasKey ? `<span class="tag">Key 已存</span>` : ""}</div>
            <div class="p-sub">${esc(sub)}</div>
          </div>
          <div class="p-actions">
            ${isWB ? `<button class="btn small" data-wb-accounts="${provider.id}">账号</button>` : ""}
            <button class="btn small" data-refresh-models="${provider.id}">刷新模型</button>
            <button class="btn small" data-test-provider="${provider.id}">测试</button>
            ${isWB ? "" : `<button class="btn small" data-edit-provider="${provider.id}">编辑</button>`}
            <button class="icon-btn" data-provider-menu="${provider.id}" title="更多"><svg><use href="#i-more"/></svg></button>
          </div>
        </div>
        <div class="test-result ${state.testResults?.[provider.id]?.ok ? "ok" : state.testResults?.[provider.id] ? "bad" : ""}" id="test-${provider.id}" style="${state.testResults?.[provider.id] ? "" : "display:none"}">${esc(state.testResults?.[provider.id]?.text || "")}</div>`;
    })
    .join("");
  const demo = Boolean(state.boot?.demo);
  $("#main").innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><h1>API 接口</h1><p>接任意 OpenAI 兼容服务；本机模型也可以。</p></div>
        <div class="page-actions">
          <button class="btn" data-wb-detect><svg><use href="#i-refresh"/></svg>刷新状态</button>
          <button class="btn primary" data-add-provider><svg><use href="#i-plus"/></svg>添加接口</button>
        </div>
      </div>
      ${demo ? "" : renderDownloadCard()}
      ${cards || `<div class="empty-list" style="margin-top:9px">还没有接口</div>`}
      ${demo ? "" : `<div class="notice" style="margin-top:14px">
        WorkBuddy 通过本机已安装的 <b>dsh-connect-workbuddy</b> 读取登录态，不复制、不上传你的账号凭据。
        免费 API 的额度与模型会变化，以各平台控制台为准；OwnChat 不内置任何 Key。
      </div>`}
    </div>`;
  $("[data-add-provider]").onclick = openAddProvider;
  $("[data-wb-detect]").onclick = detectWorkBuddy;
  if (!demo) {
    bindDownloadUI();
    refreshDownloadStatus().then(scheduleDownloadPoll);
  }
  $$("[data-wb-accounts]").forEach((button) => {
    button.onclick = () => openWorkBuddyAccounts(providerOf(button.dataset.wbAccounts));
  });
  $$("[data-refresh-models]").forEach((button) => {
    button.onclick = () => refreshProviderModels(button.dataset.refreshModels);
  });
  $$("[data-test-provider]").forEach((button) => {
    button.onclick = () => testProvider(button.dataset.testProvider);
  });
  $$("[data-edit-provider]").forEach((button) => {
    button.onclick = () => openProviderForm(providerOf(button.dataset.editProvider));
  });
  $$("[data-provider-menu]").forEach((button) => {
    button.onclick = () => openProviderMenu(providerOf(button.dataset.providerMenu));
  });
}

function openAddProvider() {
  const rows = Object.entries(PRESETS)
    .map(([key, preset]) => `
      <button class="template" data-template="${key}">
        <span class="t-icon">${esc(initialOf(preset.name))}</span>
        <span><strong>${esc(preset.name)}</strong><span>${esc(preset.note)}</span></span>
      </button>`)
    .join("");
  openModal({
    title: "添加接口",
    sub: "选择预设，或从空白开始",
    body: `<div class="template-list">${rows}</div>
      <div class="notice" style="margin-top:14px">免费平台都需要在各自控制台注册并获取 Key；OwnChat 只负责调用，不代注册。</div>`,
    onMount: (root) => {
      $$("[data-template]", root).forEach((button) => {
        button.onclick = () => openProviderForm(null, button.dataset.template);
      });
    },
  });
}

function openProviderForm(provider, presetKey) {
  const preset = presetKey ? PRESETS[presetKey] : null;
  const p = provider || {
    name: preset?.name || "",
    baseUrl: preset?.baseUrl || "",
    model: preset?.model || "",
    protocol: "openai",
    // Presets that ship a default model are usable right after saving; the
    // others (e.g. Ark) need an explicit endpoint id first.
    models: preset?.model ? [{ id: preset.model, name: preset.model }] : [],
    supportsVision: false,
    supportsStreaming: true,
    temperature: 0.7,
    maxTokens: 4096,
    enabled: true,
    kind: "openai",
  };
  const isNew = !provider;
  const modelsText = (p.models || []).map((m) => m.id).join("\n");
  openModal({
    title: isNew ? "添加接口" : "编辑接口",
    sub: isNew ? "填写 API 信息；保存后可以测试连接" : p.name,
    wide: true,
    body: `
      <div class="form-grid">
        <div class="field"><label>显示名称</label><input id="pf-name" value="${esc(p.name)}" placeholder="例如 OpenRouter"></div>
        <div class="field"><label>协议</label><select id="pf-protocol">
          <option value="openai" ${p.protocol !== "azure" ? "selected" : ""}>OpenAI Chat Completions</option>
          <option value="azure" ${p.protocol === "azure" ? "selected" : ""}>Azure OpenAI</option>
        </select></div>
        <div class="field full"><label>Base URL</label><input id="pf-baseUrl" value="${esc(p.baseUrl || "")}" placeholder="https://.../v1"></div>
        <div class="field"><label>API Key</label><input id="pf-apiKey" type="password" placeholder="${p.hasKey ? "已保存，留空则不修改" : "sk-..."}" autocomplete="off"></div>
        <div class="field"><label>默认模型 ID</label><input id="pf-model" value="${esc(p.model || "")}" placeholder="例如 gpt-4o-mini"></div>
        <div class="field"><label>组织 ID（可选）</label><input id="pf-org" value="${esc(p.organization || "")}" placeholder="org-..."></div>
        <div class="field"><label>上下文窗口</label><input id="pf-context" type="number" value="${esc(p.contextWindow || 128000)}"></div>
        <div class="field"><label>最大输出</label><input id="pf-max" type="number" value="${esc(p.maxTokens || 4096)}"></div>
        <div class="field"><label>温度</label><input id="pf-temp" type="number" step="0.1" min="0" max="2" value="${esc(p.temperature ?? 0.7)}"></div>
        <div class="field"><label>Top P</label><input id="pf-topp" type="number" step="0.1" min="0" max="1" value="${esc(p.topP ?? 1)}"></div>
        <div class="field full"><label>模型列表（每行一个 ID）</label><textarea id="pf-models" class="prompt-box" placeholder="留空则从 /models 自动拉取">${esc(modelsText)}</textarea>
          <div class="hint">也可以点下方“拉取模型”，自动填入。</div></div>
        <div class="field full"><label>自定义请求头（JSON，可选）</label><input id="pf-headers" value="${esc(p.headers ? JSON.stringify(p.headers) : "")}" placeholder='{"X-Custom":"value"}'></div>
        <div class="field full"><label>自定义请求体（JSON，可选）</label><input id="pf-extra" value="${esc(p.extraBody ? JSON.stringify(p.extraBody) : "")}" placeholder='{"provider":"..."}'></div>
        <div class="field"><label>API 版本（Azure）</label><input id="pf-apiVersion" value="${esc(p.apiVersion || "")}" placeholder="2024-10-21"></div>
        <div class="field"><label>部署名（Azure）</label><input id="pf-deployment" value="${esc(p.deployment || "")}" placeholder="gpt-4o"></div>
        <div class="field"><label>超时（毫秒）</label><input id="pf-timeout" type="number" value="${esc(p.timeoutMs || 90000)}"></div>
        <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" id="pf-vision" ${p.supportsVision ? "checked" : ""}> 支持图片输入</label></div>
        <div class="field full"><label class="check"><input type="checkbox" id="pf-enabled" ${p.enabled !== false ? "checked" : ""}> 启用这个接口</label></div>
      </div>
      <div class="test-result" id="pf-test" style="display:none"></div>`,
    foot: `
      ${isNew ? "" : `<button class="btn danger" data-pf-delete>删除</button>`}
      <div class="spacer"></div>
      <button class="btn" data-pf-cancel>取消</button>
      <button class="btn" data-pf-fetch>拉取模型</button>
      <button class="btn primary" data-pf-save>保存</button>`,
    onMount: (root) => {
      $("[data-pf-cancel]", root).onclick = closeModal;
      $("[data-pf-save]", root).onclick = () => saveProviderForm(root, provider, presetKey);
      $("[data-pf-fetch]", root).onclick = () => fetchModelsInForm(root, provider);
      const del = $("[data-pf-delete]", root);
      if (del) del.onclick = () => deleteProviderConfirm(provider);
    },
  });
}

function collectProviderForm(root) {
  const value = (id) => $(`#${id}`, root)?.value?.trim?.() ?? "";
  const models = value("pf-models")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((id) => ({ id, name: id }));
  let headers;
  let extraBody;
  try {
    headers = value("pf-headers") ? JSON.parse(value("pf-headers")) : undefined;
  } catch {
    throw new Error("自定义请求头不是合法 JSON");
  }
  try {
    extraBody = value("pf-extra") ? JSON.parse(value("pf-extra")) : undefined;
  } catch {
    throw new Error("自定义请求体不是合法 JSON");
  }
  return {
    name: value("pf-name"),
    protocol: value("pf-protocol"),
    baseUrl: value("pf-baseUrl"),
    apiKey: value("pf-apiKey"),
    model: value("pf-model"),
    organization: value("pf-org"),
    contextWindow: Number(value("pf-context")) || 128000,
    maxTokens: Number(value("pf-max")) || 4096,
    temperature: Number(value("pf-temp")),
    topP: Number(value("pf-topp")),
    models,
    headers,
    extraBody,
    apiVersion: value("pf-apiVersion"),
    deployment: value("pf-deployment"),
    timeoutMs: Number(value("pf-timeout")) || 90000,
    supportsVision: $("#pf-vision", root).checked,
    enabled: $("#pf-enabled", root).checked,
  };
}

async function saveProviderForm(root, existing, presetKey = "") {
  try {
    const input = collectProviderForm(root);
    if (!input.name) throw new Error("请填写名称");
    if (!input.baseUrl) throw new Error("请填写 Base URL");
    if (existing?.id) input.id = existing.id;
    const preset = existing?.preset || presetKey;
    if (preset) input.preset = preset;
    const data = await api("/api/providers", { method: "POST", body: JSON.stringify(input) });
    if (existing) Object.assign(existing, data.provider);
    else state.providers.push(data.provider);
    closeModal();
    renderProviders();
    toast("接口已保存", "ok");
  } catch (error) {
    toast(error.message, "err");
  }
}

async function fetchModelsInForm(root, existing) {
  try {
    const input = collectProviderForm(root);
    const name = input.name || "临时接口";
    let saved;
    if (existing) {
      input.id = existing.id;
      saved = (await api("/api/providers", { method: "POST", body: JSON.stringify({ ...input, name }) })).provider;
      Object.assign(existing, saved);
    } else {
      saved = (await api("/api/providers", { method: "POST", body: JSON.stringify({ ...input, name }) })).provider;
    }
    const result = await api(`/api/providers/${saved.id}/models`, { method: "POST" });
    $("#pf-models", root).value = (result.models || []).map((m) => m.id).join("\n");
    const test = $("#pf-test", root);
    test.className = "test-result ok";
    test.style.display = "";
    test.textContent = `已拉取 ${(result.models || []).length} 个模型`;
    if (existing) {
      existing.models = result.models || existing.models;
    } else {
      state.providers = state.providers.filter((p) => p.id !== saved.id);
      await api(`/api/providers/${saved.id}`, { method: "DELETE" }).catch(() => {});
    }
  } catch (error) {
    toast(`拉取模型失败：${error.message}`, "err");
  }
}

async function deleteProviderConfirm(provider) {
  openModal({
    title: "删除接口",
    narrow: true,
    body: `<div class="confirm-text">确定删除「${esc(provider.name)}」？引用它的会话需要重新选择模型。</div>`,
    foot: `<div class="spacer"></div><button class="btn" data-close>取消</button><button class="btn danger" data-confirm>删除</button>`,
    onMount: (root) => {
      $("[data-close]", root).onclick = closeModal;
      $("[data-confirm]", root).onclick = async () => {
        await api(`/api/providers/${provider.id}`, { method: "DELETE" });
        state.providers = state.providers.filter((p) => p.id !== provider.id);
        closeModal();
        renderProviders();
        toast("接口已删除", "ok");
      };
    },
  });
}

async function refreshProviderModels(id) {
  const provider = providerOf(id);
  try {
    toast("正在刷新模型…");
    const result = provider.kind === "workbuddy"
      ? await api("/api/workbuddy/models", { method: "POST", body: JSON.stringify({ region: provider.region, refresh: true }) })
      : await api(`/api/providers/${id}/models`, { method: "POST" });
    provider.models = result.models || provider.models;
    provider.modelsFetchedAt = Date.now();
    renderProviders();
    toast(`已刷新：${provider.models.length} 个模型`, "ok");
  } catch (error) {
    toast(`刷新失败：${error.message}`, "err");
  }
}

async function testProvider(id) {
  const provider = providerOf(id);
  const box = $(`#test-${id}`);
  if (box) {
    box.style.display = "";
    box.className = "test-result";
    box.textContent = "测试中…";
  }
  try {
    const result = await api(`/api/providers/${id}/test`, { method: "POST" });
    const line = result.ok
      ? `连接成功 · ${result.models || 0} 个模型 · ${result.latencyMs || 0}ms${result.sample ? ` · ${result.sample}` : ""}`
      : `失败：${result.error || result.modelsError || "未知错误"}`;
    state.testResults = state.testResults || {};
    state.testResults[id] = { ok: result.ok, text: line };
    if (box) {
      box.style.display = "";
      box.className = `test-result ${result.ok ? "ok" : "bad"}`;
      box.textContent = line;
    }
    toast(line, result.ok ? "ok" : "err");
  } catch (error) {
    if (box) {
      box.style.display = "";
      box.className = "test-result bad";
      box.textContent = error.message;
    }
    toast(error.message, "err");
  }
}

function openProviderMenu(provider) {
  openModal({
    title: provider.name,
    narrow: true,
    body: `<div class="row" style="flex-wrap:wrap">
      ${provider.kind === "workbuddy" ? "" : `<button class="btn" data-edit>编辑</button>`}
      ${provider.kind === "workbuddy" ? `<button class="btn" data-accounts>账号</button>` : ""}
      <button class="btn" data-refresh>刷新模型</button>
      <button class="btn" data-test>测试</button>
      ${provider.kind === "workbuddy" ? "" : `<button class="btn danger" data-delete>删除</button>`}
    </div>`,
    onMount: (root) => {
      $("[data-edit]", root)?.addEventListener("click", () => {
        closeModal();
        openProviderForm(provider);
      });
      $("[data-accounts]", root)?.addEventListener("click", () => {
        closeModal();
        openWorkBuddyAccounts(provider);
      });
      $("[data-refresh]", root).onclick = () => {
        closeModal();
        refreshProviderModels(provider.id);
      };
      $("[data-test]", root).onclick = () => {
        closeModal();
        testProvider(provider.id);
      };
      $("[data-delete]", root)?.addEventListener("click", () => {
        closeModal();
        deleteProviderConfirm(provider);
      });
    },
  });
}

function openWorkBuddyAccounts(provider) {
  if (!provider) return;
  const status = provider.status;
  const accounts = status?.accounts || [];
  openModal({
    title: `${provider.name} · 账号`,
    sub: status?.available ? (status.signedIn ? "已读取本机 WorkBuddy 登录态" : "未检测到登录态") : "插件未就绪",
    body: status?.available
      ? `<div class="field"><label>选择账号</label><select id="wbAccount">
          ${accounts.map((account) => `<option value="${esc(account.id)}" ${account.selected ? "selected" : ""}>${esc(account.accountName || account.id)} · ${esc(account.domain || "")}</option>`).join("")}
        </select><div class="hint">账号来自 dsh-connect-workbuddy 的本地凭据库；OwnChat 不会复制 Token。</div></div>
        ${status.error ? `<div class="notice red" style="margin-top:10px">${esc(status.error)}</div>` : ""}
        <div class="notice" style="margin-top:10px">如果账号列表为空，请先在 WorkBuddy 桌面端登录，或在 DSH 的 WorkBuddy 插件卡片里扫码添加账号。</div>`
      : `<div class="notice red">${esc(status?.error || "未找到 dsh-connect-workbuddy")}</div>`,
    foot: `<div class="spacer"></div><button class="btn" data-close>关闭</button>${accounts.length ? `<button class="btn primary" data-save-account>使用此账号</button>` : ""}`,
    onMount: (root) => {
      $("[data-close]", root).onclick = closeModal;
      $("[data-save-account]", root)?.addEventListener("click", async () => {
        try {
          const accountId = $("#wbAccount", root).value;
          await api("/api/workbuddy/account", { method: "POST", body: JSON.stringify({ region: provider.region, accountId }) });
          const boot = await api("/api/bootstrap");
          state.providers = boot.providers;
          state.workbuddy = boot.workbuddy;
          closeModal();
          renderAll();
          toast("账号已切换", "ok");
        } catch (error) {
          toast(error.message, "err");
        }
      });
    },
  });
}

/* ---------- personas ---------- */
function renderPersonas() {
  const cards = state.personas
    .filter((persona) => !persona.hidden)
    .map((persona) => {
      const provider = providerOf(persona.providerId);
      return `
        <div class="persona-card">
          ${persona.builtin ? `<span class="builtin-badge">预置</span>` : ""}
          ${avatarHTML(persona.avatar, persona.name, "avatar")}
          <h3>${esc(persona.name)}</h3>
          <p>${esc(persona.systemPrompt || "未填写人格设定")}</p>
          <div class="p-meta">${esc(modelName(provider, persona.modelId))}</div>
          <div class="p-actions">
            <button class="btn small" data-edit-persona="${persona.id}">编辑</button>
            <button class="btn small" data-avatar-persona="${persona.id}">头像</button>
            ${persona.builtin ? "" : `<button class="btn small danger" data-delete-persona="${persona.id}">删除</button>`}
          </div>
        </div>`;
    })
    .join("");
  $("#main").innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><h1>人格 / 模型</h1><p>人格 = 名字 + 头像 + 系统提示词；每个会话可以单独选。</p></div>
        <div class="page-actions"><button class="btn primary" data-add-persona><svg><use href="#i-plus"/></svg>新建人格</button></div>
      </div>
      <div class="persona-grid">${cards}</div>
    </div>`;
  $("[data-add-persona]").onclick = () => openPersonaForm(null);
  $$("[data-edit-persona]").forEach((button) => {
    button.onclick = () => openPersonaForm(personaOf(button.dataset.editPersona));
  });
  $$("[data-avatar-persona]").forEach((button) => {
    button.onclick = () => openAvatarStudio(personaOf(button.dataset.avatarPersona));
  });
  $$("[data-delete-persona]").forEach((button) => {
    button.onclick = () => deletePersona(button.dataset.deletePersona);
  });
}

function openPersonaForm(persona) {
  const isNew = !persona;
  const p = persona || {
    name: "",
    avatar: "/avatars/model.svg",
    accent: "#15AC70",
    systemPrompt: "你是一个乐于助人的 AI 助手。请用中文回答，先给结论，再给必要步骤。",
    providerId: state.providers[0]?.id || "",
    modelId: state.providers[0]?.models?.[0]?.id || "",
  };
  const providerOptions = state.providers
    .map((provider) => `<option value="${provider.id}" ${provider.id === p.providerId ? "selected" : ""}>${esc(provider.name)}</option>`)
    .join("");
  const selectedProvider = providerOf(p.providerId) || state.providers[0];
  const modelOptions = (selectedProvider?.models || [])
    .map((model) => `<option value="${esc(model.id)}" ${model.id === p.modelId ? "selected" : ""}>${esc(model.name)}</option>`)
    .join("");
  openModal({
    title: isNew ? "新建人格" : "编辑人格",
    sub: "系统提示词决定说话方式，但回复仍由真实模型生成",
    wide: true,
    body: `
      <div class="avatar-studio">
        <div>
          <div class="avatar-preview" id="personaAvatarPreview">${avatarHTML(p.avatar, p.name, "avatar")}</div>
          <div class="row" style="margin-top:8px">
            <button class="btn" data-persona-avatar><svg><use href="#i-sparkles"/></svg>AI 生成头像</button>
            <button class="btn" data-persona-upload><svg><use href="#i-upload"/></svg>上传</button>
          </div>
        </div>
        <div class="avatar-controls">
          <div class="field"><label>名字</label><input id="pers-name" value="${esc(p.name)}" placeholder="例如 DeepSeek娘"></div>
          <div class="field"><label>接口</label><select id="pers-provider">${providerOptions}</select></div>
          <div class="field"><label>默认模型</label><select id="pers-model">${modelOptions}</select></div>
          <div class="field"><label>系统提示词</label><textarea id="pers-prompt" class="prompt-box" style="min-height:130px">${esc(p.systemPrompt || "")}</textarea></div>
          <div class="field"><label>强调色</label><input id="pers-accent" type="color" value="${esc(p.accent || "#15AC70")}" style="height:32px;padding:2px"></div>
        </div>
      </div>`,
    foot: `<div class="spacer"></div><button class="btn" data-close>取消</button><button class="btn primary" data-save-persona>保存</button>`,
    onMount: (root) => {
      $("[data-close]", root).onclick = closeModal;
      const providerSelect = $("#pers-provider", root);
      providerSelect.onchange = () => {
        const provider = providerOf(providerSelect.value);
        $("#pers-model", root).innerHTML = (provider?.models || [])
          .map((model) => `<option value="${esc(model.id)}">${esc(model.name)}</option>`)
          .join("");
      };
      $("[data-persona-avatar]", root).onclick = () => openAvatarStudio(p, (url) => {
        p.avatar = url;
        $("#personaAvatarPreview", root).innerHTML = avatarHTML(url, $("#pers-name", root).value, "avatar");
      });
      $("[data-persona-upload]", root).onclick = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = async () => {
          const file = input.files[0];
          if (!file) return;
          try {
            const dataUrl = await compressImage(file);
            const data = await api("/api/avatars", { method: "POST", body: JSON.stringify({ dataUrl }) });
            p.avatar = data.url;
            $("#personaAvatarPreview", root).innerHTML = avatarHTML(data.url, $("#pers-name", root).value, "avatar");
            toast("头像已上传", "ok");
          } catch (error) {
            toast(error.message, "err");
          }
        };
        input.click();
      };
      $("[data-save-persona]", root).onclick = async () => {
        try {
          const body = {
            name: $("#pers-name", root).value.trim(),
            providerId: $("#pers-provider", root).value,
            modelId: $("#pers-model", root).value,
            systemPrompt: $("#pers-prompt", root).value,
            accent: $("#pers-accent", root).value,
            avatar: p.avatar,
          };
          if (!body.name) throw new Error("请填写名字");
          if (persona?.id) body.id = persona.id;
          const data = await api("/api/personas", { method: "POST", body: JSON.stringify(body) });
          if (persona) Object.assign(persona, data.persona);
          else state.personas.push(data.persona);
          closeModal();
          renderPersonas();
          renderSidebar();
          toast("人格已保存", "ok");
        } catch (error) {
          toast(error.message, "err");
        }
      };
    },
  });
  // refresh preview when name changes
  setTimeout(() => {
    const name = $("#pers-name");
    if (name) name.addEventListener("input", () => {
      const preview = $("#personaAvatarPreview");
      if (preview) preview.innerHTML = avatarHTML(p.avatar, name.value, "avatar");
    });
  }, 0);
}

async function deletePersona(id) {
  const persona = personaOf(id);
  openModal({
    title: "删除人格",
    narrow: true,
    body: `<div class="confirm-text">确定删除「${esc(persona.name)}」？使用该人格的会话会回到默认人格。</div>`,
    foot: `<div class="spacer"></div><button class="btn" data-close>取消</button><button class="btn danger" data-confirm>删除</button>`,
    onMount: (root) => {
      $("[data-close]", root).onclick = closeModal;
      $("[data-confirm]", root).onclick = async () => {
        await api(`/api/personas/${id}`, { method: "DELETE" });
        state.personas = state.personas.filter((p) => p.id !== id);
        closeModal();
        renderPersonas();
        renderSidebar();
        toast("人格已删除", "ok");
      };
    },
  });
}

/* ---------- avatar studio ---------- */
function openAvatarStudio(persona, onUse) {
  const target = persona || { name: "新头像", avatar: "/avatars/user.svg" };
  const defaultKey = target.id && AVATAR_PROMPTS[target.id] ? target.id : "generic";
  state.avatarStudio = {
    persona: target,
    onUse,
    prompt: AVATAR_PROMPTS[defaultKey].prompt,
    negative: AVATAR_PROMPTS[defaultKey].negative,
    seed: Math.floor(Math.random() * 100000),
    url: "",
  };
  openModal({
    title: "头像工作室",
    sub: "AI 生成 / 上传；预置提示词参考常见 AI 娘拟人风格",
    wide: true,
    body: renderAvatarStudioBody(defaultKey),
    foot: `<div class="spacer"></div><button class="btn" data-close>取消</button><button class="btn primary" data-use-avatar disabled>使用这张头像</button>`,
    onMount: (root) => bindAvatarStudio(root),
  });
}

function renderAvatarStudioBody(activeKey) {
  const presetButtons = Object.entries(AVATAR_PROMPTS)
    .map(([key, item]) => `
      <button class="avatar-preset ${key === activeKey ? "active" : ""}" data-avatar-preset="${key}">
        <span class="avatar"><img src="${esc(item.avatar)}" alt=""></span>
        <span><strong>${esc(item.name)}</strong><span>${esc(item.short)}</span></span>
      </button>`)
    .join("");
  return `
    <div class="avatar-studio">
      <div class="avatar-preview" id="avatarPreview">
        ${state.avatarStudio?.persona?.avatar
          ? `<img src="${esc(state.avatarStudio.persona.avatar)}" alt="">`
          : `<div class="placeholder">选择一个预置提示词，或自己描述<br>然后点“生成头像”</div>`}
      </div>
      <div class="avatar-controls">
        <div class="avatar-tabs">
          <button class="active" data-avatar-tab="preset">预置提示词</button>
          <button data-avatar-tab="custom">自定义</button>
          <button data-avatar-tab="upload">上传</button>
        </div>
        <div id="avatarPresetPane">
          <div class="avatar-preset-list">${presetButtons}</div>
        </div>
        <div id="avatarCustomPane" style="display:none">
          <div class="notice" style="margin-bottom:8px">默认 Pollinations 免费接口只有写实向模型且限流；要稳定的精细二次元，请在「设置 → 头像生成」里填自己的图片 API（OpenAI 兼容 / 硅基流动 Kolors）。</div>
        </div>
        <div class="field"><label>提示词</label><textarea id="avatarPrompt" class="prompt-box">${esc(state.avatarStudio.prompt)}</textarea></div>
        <div class="field"><label>负面提示词</label><input id="avatarNegative" value="${esc(state.avatarStudio.negative)}"></div>
        <div class="form-grid">
          <div class="field"><label>种子</label><input id="avatarSeed" type="number" value="${state.avatarStudio.seed}"></div>
          <div class="field"><label>尺寸</label><select id="avatarSize"><option value="768">768 × 768</option><option value="512">512 × 512</option></select></div>
        </div>
        <div class="row" style="margin-top:8px">
          <button class="btn primary" data-generate-avatar><svg><use href="#i-sparkles"/></svg>生成头像</button>
          <button class="btn" data-random-seed>换种子</button>
        </div>
        <div id="avatarUploadPane" style="display:none">
          <button class="btn" data-avatar-upload><svg><use href="#i-upload"/></svg>选择本地图片</button>
        </div>
        <div class="test-result" id="avatarError" style="display:none"></div>
      </div>
    </div>`;
}

function bindAvatarStudio(root) {
  const tabs = $$("[data-avatar-tab]", root);
  tabs.forEach((button) => {
    button.onclick = () => {
      tabs.forEach((b) => b.classList.toggle("active", b === button));
      $("#avatarPresetPane", root).style.display = button.dataset.avatarTab === "preset" ? "" : "none";
      $("#avatarCustomPane", root).style.display = button.dataset.avatarTab === "custom" ? "" : "none";
      $("#avatarUploadPane", root).style.display = button.dataset.avatarTab === "upload" ? "" : "none";
    };
  });
  $$("[data-avatar-preset]", root).forEach((button) => {
    button.onclick = () => {
      const preset = AVATAR_PROMPTS[button.dataset.avatarPreset];
      state.avatarStudio.prompt = preset.prompt;
      state.avatarStudio.negative = preset.negative;
      $("#avatarPrompt", root).value = preset.prompt;
      $("#avatarNegative", root).value = preset.negative;
      $$("[data-avatar-preset]", root).forEach((b) => b.classList.toggle("active", b === button));
    };
  });
  $("[data-random-seed]", root).onclick = () => {
    state.avatarStudio.seed = Math.floor(Math.random() * 100000);
    $("#avatarSeed", root).value = state.avatarStudio.seed;
  };
  $("[data-generate-avatar]", root).onclick = async () => {
    const preview = $("#avatarPreview", root);
    const errorBox = $("#avatarError", root);
    errorBox.style.display = "none";
    const prompt = $("#avatarPrompt", root).value.trim();
    if (prompt.length < 4) return toast("请填写头像提示词", "err");
    const seed = Number($("#avatarSeed", root).value) || undefined;
    const size = Number($("#avatarSize", root).value) || 768;
    preview.innerHTML = `<div class="loading"><span class="spinner"></span><span>正在生成，免费接口可能需要 10–60 秒…</span></div>`;
    try {
      const data = await api("/api/avatars/generate", {
        method: "POST",
        body: JSON.stringify({ prompt, negative: $("#avatarNegative", root).value, seed, width: size, height: size }),
      });
      state.avatarStudio.url = data.url;
      preview.innerHTML = `<img src="${esc(data.url)}" alt="生成的头像">`;
      $("[data-use-avatar]", $("#modalRoot")).disabled = false;
    } catch (error) {
      preview.innerHTML = `<div class="placeholder">生成失败</div>`;
      errorBox.style.display = "";
      errorBox.className = "test-result bad";
      errorBox.textContent = error.message;
    }
  };
  $("[data-avatar-upload]", root).onclick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const dataUrl = await compressImage(file);
        const data = await api("/api/avatars", { method: "POST", body: JSON.stringify({ dataUrl }) });
        state.avatarStudio.url = data.url;
        $("#avatarPreview", root).innerHTML = `<img src="${esc(data.url)}" alt="">`;
        $("[data-use-avatar]", $("#modalRoot")).disabled = false;
      } catch (error) {
        toast(error.message, "err");
      }
    };
    input.click();
  };
  $("[data-use-avatar]", $("#modalRoot")).onclick = async () => {
    if (!state.avatarStudio.url) return;
    try {
      const cropped = await cropSquare(state.avatarStudio.url);
      const saved = await api("/api/avatars", { method: "POST", body: JSON.stringify({ dataUrl: cropped }) });
      if (state.avatarStudio.onUse) {
        state.avatarStudio.onUse(saved.url);
      } else {
        const persona = state.avatarStudio.persona;
        await api("/api/personas", {
          method: "POST",
          body: JSON.stringify({ ...persona, avatar: saved.url }),
        });
        persona.avatar = saved.url;
        toast("头像已更新", "ok");
      }
      closeModal();
      renderAll();
    } catch (error) {
      toast(`使用头像失败：${error.message}`, "err");
    }
  };
}

async function cropSquare(url) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
  const side = Math.min(image.width, image.height * 0.92);
  const sx = (image.width - side) / 2;
  const sy = 0;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, sx, sy, side, side, 0, 0, 512, 512);
  return canvas.toDataURL("image/png");
}

/* ---------- settings ---------- */
function openSettings() {
  state.view = "settings";
  renderAll();
}

function renderSettings() {
  const s = state.settings;
  const image = s.imageProvider || {};
  $("#main").innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><h1>设置</h1><p>本地优先；所有会话、配置、头像都保存在 E:\\OwnChat\\data</p></div>
      </div>
      <div class="card">
        <div class="form-section-title">我的资料</div>
        <div class="form-grid">
          <div class="field"><label>昵称</label><input id="set-name" value="${esc(s.userName || "我")}"></div>
          <div class="field"><label>头像</label><div class="row">${avatarHTML(s.userAvatar, s.userName, "avatar")}<button class="btn small" id="set-avatar">更换</button></div></div>
        </div>
        <div class="form-section-title">聊天</div>
        <div class="form-grid">
          <div class="field"><label>发送键</label><select id="set-send">
            <option value="enter" ${s.sendKey !== "ctrl" ? "selected" : ""}>Enter 发送，Shift+Enter 换行</option>
            <option value="ctrl" ${s.sendKey === "ctrl" ? "selected" : ""}>Ctrl+Enter 发送，Enter 换行</option>
          </select></div>
          <div class="field"><label>上下文预算（字符）</label><input id="set-ctx" type="number" value="${esc(s.contextChars || 48000)}"></div>
          <div class="field"><label>外观</label><select id="set-theme">
            <option value="system" ${(s.theme || "system") === "system" ? "selected" : ""}>跟随系统</option>
            <option value="light" ${s.theme === "light" ? "selected" : ""}>浅色</option>
            <option value="dark" ${s.theme === "dark" ? "selected" : ""}>深色</option>
          </select></div>
          <div class="field"><label class="check"><input type="checkbox" id="set-usage" ${s.showTokenUsage !== false ? "checked" : ""}> 显示 token 用量</label></div>
          <div class="field"><label class="check"><input type="checkbox" id="set-keep" ${s.keepRunning ? "checked" : ""}> 关窗口后继续后台运行</label></div>
        </div>
        <div class="form-actions"><button class="btn primary" id="save-settings">保存设置</button></div>
      </div>

      <div class="card" style="margin-top:10px">
        <div class="form-section-title">头像生成</div>
        <div class="form-grid">
          <div class="field"><label>生图接口</label><select id="img-kind">
            <option value="pollinations" ${image.kind === "pollinations" || !image.kind ? "selected" : ""}>Pollinations 免费接口</option>
            <option value="openai" ${image.kind === "openai" ? "selected" : ""}>OpenAI 兼容 /images/generations</option>
            <option value="siliconflow" ${image.kind === "siliconflow" ? "selected" : ""}>硅基流动 Kolors</option>
          </select></div>
          <div class="field"><label>模型</label><input id="img-model" value="${esc(image.model || "flux")}" placeholder="flux / Kwai-Kolors/Kolors"></div>
          <div class="field"><label>Base URL（非 Pollinations）</label><input id="img-base" value="${esc(image.baseUrl || "")}" placeholder="https://api.siliconflow.cn/v1"></div>
          <div class="field"><label>API Key</label><input id="img-key" type="password" placeholder="${image.apiKeyEnc ? "已保存，留空不修改" : "可空"}"></div>
        </div>
        <div class="hint" style="margin-top:6px">默认 Pollinations 无需 Key，但只有写实向模型、会限流且可能带水印；精细二次元建议填自己的图片 API（硅基流动 Kolors / OpenAI 兼容）。</div>
        <div class="form-actions"><button class="btn" id="save-image-settings">保存生图设置</button></div>
      </div>

      <div class="card" style="margin-top:10px">
        <div class="form-section-title">数据</div>
        <div class="row" style="flex-wrap:wrap">
          <button class="btn" id="export-data"><svg><use href="#i-download"/></svg>导出 JSON（不含 Key）</button>
          <button class="btn" id="import-data"><svg><use href="#i-upload"/></svg>导入 JSON</button>
          <button class="btn" id="bulk-delete"><svg><use href="#i-trash"/></svg>批量删除会话</button>
          <button class="btn" id="open-data">打开数据目录</button>
        </div>
        <div class="hint" style="margin-top:8px">API Key 使用本机随机密钥 AES-256-GCM 加密；服务只监听 127.0.0.1。导入的会话不会覆盖已有会话。</div>
      </div>

      <div class="card" style="margin-top:10px">
        <div class="form-section-title">关于</div>
        <div class="row" style="justify-content:space-between">
          <span class="muted small">OwnChat ${esc(state.boot?.version || "0.2.0")} · 本地多模型聊天</span>
          <span class="row">
            <button class="btn small" id="check-update"><svg><use href="#i-refresh"/></svg>检查更新</button>
            <button class="btn small" id="about-link">说明</button>
          </span>
        </div>
        <div class="test-result" id="updateBox" style="display:none"></div>
      </div>
    </div>`;
  $("#save-settings").onclick = saveSettings;
  $("#save-image-settings").onclick = saveImageSettings;
  $("#set-avatar").onclick = () => openUserAvatarStudio();
  $("#export-data").onclick = exportData;
  $("#import-data").onclick = importWorkspace;
  $("#bulk-delete").onclick = openBulkDelete;
  $("#open-data").onclick = () => toast("数据目录：E:\\OwnChat\\data");
  $("#about-link").onclick = openAbout;
  $("#check-update").onclick = () => checkForUpdates(true);
}

async function saveSettings() {
  try {
    const data = await api("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({
        userName: $("#set-name").value.trim() || "我",
        sendKey: $("#set-send").value,
        contextChars: Number($("#set-ctx").value) || 48000,
        theme: $("#set-theme").value,
        showTokenUsage: $("#set-usage").checked,
        keepRunning: $("#set-keep").checked,
      }),
    });
    state.settings = data.settings;
    applyTheme();
    toast("设置已保存", "ok");
    renderRail();
  } catch (error) {
    toast(error.message, "err");
  }
}

async function saveImageSettings() {
  try {
    const data = await api("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({
        imageProvider: {
          kind: $("#img-kind").value,
          model: $("#img-model").value.trim(),
          baseUrl: $("#img-base").value.trim(),
          apiKey: $("#img-key").value,
        },
      }),
    });
    state.settings = data.settings;
    toast("生图设置已保存", "ok");
  } catch (error) {
    toast(error.message, "err");
  }
}

function openUserAvatarStudio() {
  openAvatarStudio({ name: state.settings.userName || "我", avatar: state.settings.userAvatar }, async (url) => {
    const data = await api("/api/settings", { method: "PATCH", body: JSON.stringify({ userAvatar: url }) });
    state.settings = data.settings;
    renderRail();
    renderChat();
  });
}

async function exportData() {
  try {
    const data = await api("/api/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ownchat-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("已导出（不含 API Key）", "ok");
  } catch (error) {
    toast(error.message, "err");
  }
}

function openAbout() {
  openModal({
    title: "关于 OwnChat",
    body: `
      <div class="confirm-text" style="line-height:1.8">
        <b>OwnChat ${esc(state.boot?.version || "0.2.0")}</b><br>
        本地优先的多模型聊天应用。每个会话独立绑定接口、模型与人格，背后是真实的大模型。<br><br>
        <b>数据</b>：所有会话、配置、头像都保存在本机 <code>data</code> 目录；API Key 使用 AES-256-GCM 加密，服务只监听 <code>127.0.0.1</code>，不注册、不埋点、不上云。<br><br>
        <b>许可</b>：AGPL-3.0-or-later。0.1.0 及更早版本以 MIT 发布，该授权对这些版本继续有效。<br><br>
        <b>提示</b>：免费 API 的额度与模型随时可能变化；头像生成默认使用 Pollinations，可能限流或带水印。
      </div>`,
    foot: `<div class="spacer"></div><button class="btn primary" data-close>知道了</button>`,
    onMount: (root) => {
      $("[data-close]", root).onclick = closeModal;
    },
  });
}

/* ---------- theme ---------- */
function applyTheme() {
  const mode = state.settings?.theme || "system";
  const prefersDark = (() => {
    try {
      return Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    } catch {
      return false;
    }
  })();
  const dark = mode === "dark" || (mode === "system" && prefersDark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  try {
    localStorage.setItem("ownchat.theme", mode);
  } catch {}
}

try {
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  media?.addEventListener?.("change", () => {
    if ((state.settings?.theme || "system") === "system") applyTheme();
  });
} catch {}

/* ---------- update check ---------- */
async function checkForUpdates(manual = false) {
  if (!manual && !state.boot) return null;
  const box = $("#updateBox");
  if (manual && box) {
    box.style.display = "";
    box.className = "test-result";
    box.textContent = "正在检查 GitHub Releases…";
  }
  try {
    const data = await api(`/api/update${manual ? "?force=1" : ""}`);
    state.update = data;
    if (box && state.view === "settings") {
      box.style.display = "";
      if (data.error) {
        box.className = "test-result bad";
        box.textContent = `检查失败：${data.error}（离线时属正常）`;
      } else if (data.hasUpdate) {
        box.className = "test-result ok";
        box.innerHTML = `有新版本 <b>${esc(data.latest)}</b>（当前 ${esc(data.current)}）<br><a href="${esc(data.url)}" target="_blank" rel="noopener noreferrer">打开发布页</a>`;
      } else {
        box.className = "test-result ok";
        box.textContent = `已是最新版本（${data.current}）`;
      }
    }
    if (!manual && data.hasUpdate) toast(`有新版本 ${data.latest}，可在设置里查看`, "ok");
    return data;
  } catch (error) {
    if (box) {
      box.style.display = "";
      box.className = "test-result bad";
      box.textContent = `检查失败：${error.message}`;
    }
    if (manual) toast(error.message, "err");
    return null;
  }
}

/* ---------- conversation export / import ---------- */
async function exportConversation(id) {
  try {
    const data = await api(`/api/conversations/${id}/export`);
    const conversation = convOf(id);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ownchat-${(conversation?.title || "conversation").replace(/[^\w\u4e00-\u9fa5-]+/g, "-").slice(0, 40)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("会话已导出", "ok");
  } catch (error) {
    toast(`导出失败：${error.message}`, "err");
  }
}

function importWorkspace() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const data = await api("/api/import", { method: "POST", body: JSON.stringify(payload) });
      state.conversations = data.conversations || state.conversations;
      for (const conversation of state.conversations) delete state.messages[conversation.id];
      if (state.activeId) await loadMessages(state.activeId);
      renderAll();
      toast(`已导入 ${data.added} 个会话`, "ok");
    } catch (error) {
      toast(`导入失败：${error.message}`, "err");
    }
  };
  input.click();
}

function openBulkDelete() {
  const rows = state.conversations
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map((c) => `
      <label class="check bulk-row">
        <input type="checkbox" data-bulk-id="${c.id}">
        <span class="bulk-title">${esc(c.title || "新对话")}${c.archived ? ' <span class="tag">已归档</span>' : ""}</span>
        <span class="muted small">${esc(formatTime(c.updatedAt))}</span>
      </label>`)
    .join("");
  openModal({
    title: "批量删除会话",
    sub: `共 ${state.conversations.length} 个会话；删除后无法恢复`,
    body: `<div class="bulk-list">${rows || '<div class="empty-list">没有会话</div>'}</div>`,
    foot: `<div class="spacer"></div><button class="btn" data-close>取消</button><button class="btn danger" data-confirm disabled>删除选中</button>`,
    onMount: (root) => {
      const confirm = $("[data-confirm]", root);
      const refresh = () => {
        const picked = $$("[data-bulk-id]:checked", root).length;
        confirm.disabled = picked === 0;
        confirm.textContent = picked ? `删除 ${picked} 个会话` : "删除选中";
      };
      $$("[data-bulk-id]", root).forEach((box) => box.addEventListener("change", refresh));
      $("[data-close]", root).onclick = closeModal;
      confirm.onclick = async () => {
        const ids = $$("[data-bulk-id]:checked", root).map((box) => box.dataset.bulkId);
        if (!ids.length) return;
        try {
          const data = await api("/api/conversations/bulk-delete", {
            method: "POST",
            body: JSON.stringify({ ids }),
          });
          state.conversations = data.conversations || state.conversations.filter((c) => !ids.includes(c.id));
          for (const id of ids) delete state.messages[id];
          if (!state.conversations.some((c) => c.id === state.activeId)) {
            state.activeId = state.conversations[0]?.id || null;
          }
          closeModal();
          renderAll();
          toast(`已删除 ${data.removed} 个会话`, "ok");
        } catch (error) {
          toast(error.message, "err");
        }
      };
    },
  });
}

/* ---------- model capabilities ---------- */
function openModelCapabilities(provider, model) {
  if (!provider) return;
  const caps = {
    vision: Boolean(model.vision),
    contextWindow: Number(model.contextWindow) || 128000,
    maxOutput: Number(model.maxOutput || model.maxTokens) || 4096,
    reasoningEffort: model.reasoningEffort || "",
  };
  openModal({
    title: `${model.name || model.id} · 能力`,
    sub: `${provider.name} · ${model.id}`,
    narrow: true,
    body: `
      <div class="form-grid">
        <div class="field full"><label class="check"><input type="checkbox" id="cap-vision" ${caps.vision ? "checked" : ""}> 支持图片输入</label></div>
        <div class="field"><label>上下文窗口（tokens）</label><input id="cap-context" type="number" value="${caps.contextWindow}"></div>
        <div class="field"><label>最大输出（tokens）</label><input id="cap-max" type="number" value="${caps.maxOutput}"></div>
        <div class="field full"><label>推理强度</label><select id="cap-effort">
          <option value="" ${caps.reasoningEffort ? "" : "selected"}>不发送</option>
          <option value="low" ${caps.reasoningEffort === "low" ? "selected" : ""}>low</option>
          <option value="medium" ${caps.reasoningEffort === "medium" ? "selected" : ""}>medium</option>
          <option value="high" ${caps.reasoningEffort === "high" ? "selected" : ""}>high</option>
        </select><div class="hint">会透传到请求的 reasoning_effort 字段；上游不支持时会报错，改回「不发送」即可。</div></div>
      </div>`,
    foot: `<div class="spacer"></div><button class="btn" data-close>取消</button><button class="btn primary" data-save-cap>保存</button>`,
    onMount: (root) => {
      $("[data-close]", root).onclick = closeModal;
      $("[data-save-cap]", root).onclick = async () => {
        try {
          const data = await api(`/api/providers/${provider.id}/capabilities`, {
            method: "POST",
            body: JSON.stringify({
              modelId: model.id,
              vision: $("#cap-vision", root).checked,
              contextWindow: Number($("#cap-context", root).value) || 0,
              maxOutput: Number($("#cap-max", root).value) || 0,
              reasoningEffort: $("#cap-effort", root).value,
            }),
          });
          Object.assign(model, data.model);
          closeModal();
          toast("模型能力已保存", "ok");
        } catch (error) {
          toast(error.message, "err");
        }
      };
    },
  });
}

/* ---------- full-text search ---------- */
async function runSearch() {
  const query = state.search;
  if (!query) {
    state.searchResults = [];
    state.searching = false;
    renderSidebar();
    return;
  }
  state.searching = true;
  renderSidebar();
  try {
    const data = await api(`/api/search?q=${encodeURIComponent(query)}&limit=80`);
    if (state.search !== query) return;
    state.searchResults = data.results || [];
  } catch (error) {
    state.searchResults = [];
    toast(`搜索失败：${error.message}`, "err");
  } finally {
    if (state.search === query) {
      state.searching = false;
      renderSidebar();
    }
  }
}

function renderSearchResults() {
  const root = $("#convList");
  if (state.searching && state.searchResults.length === 0) {
    root.innerHTML = `<div class="empty-list">搜索中…</div>`;
    return;
  }
  if (state.searchResults.length === 0) {
    root.innerHTML = `<div class="empty-list">没有匹配的消息</div>`;
    return;
  }
  root.innerHTML = state.searchResults
    .map((hit) => `
      <div class="conv hit" data-hit-conv="${esc(hit.conversationId)}">
        <div class="conv-main">
          <div class="conv-top">
            <span class="conv-name">${esc(hit.conversationTitle || "新对话")}</span>
            <span class="conv-time">${esc(formatTime(hit.createdAt))}</span>
          </div>
          <div class="preview"><span class="preview-text">${esc(hit.snippet)}</span></div>
        </div>
      </div>`)
    .join("");
  $$("[data-hit-conv]", root).forEach((el) => {
    el.addEventListener("click", async () => {
      const id = el.dataset.hitConv;
      state.search = "";
      state.searchResults = [];
      const input = $("#searchInput");
      if (input) input.value = "";
      await selectConversation(id);
    });
  });
}

/* ---------- boot ---------- */
init();
