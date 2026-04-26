# `@spearsystems/aegros` (beta)

**Early beta** — breaking changes, incomplete features, not for production-critical workloads without review.

Proprietary software © Spear Systems. See bundled **`LICENSE`**.

## Documentation

Usage and development guides live in the repo on GitHub (absolute links):

**Usage (operators)**

- [Install and run from npm (complete guide)](https://github.com/spear-systems/spear-aegros/blob/main/docs/usage/install-from-npm.md)
- [Usage docs index](https://github.com/spear-systems/spear-aegros/blob/main/docs/usage/README.md)
- [Configuration](https://github.com/spear-systems/spear-aegros/blob/main/docs/usage/configuration.md)
- [CLI reference](https://github.com/spear-systems/spear-aegros/blob/main/docs/usage/cli.md)
- [Portal](https://github.com/spear-systems/spear-aegros/blob/main/docs/usage/portal.md)
- [HTTP API overview](https://github.com/spear-systems/spear-aegros/blob/main/docs/usage/api-overview.md)

**Development (maintainers)**

- [Development docs index](https://github.com/spear-systems/spear-aegros/blob/main/docs/development/README.md)

## Install

```bash
npm install -g @spearsystems/aegros@beta
# or exact:
npm install -g @spearsystems/aegros@0.1.0-beta.1
```

## Binaries

| Binary          | Purpose                                                           |
| --------------- | ----------------------------------------------------------------- |
| `aegros`        | CLI (`health`, `jobs create`, `jobs get`, `jobs watch`, `--json`) |
| `aegros-server` | Starts Nest API + serves `/portal`                                |

## Configure the server

Follow [Install from npm](https://github.com/spear-systems/spear-aegros/blob/main/docs/usage/install-from-npm.md) for `.env` location, `DATABASE_URL`, migrations, and first start.

Runtime settings are **your** environment (or process manager). Full variable list: [Configuration](https://github.com/spear-systems/spear-aegros/blob/main/docs/usage/configuration.md).

There is no Spear-managed cloud config for self-hosted installs. Environment template:

[`packages/aegros-server/.env.example`](https://github.com/spear-systems/spear-aegros/blob/main/packages/aegros-server/.env.example)

## Publish (maintainers only)

[GitHub & npm release](https://github.com/spear-systems/spear-aegros/blob/main/docs/development/github-and-npm-release.md) · [npm publish](https://github.com/spear-systems/spear-aegros/blob/main/docs/npm-publish.md) — run `npm run build` at the monorepo root before `npm publish -w @spearsystems/aegros`.
