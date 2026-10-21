# Contributing to OwnChat

Thanks for taking the time to contribute. OwnChat is a small, deliberately
boring codebase: plain Node built-ins, vanilla JS, no build step, no npm
dependencies. Please keep it that way.

## Before you open an issue

- Search existing issues and discussions first.
- Reproduce on the latest release, not on an old installer.
- For "it doesn't work with provider X", include the provider name, base URL
  host (not the full key), model ID, and the exact error text from the bubble.

## Before you open a pull request

- Open an issue first for anything larger than a typo or a one-line fix. It
  saves you from building something that does not fit the roadmap.
- One concern per PR. Do not mix a refactor with a feature.
- Run the app from source (`node server.js`) and click through the affected
  screen. There is no automated test suite yet; say in the PR what you manually
  verified.
- Match the existing style: two-space indent, semicolons, JSDoc-free comments
  only where the code is not obvious, Chinese UI strings, English code comments.

## Hard rules

These exist for privacy and licensing reasons:

1. **No new dependencies.** Node built-ins and browser APIs only. A PR that adds
   `node_modules` will be closed.
2. **No telemetry, analytics, crash reporting or remote logging.** Not even
   opt-in.
3. **No network calls to servers we control.** The only outbound traffic is to
   the provider the user configured.
4. **Never log message content, API keys or file paths.** Errors must be
   redacted before they reach a log or a UI bubble.
5. **No code that bypasses, shares or resells a third party's account, quota or
   subscription.** OwnChat is a client, not a credential broker.
6. **Keep the server bound to `127.0.0.1`.** Do not add a `--host` flag.

## License of contributions

OwnChat is licensed under AGPL-3.0-or-later. By opening a pull request you agree
to license your contribution under the same terms and confirm you have the right
to do so. Do not paste code from a project with an incompatible license.

## Commit messages

Conventional-ish, imperative, one line:

```
fix(stream): keep partial text when the upstream closes early
feat(provider): remember reasoning effort per model
docs: clarify the export format
```

## Review

Expect a reply within a week. Maintainer time is limited, so a PR that is small,
explained and manually verified gets merged fastest.
