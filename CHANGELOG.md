# Changelog

All notable changes to OwnChat are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

Only `MAJOR.MINOR.0` releases (0.1.0, 0.2.0, …, 1.0.0) receive installer
assets on GitHub Releases. Patch releases are source-only.

## [0.2.1] — 2026-10-22

三个国内平台的直连预设。它们**独立于「娘」人格**存在：用默认助手人格，
不带头像设定，点一下就能建会话。

### Added

- **求索（DeepSeek 官方接口）** — `https://api.deepseek.com/v1`
  定位：通用对话与写作。中文强、模型少而稳（`deepseek-chat` / `deepseek-reasoner`）、按量计费。
- **百炼（阿里云百炼）** — `https://dashscope.aliyuncs.com/compatible-mode/v1`
  定位：长上下文与多模态。通义千问全系（`qwen-plus` / `qwen-max` / `qwen-vl`），适合长文档、图片输入、企业级稳定调用。
- **方舟（火山方舟）** — `https://ark.cn-beijing.volces.com/api/v3`
  定位：豆包系列，角色与语音场景。需先在方舟控制台创建「推理接入点」，模型名填 `ep-` 开头的 ID。
- 「新建会话」弹窗拆成 **人格 / 平台直连 / 任意模型** 三段。平台卡片显示当前状态
  （未配置 / 待拉取模型 / N 个模型）；未配置时点击直接打开预填好的接口表单。
- 新增内置的「助手」人格（`hidden`，不出现在人格列表里），供平台直连使用。

### Fixed

- 旧版本数据在升级后会自动补上「助手」人格，不需要手动迁移。

### Notes

- 这三个入口**不内置 Key、不代注册**。Key 要到对应平台的控制台自己申请。
- 「求索」只是界面里的显示名，接口地址仍是 DeepSeek 官方域名。
- 按项目原来的规则，`MAJOR.MINOR.0` 才发安装包，0.2.1 本应是纯源码标签。
  这次为了让已经装了 0.2.0 的用户能直接升级，破例附带了安装包，规则待确认后再改。



## [0.2.0] — 2026-10-22

Theme: reliable daily driver. No new dependencies, no cloud, no telemetry.

### Added

- **Dark theme** — follow system, or force light / dark.
- **Full-text search** across every message, with snippets and jump-to-conversation.
- **Archive / unarchive** conversations, plus a sidebar switch between active and
  archived lists.
- **Per-model capabilities** — vision, context window, max output and reasoning
  effort, editable per model and preserved when a provider refreshes `/models`.
- **One-shot automatic retry** for network / 429 / 5xx failures before the first
  token. A failed turn never produces a duplicate user or assistant message.
- **Copyable diagnostic code** on every provider error (`EU-<code>-<status>-<id>`).
- **Token usage** per assistant message (`↑prompt ↓completion`), toggleable.
- **Context trim notice** when older turns are dropped to fit the model budget.
- **Conversation export**, **workspace import** (merge, never overwrite) and
  **bulk delete** with confirmation.
- **Update check** against GitHub Releases, and the installed version in Settings.
- Chinese README (`README.zh-CN.md`).

### Changed

- **License: MIT → AGPL-3.0.** Versions up to and including `v0.1.0` stay under
  MIT; that grant is irrevocable. `0.2.0` and later are AGPL-3.0-or-later.
- **README rewritten** around "one window for every model, local-first". The
  third-party integration moved to an advanced section with an explicit
  disclaimer that OwnChat provides no third-party account, quota or subscription.
- **Installer upgrade** now stops a running instance before overwriting files
  (via `taskkill`, no PowerShell dependency) and verifies the target directory is
  writable before copying, so a permissions problem shows a readable Chinese
  message instead of `Error 5: 拒绝访问`. `data/` is never touched by install,
  upgrade or uninstall.
- Added `scripts/screenshots.ps1` (headless, demo-profile screenshots) and
  `scripts/release.ps1` (syntax gate → build → tag → `gh release create`).
- **Model list refresh** merges into the stored list instead of replacing it, so
  hand-edited capabilities survive.
