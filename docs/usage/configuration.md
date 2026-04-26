# Configuration (operators)

**Operators** — anyone who runs `aegros-server` or the CLI against an API — own **all variables below**. Spear’s npm/GitHub release process does **not** inject these into your environment.

> **Spear maintainers only** (GitHub, npm OIDC, version bumps): [../development/maintainer-config.md](../development/maintainer-config.md)

Canonical template in the repo: [`packages/aegros-server/.env.example`](../../packages/aegros-server/.env.example).

## Server (`aegros-server`)

| Variable                | Required                    | Default / behavior                                       | Notes                                                                                                                 |
| ----------------------- | --------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | **Yes** for production      | `file:./prisma/dev.db` in template                       | SQLite file URL or Postgres connection string (Prisma).                                                               |
| `AEGROS_ARTIFACTS_DIR`  | No                          | `data/artifacts` (relative to cwd)                       | Writable path for per-job JSON artifacts.                                                                             |
| `HOST`                  | No                          | `0.0.0.0`                                                | Bind address.                                                                                                         |
| `PORT`                  | No                          | `3000`                                                   | Listen port.                                                                                                          |
| `AEGROS_PORTAL_DIST`    | No                          | Auto-detect near `dist` or monorepo `aegros-portal/dist` | Path to built portal static files.                                                                                    |
| `CORS_ORIGIN`           | **Yes** for public internet | `*` / unset reflects all origins in dev                  | Production: comma-separated explicit origins. If `NODE_ENV=production` and unset or `*`, server **warns** at startup. |
| `RATE_LIMIT_PER_MIN`    | No                          | `120`                                                    | Global throttle per IP (tune behind reverse proxy).                                                                   |
| `API_KEYS_REQUIRED`     | Recommended public          | `false`                                                  | Set `true` and create keys with workspace script `create-api-key`.                                                    |
| `AEGROS_ENFORCE_ACK`    | No                          | `false`                                                  | If `true`, `POST /v1/jobs` must include `"ackAuthorized": true`.                                                      |
| `AEGROS_MAX_HTTP`       | No                          | `40`                                                     | Pipeline HTTP budget per job.                                                                                         |
| `AEGROS_MAX_SUBDOMAINS` | No                          | `80`                                                     | Subdomain/host budget per job.                                                                                        |
| `AEGROS_WALL_MS`        | No                          | `120000`                                                 | Wall-clock budget per job (ms).                                                                                       |
| `AEGROS_AI_PROVIDER`    | No                          | unset → noop AI                                          | `ollama` \| `openai` \| `gemini`.                                                                                     |
| `AEGROS_OLLAMA_URL`     | If Ollama                   | `http://127.0.0.1:11434`                                 | Base URL for Ollama HTTP API.                                                                                         |
| `AEGROS_OLLAMA_MODEL`   | No                          | `qwen2.5:3b`                                             | Ollama model id.                                                                                                      |
| `OPENAI_API_KEY`        | If OpenAI                   | —                                                        | Vendor secret.                                                                                                        |
| `AEGROS_OPENAI_MODEL`   | No                          | `gpt-4o-mini`                                            | OpenAI chat model.                                                                                                    |
| `GEMINI_API_KEY`        | If Gemini                   | —                                                        | Google AI API key.                                                                                                    |
| `AEGROS_GEMINI_MODEL`   | No                          | `gemini-2.0-flash`                                       | Gemini model id.                                                                                                      |
| `AEGROS_SCANNER_IMAGE`  | No                          | unset → no sidecar                                       | Docker image for Linux scanner; see [../docker.md](../docker.md).                                                     |

### Node / process

| Variable   | Who             | Notes                                                                                   |
| ---------- | --------------- | --------------------------------------------------------------------------------------- |
| `NODE_ENV` | Operator / host | Set `production` for production behavior (e.g. CORS warning). Standard Node convention. |

## CLI (`aegros`)

| Source                                   | Purpose                                                     |
| ---------------------------------------- | ----------------------------------------------------------- |
| Flags `-u` / `--url`, `-k` / `--api-key` | Override API base and key per command.                      |
| `~/.aegros/config.json`                  | Default `apiBaseUrl` and `apiKey` (optional).               |
| `--json`                                 | Machine-readable stdout for scripts (not for `jobs watch`). |

## Portal (browser)

| Storage                                    | Purpose                                             |
| ------------------------------------------ | --------------------------------------------------- |
| `localStorage` key `aegros_portal_api_key` | Optional `X-API-Key` when `API_KEYS_REQUIRED=true`. |

## Webhooks (database, not env)

Webhook endpoints and HMAC secrets live in the **`WebhookSubscription`** table (`url`, `secret`, `eventsJson`). Operators insert rows via SQL or tooling until an admin API exists.

## What you should **not** put in env

- Long-lived **npm publish tokens** on customer servers — those belong in CI or your laptop for releases only ([../development/maintainer-config.md](../development/maintainer-config.md)).
