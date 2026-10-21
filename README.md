<p align="center">
  <img src="docs/assets/app-preview-0.2.3.png" alt="OwnChat providers page" width="920">
</p>

<h1 align="center">OwnChat</h1>

<p align="center">
  <b>One window for every model. Local-first, no account, no telemetry.</b><br>
  Each conversation keeps its own provider, model and persona.
</p>

<p align="center">
  <a href="https://github.com/KovacBro/OwnChat/releases/latest"><img src="https://img.shields.io/github/v/release/KovacBro/OwnChat?label=download&style=for-the-badge&color=15AC70" alt="Download"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-15AC70?style=for-the-badge" alt="License"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-0078D4?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/node-%3E%3D22-339933?style=for-the-badge" alt="Node">
</p>

<p align="center">
  <a href="README.zh-CN.md">中文说明</a> ·
  <a href="#install">Install</a> ·
  <a href="#bring-your-own-key">Providers</a> ·
  <a href="#privacy-and-boundaries">Privacy</a> ·
  <a href="#faq">FAQ</a>
</p>

---

## What it is

OwnChat is a Windows desktop chat client for people who already use more than one
AI model. Open a conversation, pin it to a provider, model and persona — and
switch models a hundred times without losing a single message.

It runs entirely on your machine: a small local server on `127.0.0.1`, your API
keys encrypted at rest, and no cloud account of any kind.

## What changed in 0.2.3

- **Provider presets instead of manual endpoint setup.** Pick a provider; its
  base URL, protocol and common models are already filled in. You bring the key.
- **A short setup guide for every preset.** The form links to the provider's
  console and docs and lists the 3–4 steps needed to get a key.
- **The old local third-party credential bridge is gone.** OwnChat now only talks
  to OpenAI-compatible endpoints you configure yourself, and never reads another
  app's login state.
- **The local API now requires a per-launch token.** The server still binds only
  to `127.0.0.1`, and also checks `Origin`/`Host` plus JSON content types.
- **Upgrade cleanup.** Providers and model bindings left behind by the removed
  bridge are cleared on startup.

Full notes: [`docs/releases/0.2.3.md`](docs/releases/0.2.3.md).

## Why people use it

**One window, every model.** DeepSeek, Alibaba Bailian, Volcengine Ark, Zhipu
BigModel, Kimi, Tencent Hunyuan, SiliconFlow, OpenRouter, Gemini, Groq, Mistral,
GitHub Models, Azure OpenAI, a local Ollama — or any OpenAI-compatible endpoint.
Each conversation remembers its own `provider + model + persona`.

**Genuinely local.** No telemetry, no analytics, no sign-in. Keys are encrypted
with AES-256-GCM and never returned to the browser. The HTTP server binds to
`127.0.0.1` only, and state-changing calls need a token generated at launch.

**Light on the machine.** No bundled Electron runtime — OwnChat uses the Edge
engine already installed on Windows and opens as a frameless app window. The
whole thing is plain Node and vanilla JS, with zero npm dependencies.

**Yours to audit.** AGPL-3.0. Read the proxy, read the storage layer, fork it if
you disagree with a design decision.

## Status

