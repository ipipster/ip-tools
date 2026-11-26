# Contributing

Thanks for helping. Nobody can change this repository directly; every change goes through a pull request that the owner reviews.

## How to propose a change

1. **Fork** the repository (button top right on GitHub).
2. Make your change in your fork, on a new branch.
3. Open a **pull request** to `main` here and describe what and why.
4. Checks run automatically; the owner reviews and merges, or asks for changes.

Small fixes (typos, docs) are welcome without discussion. For bigger changes, open an issue first.

## Rules

- **No secrets or personal data.** No tokens, API keys, feed URLs, email addresses, internal company URLs or local paths such as `C:\Users\<name>`. Settings that differ per user belong in the tool's settings screen, a script property, or a git-ignored local config file - see "Per-user settings" below.
- Keep each tool self-contained in `tools/<tool-name>/`.
- Bump the tool's version (for an extension: `manifest.json`) and add a line to its `CHANGELOG.md`.

## Per-user settings

| Kind of value | Where it goes |
|---|---|
| Extension settings (feed URL, preferences) | The extension popup; stored in the browser's local extension storage |
| Apps Script secrets (tokens) | Project Settings > Script Properties, read with `PropertiesService` |
| Script config (paths, IDs, keys) | `config.local.json` or `.env` (git-ignored); commit a `config.example.json` / `.env.example` with placeholder values |
| Folders | Relative to the script, or environment variables such as `%LOCALAPPDATA%` / `$HOME` - never a hard-coded user path |

## Releases (owner)

Push a tag `<tool>-v<version>`, for example `meet-ringer-v1.1.1`. The release workflow checks that the tag matches the version in the code, builds the zip and publishes a GitHub Release.
