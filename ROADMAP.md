# OwnChat Roadmap

This document is the public plan for OwnChat. It is intentionally
conservative: the product is a local-first desktop chat client, not a general
agent platform.

## Version policy

- Semantic versioning: `MAJOR.MINOR.PATCH`.
- Minor releases normally get installer assets.
- Patch releases are source-only by default. A patch may ship an installer when
  it contains a migration or security fix that has to reach existing installs;
  the release notes must say so.
- Old releases are never deleted or overwritten. GitHub Releases keeps every
  published version.

## 0.2.3 — provider setup, minus the old bridge

Status: **implemented 2026-10-22**. Patch release with a documented installer
exception.

- Remove the old local third-party credential bridge and its provider slots.
- Replace manual endpoint entry with provider presets: base URL, protocol and
  common models are prefilled; the user supplies the API key.
- Add a short setup guide, console link and docs link to every preset.
- Fetch the provider's model list after saving; keep the provider if discovery
  fails and explain why.
- Require a per-launch token for the local API, check local `Origin`/`Host`, and
  reject non-JSON state-changing requests.
- Clean up stale providers, personas and conversations on upgrade.

## 0.3.0 — attachments and richer chat

- File attachments with PDF/text extraction preview.
- Better Markdown rendering and message branching.
- Image lightbox and “save image”.
- Resizable sidebar and conversation list.
- Keyboard shortcuts: new chat, search, switch model, stop generation.

## Later milestones

| Version | Theme | Likely scope |
|---|---|---|
| 0.4.0 | Workflows | Prompt templates, multi-step chat presets, scheduled local prompts |
| 0.5.0 | Scale and control | Parallel generation across conversations, provider routing rules, usage dashboard |
| 1.0.0 | Stable | Frozen data schema, migration tooling, signed installers, stable provider API, docs site |

These later items are directional, not commitments. They will be refined in
their own planning documents.

## Non-goals

- Voice input or TTS.
- Mobile apps.
- Cloud sync.
- A general-purpose agent platform or MCP execution.
- Native Anthropic Messages or Gemini protocols; use an OpenAI-compatible
  gateway instead.

## How planning happens

1. Open an issue with the problem, user impact, and a minimal proposal.
2. Add accepted items to a single minor milestone.
3. Keep one minor release focused on one theme.
4. Patch releases only fix regressions or security issues.

See [docs/RELEASING.md](docs/RELEASING.md) for the release checklist.
