# Security

Please do **not** report security problems in a public issue. Use GitHub's private reporting instead: **Security** tab > **Report a vulnerability**.

If you notice a secret (token, key, URL with a token) committed to this repository, report it the same way so it can be revoked.

## What the tools do with your data

- **Meet Ringer** sends nothing to third parties. Calendar data and settings stay in the browser's local extension storage. Your calendar feed URL contains your personal token: treat it like a password and never share or commit it. Details: [tools/meet-ringer/README.md](tools/meet-ringer/README.md#security-and-privacy).
