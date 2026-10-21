# Security Policy

## Supported versions

Only the latest minor release receives security fixes. Patch releases are
source-only and do not get installer assets.

| Version | Supported |
|---|---|
| 0.2.x | Yes |
| 0.1.x | No |

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Use GitHub's private vulnerability reporting on this repository
(**Security → Report a vulnerability**), or mail the address listed on the
maintainer's GitHub profile. Include:

- affected version and Windows build;
- a short description and impact;
- reproduction steps or a proof of concept;
- whether the issue requires a malicious local file, a malicious provider, or
  only network access to `127.0.0.1`.

You will get an acknowledgement within 72 hours. Fixes for confirmed issues are
released as a patch version and credited unless you ask otherwise.

## Scope

In scope:

- decryption or exfiltration of stored API keys;
- path traversal in upload, avatar or download handling;
- SSRF or request smuggling in the provider proxy;
- Markdown or HTML injection that executes script in the app window;
- bypassing the `127.0.0.1` bind or exposing the local API to the network;
- signature or hash verification bypass in the downloader.

Out of scope:

- an attacker who already has administrator rights on the machine (the local
  encryption key is on disk by design — see the privacy section of the README);
- the behaviour of third-party model providers;
- the absence of code signing on the installer;
- issues that require the user to paste an untrusted URL into a provider card
  and deliberately ignore the warning.

## Hardening notes for users

- Keep WebView/Edge and Windows updated; the app shell is the system browser
  engine.
- Verify `SHA256SUMS.txt` before running an installer.
- Prefer a per-provider key with a spending limit over a master key.
