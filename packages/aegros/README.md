# `@spearsystems/aegros` (beta)

**Early beta** — breaking changes, incomplete features, not for production-critical workloads without review.

Proprietary software © Spear Systems. See bundled **`LICENSE`**.

## Documentation

- **Install & run (users):** [docs/usage/README.md](../../docs/usage/README.md) — requirements, installation, **full configuration**, CLI, portal, API.
- **Build & publish (Spear):** [docs/development/README.md](../../docs/development/README.md) — GitHub, npm, pre-publish testing.

## Install

```bash
npm install -g @spearsystems/aegros@beta
# or exact:
npm install -g @spearsystems/aegros@0.1.0-beta.0
```

## Binaries

| Binary          | Purpose                                                           |
| --------------- | ----------------------------------------------------------------- |
| `aegros`        | CLI (`health`, `jobs create`, `jobs get`, `jobs watch`, `--json`) |
| `aegros-server` | Starts Nest API + serves `/portal`                                |

## Configure the server

**All** runtime settings come from **your** environment (or process manager). See **[docs/usage/configuration.md](../../docs/usage/configuration.md)** for the complete table.

There is **no** Spear-managed “cloud config” for self-hosted installs. Copy `.env.example` from the GitHub repo if you need a template: [`packages/aegros-server/.env.example`](../../packages/aegros-server/.env.example).

## Publish notes (maintainers only)

See [docs/development/github-and-npm-release.md](../../docs/development/github-and-npm-release.md) and [docs/npm-publish.md](../../docs/npm-publish.md). Run `npm run build` at monorepo root before `npm publish -w @spearsystems/aegros`.