`0.2.x` is an early release. The data format may still change before `1.0.0`;
export your workspace before upgrading across minor versions. Windows only for
now. The installer is not code-signed yet — see [FAQ](#faq).

`0.2.3` is a patch release. It ships an installer because the removal of the old
bridge needs to reach existing installs; the project normally keeps patch
releases source-only.

## Install

### Windows installer (recommended)

1. Open **[Releases](https://github.com/KovacBro/OwnChat/releases/latest)**.
2. Download `OwnChat-<version>-win64-setup.exe`.
3. Run it. Per-user install into `%LOCALAPPDATA%\Programs\OwnChat`; no admin
   rights needed.
4. Launch **OwnChat** from the Start Menu.

The installer bundles Node.js — you do not need a separate Node installation.

### Portable ZIP

Download `OwnChat-<version>-win64-portable.zip`, extract, run `start.bat`
(or `start.vbs` for a hidden launcher).

### From source

```powershell
git clone https://github.com/KovacBro/OwnChat.git
cd OwnChat
node server.js
```

Requires Node.js 22+ and Microsoft Edge.

## Bring your own key

OwnChat ships with no keys and no quota. You point it at a provider you already
pay for, or at a free tier you registered yourself.

Open **API**, pick a preset, paste your key, click **Save and connect**. The base
URL is already set; after saving, OwnChat calls the provider's `/models` endpoint
and fills in the current model list.

<p align="center">
  <img src="docs/assets/provider-setup-0.2.3.png" alt="Provider setup form" width="760">
</p>

### Built-in presets

| Provider | Base URL | Key |
|---|---|---|
| **DeepSeek** | `https://api.deepseek.com` | Required |
| **Alibaba Bailian** | `https://dashscope.aliyuncs.com/compatible-mode/v1` | Required |
| **Volcengine Ark** | `https://ark.cn-beijing.volces.com/api/v3` | Key + endpoint ID |
| **Zhipu BigModel** | `https://open.bigmodel.cn/api/paas/v4` | Required |
| **Kimi** | `https://api.moonshot.cn/v1` | Required |
| **Tencent Hunyuan** | `https://api.hunyuan.cloud.tencent.com/v1` | Required |
| **SiliconFlow** | `https://api.siliconflow.cn/v1` | Required |
| **OpenRouter** | `https://openrouter.ai/api/v1` | Required |
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta/openai/` | Required |
| **Groq** | `https://api.groq.com/openai/v1` | Required |
| **Mistral** | `https://api.mistral.ai/v1` | Required |
| **GitHub Models** | `https://models.github.ai/inference` | GitHub token |
| **Ollama (local)** | `http://127.0.0.1:11434/v1` | None |
| **Azure OpenAI** | Your resource endpoint | Key + deployment |
| **Custom** | Any OpenAI-compatible URL | Optional |

Each preset includes its own console link, docs link and step-by-step setup notes.
If a provider renames a model, use **Refresh models** — no code change needed.

### Notes for specific providers

- **Volcengine Ark** creates an inference endpoint per model; the model ID is the
  `ep-…` string, not the public model name.
- **GitHub Models** works with a fine-grained token that has only Models read
  access. Do not grant repository permissions.
- **Ollama** needs `ollama pull <model>` and a running local server on port 11434.
- **Azure OpenAI** needs the endpoint, key, deployment name and API version in
  the advanced section.
- **Anything else** can go through **Custom**, as long as it implements
  `/chat/completions`.

Every provider card also exposes context window, max output, temperature, Top P,
custom headers/body, timeout, vision capability, connection test and model
discovery.

Free tiers and model IDs change constantly. OwnChat does not bundle any keys and
does not promise unlimited free usage.

## Privacy and security

```text
data/
  index.json               settings, providers, personas, conversation index
  conversations/<id>.json  messages per conversation
  uploads/                 chat images
  avatars/                 generated / uploaded avatars
  .master-key              per-install AES-256-GCM key
  edge-profile/            Edge app profile
```

- API keys are encrypted at rest; the frontend only ever receives `hasKey`.
- Export excludes API keys.
- No cloud sync, no telemetry, no crash reporting.
- The server binds to `127.0.0.1` only; API calls need a per-launch token and are
  checked for local `Origin`/`Host`.
- Local application-level encryption is not a substitute for Windows Credential
  Manager against an administrator-level attacker.

Your prompts and replies go to the provider **you** configured, and nowhere
else. If you use an overseas endpoint, your data leaves your machine — that is
your choice to make, and the app does not hide it.

## Privacy and boundaries

OwnChat does one thing: it sends what you type to the model endpoint you
configured and brings the reply back.

- It does **not** provide, resell or share any third-party account, subscription,
  quota or API key.
- It does **not** read another app's login credentials, and it does not require a
  third-party desktop client to work.
- Use only keys you are entitled to use, and follow the provider's terms, billing
  rules and regional restrictions.
- The provider decides how your input is processed, whether it is used for
  training, and where it is stored. That is between you and the provider.
- OwnChat is not affiliated with DeepSeek, Alibaba, Volcengine, Zhipu, Moonshot,
  Tencent, OpenRouter, Google, Groq, Mistral, GitHub or Microsoft, and is not
  endorsed by them.
- Third-party names are trademarks of their respective owners and are used only
  to describe compatibility.

For organisational use, confirm account ownership, the data processing
agreement, cross-border transfer, employee notice and confidentiality
requirements first. OwnChat is a local tool; it does not complete those
organisational obligations for you.

## Enterprise and private deployment

OwnChat is a single-process local app, which makes it easy to run inside a
network that has no route to the public internet: point it at an intranet
OpenAI-compatible gateway or a local Ollama, and the chat data never leaves the
machine.

The team build (policy-controlled providers, shared persona packs, audit logs,
offline model management) is in progress. If you are evaluating OwnChat for an
organisation, open a discussion or mail the address in the repo profile.

## Screenshots

| Providers | Setup |
|---|---|
| ![Providers](docs/assets/app-preview-0.2.3.png) | ![Setup](docs/assets/provider-setup-0.2.3.png) |

## FAQ

**Do I need an account?** No. There is no sign-up, no login, no device limit.

**Where does my data go?** Only to the provider you configure. See
[Privacy and security](#privacy-and-security).

**Is my key uploaded?** Not to OwnChat's servers. It is encrypted locally and sent
only to the provider you selected.

**Is it code-signed?** Not yet. Windows SmartScreen may say "Unknown publisher";
verify `SHA256SUMS.txt` from the release assets. Code signing is planned for
`1.0.0`.

**Does it work offline?** Yes, with Ollama or any local OpenAI-compatible server.

**Why AGPL-3.0?** So that improvements to a hosted or resold version come back
to users. Personal use, modification and self-hosting are unaffected.

**macOS or Linux?** Not planned yet. The local server is portable; the app shell
is Windows-first.

## Roadmap

See [ROADMAP.md](ROADMAP.md). `0.2.3` is about removing the old third-party
dependency and making provider setup simple. `0.3.0` moves on to attachments and
richer chat.

Voice is **not** in the roadmap.

## Contributing

Bug reports and pull requests are welcome — please read
[CONTRIBUTING.md](.github/CONTRIBUTING.md) first. For security issues, see
[SECURITY.md](.github/SECURITY.md).

## License

[AGPL-3.0-or-later](LICENSE) © 2026 KovacBro.

Versions up to and including `v0.1.0` were released under the MIT license; that
grant is irrevocable and remains in force for those tags. Starting with `0.2.0`,
the project is licensed under AGPL-3.0.
