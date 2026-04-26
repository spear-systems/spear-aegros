# HTTP API overview

Base path: **`/api`** (global prefix).

## Authentication

- If **`API_KEYS_REQUIRED=true`**: send **`X-API-Key: <secret>`** or **`Authorization: Bearer <secret>`** on all routes **except** `GET /api/health`.
- If `false`: keys optional (development only; not recommended on the public internet).

## Endpoints

| Method | Path                      | Description                                                                          |
| ------ | ------------------------- | ------------------------------------------------------------------------------------ | ---------- | ------------------------------------------- |
| `GET`  | `/api/health`             | Liveness; includes `database`, `coreVersion`, `aiProvider`. **Public** (no API key). |
| `POST` | `/api/v1/jobs`            | Body: `{ "domains": string[], "policy"?: "passive"                                   | "standard" | "aggressive", "ackAuthorized"?: boolean }`. |
| `GET`  | `/api/v1/jobs`            | List jobs (newest first).                                                            |
| `GET`  | `/api/v1/jobs/:id`        | Job detail including `report` when complete.                                         |
| `GET`  | `/api/v1/jobs/:id/sarif`  | SARIF 2.1.0 JSON (`Content-Type: application/sarif+json`).                           |
| `GET`  | `/api/v1/jobs/:id/events` | **SSE** stream of job status / stages (poll alternative).                            |

## Rate limiting

Global throttle per IP: **`RATE_LIMIT_PER_MIN`** (see [configuration.md](./configuration.md)).

## Webhooks

On job success, configured **`WebhookSubscription`** rows receive `POST` with JSON body and header **`X-Aegros-Signature: sha256=<hex>`** (HMAC-SHA256 of body with subscription `secret`). See [../integrations.md](../integrations.md).

## Errors

Validation errors return **400** with JSON details (Nest `ValidationPipe`). Missing API key returns **401** when required.