- **WorkBuddy provider cards** show region, account, token expiry and model count.
- Added `.github/` community files: issue forms, CONTRIBUTING (no dependencies,
  no telemetry, no third-party quota features, `127.0.0.1` only) and SECURITY.

### Fixed

- A cold start opened **two** windows: the launcher opened one and
  `node server.js --open` opened another. The launcher is now the only owner of
  the window; the server only watches whether it is still open.
- Desktop shortcut is created by default. It used to be opt-in, so most users
  never found it and only had the Start Menu entry.
- The app window and taskbar now use the OwnChat icon instead of a persona
  avatar, which looked like a different product.
- A second launch no longer starts a second server over the same `data/`
  directory. A lock file plus a liveness check makes the new process exit and
  reuse the running instance.
- Closing the window can keep the server alive (Settings → 关窗口后继续后台运行),
  so a long session survives; reopen it from the same shortcut.

### Notes

- Smoke-test pass on a real Windows install is still required; this changelog
  describes the implementation, not a verified build.

See [ROADMAP.md](ROADMAP.md) for scope, non-goals, and acceptance criteria.

## [0.1.0] — 2026-10-21

First public baseline. Windows x64 installer:
[OwnChat-0.1.0-win64-setup.exe](https://github.com/KovacBro/OwnChat/releases/tag/v0.1.0).

### Added

- Three-column desktop UI (icon rail + conversation list + chat) built for
  Microsoft Edge `--app` windows.
- Multi-conversation chat with an independent `Provider + Model + Persona`
  binding per conversation.
- Direct WorkBuddy integration by reusing the local
  `dsh-connect-workbuddy` credential store, token refresh, model catalog,
  and upstream SSE protocol. No 8787 gateway required.
- WorkBuddy CN and Global provider slots; the UI hides models when the region
  has no local sign-in.
- Streaming responses, stop, retry, copy, error states, and a collapsible
  reasoning block.
- Text, Emoji picker, and image input (up to 4 images, local compression).
  Vision capability is checked before sending.
- Provider configuration page with Base URL, API Key, model, context window,
  temperature, Top P, custom headers/body, timeout, vision toggle, test
  connection, and model discovery.
- Presets for OpenRouter, Google Gemini, Groq, SiliconFlow, Zhipu BigModel,
  ModelScope, Mistral, Cerebras, GitHub Models, Ollama, and custom endpoints.
- Persona system with DeepSeek娘 / GLM娘 / Hy3娘 presets and a generic
  AI persona.
- Avatar Studio with three preset prompts, custom prompt/negative/seed,
  local upload, and optional OpenAI-compatible or SiliconFlow image APIs.
- WorkBuddy download center: official Windows x64 installer, progress,
  pause/resume, SHA-256, Authenticode signature check, open folder, and
  run installer.
- Local-first storage with per-conversation message files, AES-256-GCM
  encryption for API keys, and key-free JSON export.
- One-click startup via `start.bat`; one-click stop via `stop.bat`.
- Windows installer built with Inno Setup, bundling Node.js so users do not
  need a separate Node installation.

### Security

- Server binds to `127.0.0.1` only.
- API keys never returned to the browser; only `hasKey` is exposed.
- Downloaded WorkBuddy installer is verified with SHA-256 and Windows
  Authenticode.
- Third-party WorkBuddy credentials remain in the user's existing vault;
  OwnChat does not copy or upload them.

### Known limitations

- Light theme only.
- Voice is not in the product roadmap.
- File and screenshot sending are not available yet.
- Anthropic Messages and Gemini native protocols are not implemented;
  Claude can be used through OpenRouter or another OpenAI-compatible gateway.
- WorkBuddy multi-account auto-rotation is not exposed in OwnChat yet.
- No cloud sync; data stays on the local machine.

[Unreleased]: https://github.com/KovacBro/OwnChat/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/KovacBro/OwnChat/releases/tag/v0.2.1
[0.2.0]: https://github.com/KovacBro/OwnChat/releases/tag/v0.2.0
[0.1.0]: https://github.com/KovacBro/OwnChat/releases/tag/v0.1.0
