# Releasing OwnChat

## Version rules

OwnChat follows `MAJOR.MINOR.PATCH`.

| Version | Git tag | GitHub Release | Installer assets |
|---|---|---|---|
| `0.1.0` | `v0.1.0` | Yes | Yes |
| `0.2.0` | `v0.2.0` | Yes | Yes |
| `0.2.1` | `v0.2.1` | Yes | Yes (documented patch exception) |
| `0.2.2` | `v0.2.2` | No (tag only) | No |
| `0.2.3` | `v0.2.3` | Yes | Yes (documented patch exception) |
| `1.0.0` | `v1.0.0` | Yes | Yes |

Minor releases get an installer by default. A patch release may ship one when it
contains a migration or a security fix that has to reach existing installs; the
release notes must say so and the build must use `-AllowPatchInstaller`. Patches
without that exception stay tag-only.

Old releases are immutable:

- never move or delete an existing tag;
- never overwrite a release asset;
- never edit release notes after publication except to add a security notice.

## Branches

- `main` — development, always runnable.
- `release/x.y` — optional stabilization branch for a minor release.
- Tags are created from `main` (or the release branch) after CI is green.

## Release checklist

### 1. Prepare

- [ ] Update `package.json` version.
- [ ] Update `CHANGELOG.md` with the release date and final notes.
- [ ] Update `README.md` if install steps or features changed.
- [ ] Confirm the roadmap still points at the next minor.
- [ ] Run `node --check server.js` and `node --check public/app.js`.
- [ ] Smoke-test: start, chat, switch model, provider test, restart, data persists.

### 2. Build assets

```powershell
cd E:\OwnChat
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\build-release.ps1 -Version 0.1.0
```

Outputs:

```text
dist/
  OwnChat-0.1.0-win64-setup.exe
  OwnChat-0.1.0-win64-portable.zip
  SHA256SUMS.txt
```

The setup installer bundles `node.exe`; users do not need a separate Node
installation. The portable ZIP is for users who do not want to install.

### 3. Tag

```powershell
git tag -a v0.1.0 -m "OwnChat 0.1.0"
git push origin main
git push origin v0.1.0
```

### 4. Publish the minor release

```powershell
gh release create v0.1.0 `
  .\dist\OwnChat-0.1.0-win64-setup.exe `
  .\dist\OwnChat-0.1.0-win64-portable.zip `
  .\dist\SHA256SUMS.txt `
  --title "OwnChat 0.1.0" `
  --notes-file .\docs\releases\0.1.0.md `
  --latest
```

The assets appear under **Releases** in the repository sidebar. GitHub shows
the latest minor release first; older minor releases remain available under
the Releases page.

### 5. Patch release

By default, a patch is a tag and a `CHANGELOG.md` entry only.

```powershell
git tag -a v0.2.4 -m "OwnChat 0.2.4"
git push origin v0.2.4
```

If the patch carries a migration or a security fix that existing installs must
receive, it may ship an installer. Build with the explicit switch:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\build-release.ps1 `
  -Version 0.2.3 -AllowPatchInstaller
```

Then create a normal GitHub Release, and state in the notes why the patch has
assets. `0.2.1` and `0.2.3` are documented exceptions.

## Installer notes

- Built with Inno Setup 6; per-user install at
  `%LOCALAPPDATA%\Programs\OwnChat`.
- Bundles Node.js (`node.exe`) and the Node license.
- The installer is currently **not code-signed**; Windows SmartScreen may show
  “Unknown publisher”. Publish SHA-256 checksums and verify the GitHub
  release page. Code signing can be added when a certificate is available.
- Uninstall stops the local server and removes program files. User data under
  `data/` is intentionally left in place; remove it manually if desired.

## Release notes template

```markdown
## OwnChat x.y.0

Theme: ...

### Highlights
- ...

### Fixes
- ...

### Install
Download `OwnChat-x.y.0-win64-setup.exe` from Assets.

### Checksums
See `SHA256SUMS.txt`.

### Known issues
- ...
```
