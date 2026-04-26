# `@spearsystems/aegros-server`

NestJS **HTTP API** (`/api`) and static **portal** (`/portal`).

## Beta behavior

- **Jobs** are stored **in memory** (restart clears data).
- **Helmet**, **CORS** (`CORS_ORIGIN`), **global `ValidationPipe`**, **rate limiting** (`RATE_LIMIT_PER_MIN`).

## Run (workspace)

```bash
npm run start:dev -w @spearsystems/aegros-server
```

Copy `.env.example` to `.env` and adjust.

## Endpoints

| Method | Path               | Description                             |
| ------ | ------------------ | --------------------------------------- |
| GET    | `/api/health`      | Liveness (throttle skipped)             |
| POST   | `/api/v1/jobs`     | `{ "domains": string[] }`               |
| GET    | `/api/v1/jobs`     | List jobs                               |
| GET    | `/api/v1/jobs/:id` | Job detail + stub report when succeeded |

## Portal static files

Resolution order: `AEGROS_PORTAL_DIST` env → `../portal` next to compiled `dist` (umbrella bundle) → monorepo `aegros-portal/dist` in dev.
