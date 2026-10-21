# Changelog

All notable changes to OwnChat are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

Only `MAJOR.MINOR.0` releases (0.1.0, 0.2.0, …, 1.0.0) receive installer
assets on GitHub Releases. Patch releases are source-only.

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

[Unreleased]: https://github.com/KovacBro/OwnChat/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/KovacBro/OwnChat/releases/tag/v0.2.0
[0.1.0]: https://github.com/KovacBro/OwnChat/releases/tag/v0.1.0
