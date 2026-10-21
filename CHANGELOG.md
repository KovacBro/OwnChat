# Changelog

All notable changes to OwnChat are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

Only `MAJOR.MINOR.0` releases (0.1.0, 0.2.0, …, 1.0.0) receive installer
assets on GitHub Releases. Patch releases are source-only.

## [Unreleased] — 0.2.0

### Planned

- WorkBuddy account switcher and clearer global/CN region status.
- Per-model capability editing (vision, context window, reasoning effort).
- Better provider error diagnostics and one-click retry.
- Conversation search, archive, export/import.
- Dark theme.
- Installer update check and data-preserving upgrade path.

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

[Unreleased]: https://github.com/KovacBro/OwnChat/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/KovacBro/OwnChat/releases/tag/v0.1.0
