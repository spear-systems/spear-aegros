# Spear Aegros

**Beta (`0.1.0-beta.x`)** — early software; APIs and behavior may change. **Proprietary software © Spear Systems.** See [LICENSE](./LICENSE). Not open-source.

Spear Aegros is an **external attack surface** analysis platform (monorepo: API, operator portal, CLI, published npm umbrella). For licensing and redistribution, contact Spear Systems.

## Documentation (two tracks)

| Audience                                                            | Start here                                               |
| ------------------------------------------------------------------- | -------------------------------------------------------- |
| **Operators & integrators** (install, configure, use)               | [docs/usage/README.md](docs/usage/README.md)             |
| **Spear developers & release engineers** (build, test, GitHub, npm) | [docs/development/README.md](docs/development/README.md) |
| **Full index**                                                      | [docs/README.md](docs/README.md)                         |

### Quick links

| Doc                                                                                                | Purpose                                    |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [docs/usage/configuration.md](docs/usage/configuration.md)                                         | All runtime env vars (operators)           |
| [docs/development/maintainer-config.md](docs/development/maintainer-config.md)                     | GitHub/npm only — **not** end-user runtime |
| [docs/development/testing-before-publish.md](docs/development/testing-before-publish.md)           | Local gate before push / publish           |
| [docs/development/github-and-npm-release.md](docs/development/github-and-npm-release.md)           | First push & npm release checklist         |
| [docs/development/production-readiness-review.md](docs/development/production-readiness-review.md) | Go-live checklist                          |
| [docs/architecture.md](docs/architecture.md)                                                       | Packages and request flow                  |
| [docs/product-scope.md](docs/product-scope.md)                                                     | Roadmap traceability                       |
| [docs/integrations.md](docs/integrations.md)                                                       | Webhooks, SARIF                            |
| [docs/docker.md](docs/docker.md)                                                                   | Linux scanner sidecar                      |
| [docs/adr/0001-storage-queue.md](docs/adr/0001-storage-queue.md)                                   | Storage & queue ADR                        |
| [docs/runbooks.md](docs/runbooks.md)                                                               | Migrations, API keys, recovery             |
| [docs/observability.md](docs/observability.md)                                                     | Health, OTEL roadmap, SBOM                 |
| [docs/scanner-license-matrix.md](docs/scanner-license-matrix.md)                                   | Scanner / data-source licensing            |
| [docs/legal-safe-use.md](docs/legal-safe-use.md)                                                   | Authorized use only                        |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)                                                       | PR expectations                            |
| [SECURITY.md](./SECURITY.md)                                                                       | Vulnerability reporting                    |

## Requirements

- **Node.js** ≥20.19 and &lt;27 (see [Node releases](https://nodejs.org/en/about/previous-releases))
- **npm** ≥10
- **`.nvmrc`** pins CI default Node (**22** — adjust per team)

## Cursor / IDE

- **`.cursor/plans/`** is gitignored (local planning).
- Commit **`.cursor/rules/`**, **`.cursor/skills/`**, or other shared agent config for the team.

## Development (short)

```bash
npm ci
npm run build
npm run lint
npm run format:check
npm run typecheck
npm test
```

Full workflow: [docs/development/local-workflow.md](docs/development/local-workflow.md).

### Database (Prisma)

1. Copy [packages/aegros-server/.env.example](packages/aegros-server/.env.example) to `packages/aegros-server/.env` (or export `DATABASE_URL`).
2. Apply migrations: `npm run db:migrate -w @spearsystems/aegros-server`
3. Optional API keys: `npm run create-api-key -w @spearsystems/aegros-server -- "label"` then set `API_KEYS_REQUIRED=true` on the server.

### API + portal (workspace)

```bash
npm run start:dev -w @spearsystems/aegros-server
```

- Health: `GET http://localhost:3000/api/health`
- Jobs: `POST http://localhost:3000/api/v1/jobs` with JSON `{ "domains": ["example.com"], "policy": "passive", "ackAuthorized": true }` (ack required when `AEGROS_ENFORCE_ACK=true`)
- Job SSE: `GET http://localhost:3000/api/v1/jobs/:id/events`
- SARIF: `GET http://localhost:3000/api/v1/jobs/:id/sarif`
- Portal: `http://localhost:3000/portal/` (Vite dev: `npm run dev -w @spearsystems/aegros-portal` proxies `/api` to `:3000`)

### CLI (workspace, after build)

```bash
node packages/aegros-cli/dist/cli.js health --url http://127.0.0.1:3000/api
node packages/aegros-cli/dist/cli.js jobs create -d example.com --url http://127.0.0.1:3000/api --ack
node packages/aegros-cli/dist/cli.js jobs watch <job-id>
```

Optional profile file: `~/.aegros/config.json` with `{ "apiBaseUrl": "http://127.0.0.1:3000/api", "apiKey": "…" }`. See [docs/usage/cli.md](docs/usage/cli.md).

### Pack umbrella (dry run)

```bash
npm run pack:dry
```

## Published package

End users: **`npm i -g @spearsystems/aegros@beta`** — see [packages/aegros/README.md](packages/aegros/README.md) and [docs/usage/installation.md](docs/usage/installation.md).

## Monorepo layout

Workspaces under `packages/`. Internal links use `file:../…` for npm compatibility (see [docs/architecture.md](docs/architecture.md)).

## Supply chain

Run `npm audit` regularly. Prefer **npm provenance** + OIDC for publishes ([docs/npm-publish.md](docs/npm-publish.md)). SBOM: `npm run sbom` (see [docs/observability.md](docs/observability.md)).

## License

Use is governed by [LICENSE](./LICENSE). Third-party notices: [NOTICE](./NOTICE).
