# OwnChat Roadmap

This document is the public plan for OwnChat. It is intentionally
conservative: the product is a local-first desktop chat client, not a general
agent platform.

## Version policy

- Semantic versioning: `MAJOR.MINOR.PATCH`.
- **Only `MAJOR.MINOR.0` gets installer assets** (0.1.0, 0.2.0, …, 1.0.0).
- Patch releases (`0.2.1`, `0.2.2`, …) are source-only tags; they do not
  receive an installer.
- Old releases are never deleted or overwritten. GitHub Releases always keeps
  every minor version, and the right sidebar points at the latest one.
- Pre-release builds (`-beta.1`) are source-only unless explicitly announced.

## 0.2.0 — Reliable daily driver

Target: **2026-11-15**. Theme: fewer dead ends, clearer state, safer upgrades.

### P0 — must ship

1. **WorkBuddy account and region UX**
   - Switch accounts without editing files.
   - Show CN / Global region, signed-in account, token expiry, and model count.
   - Disable model choices that cannot serve the current account.
   - One-click refresh after signing in to WorkBuddy.
2. **Per-model capabilities**
   - Edit vision, context window, max output, and reasoning effort per model.
   - Preserve capabilities when a provider refreshes its `/models` list.
   - Show capability badges in the model picker.
3. **Chat reliability**
   - Automatic one-shot retry for 429 / 5xx / transient network errors.
   - No duplicate user or assistant messages when a retry succeeds.
   - Show the provider error code and a copyable diagnostic line.
   - Display token usage per assistant message.
   - Show a subtle notice when history is trimmed by the context budget.
4. **Conversation management**
   - Full-text search across message contents.
   - Archive / unarchive; keep the main list focused.
   - Export / import a conversation or the whole workspace.
   - Bulk delete with confirmation.
5. **Dark theme**
   - Follow system by default; manual light/dark override.
   - Keep the current green accent and bubble geometry.
6. **Installer and upgrade**
   - Check for a newer minor release from GitHub Releases.
   - Upgrade in place while preserving `data/`.
   - Show the installed version in Settings.
   - Document the uninstall data-preservation behavior.

### P1 — should ship if time allows

- Prompt library: save and reuse system prompts.
- Persona import/export (JSON, no secrets).
- Code block copy button and language label.
- Image lightbox and “save image”.
- Resizable sidebar and conversation list.
- Keyboard shortcuts: new chat, search, switch model, stop generation.
- Provider duplicate action (API key not copied).

### Non-goals for 0.2.0

- Voice input or TTS. Voice is not in the product roadmap.
- Mobile apps.
- Cloud sync.
- Plugin marketplace.
- General-purpose agent tools / MCP execution.
- Native Anthropic Messages or Gemini protocols.

### Acceptance criteria

- [ ] Switching WorkBuddy CN/Global and accounts works without restarting.
- [ ] A 429/5xx during generation is retried once and produces exactly one
      user message and one assistant message.
- [ ] Vision / context / reasoning settings survive a model refresh.
- [ ] Conversation export → import round-trips messages, images, and persona
      binding.
- [ ] 1,000-message conversation opens without blocking the UI.
- [ ] Dark theme passes basic contrast checks for text, bubbles, and buttons.
- [ ] In-place installer upgrade keeps `data/` and the existing account
      configuration.
- [ ] `0.2.0` release contains `OwnChat-0.2.0-win64-setup.exe`; `0.2.1`
      contains no installer.

## Later milestones

| Version | Theme | Likely scope |
|---|---|---|
| 0.3.0 | Attachments and richer chat | File attachments, PDF/text extraction preview, better markdown, message branching |
| 0.4.0 | Workflows | Prompt templates, multi-step chat presets, scheduled local prompts |
| 0.5.0 | Scale and control | Parallel generation across conversations, provider routing rules, usage dashboard |
| 1.0.0 | Stable | Frozen data schema, migration tooling, signed installers, stable provider API, docs site |

These later items are directional, not commitments. They will be refined in
their own planning documents.

## How planning happens

1. Open an issue with the problem, user impact, and a minimal proposal.
2. Add accepted items to this roadmap with a target minor version.
3. Keep one minor release focused on one theme.
4. Patch releases only fix regressions or security issues.

See [docs/RELEASING.md](docs/RELEASING.md) for the release checklist.
