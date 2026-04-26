# Production readiness review (confirm before GA)

Use this as a **go / no-go** list. Items are product and deployment concerns — not every line may apply to your first beta.

## Security & access

- [ ] **`API_KEYS_REQUIRED=true`** in any internet-exposed deployment; create keys via `npm run create-api-key -w @spearsystems/aegros-server`.
- [ ] **`CORS_ORIGIN`** set to explicit origins (never `*` in production). The server logs a **warning** if `NODE_ENV=production` and CORS is open.
- [ ] **TLS** terminates at a reverse proxy (nginx, Caddy, cloud LB) with modern cipher policies; do not expose plain HTTP to untrusted networks.
- [ ] **Secrets**: `OPENAI_API_KEY`, `GEMINI_API_KEY`, webhook `secret` values stored in a secret manager or encrypted env — not in git.
- [ ] **`AEGROS_ENFORCE_ACK=true`** if you require legal acknowledgement on every job create.

## Data & reliability

- [ ] **Database**: SQLite is fine for single-node; for HA or multi-replica workers, plan **PostgreSQL** and a follow-up migration strategy (see [../adr/0001-storage-queue.md](../adr/0001-storage-queue.md)).
- [ ] **Backups**: schedule backups for the DB file or Postgres volume and **artifact directory** (`AEGROS_ARTIFACTS_DIR`).
- [ ] **Disk**: monitor artifact growth; retention policy for old jobs.

## Rate limits & abuse

- [ ] Tune **`RATE_LIMIT_PER_MIN`** behind a reverse proxy; if you terminate TLS at the proxy, confirm **client IP** forwarding (`X-Forwarded-For`) and Nest throttler behavior for your topology.

## Docker sidecar

- [ ] If **`AEGROS_SCANNER_IMAGE`** is used: image built from a pinned Dockerfile revision; network policy documented; scanners licensed per [../scanner-license-matrix.md](../scanner-license-matrix.md).

## AI providers

- [ ] **`AEGROS_AI_PROVIDER`** matches the vendor you intend; keys present only for that vendor.
- [ ] **Data residency**: cloud LLM calls leave your boundary — document for customers.

## Observability

- [ ] Log aggregation for the Node process; alerts on `database: error` from `/api/health`.
- [ ] Plan **OpenTelemetry** export when you adopt a collector ([../observability.md](../observability.md)).

## Supply chain

- [ ] **`npm audit`** on a schedule; Dependabot PRs reviewed.
- [ ] **SBOM** archived per release (`npm run sbom` in CI artifact store).

## Legal

- [ ] Customer-facing **authorized use** terms and default **passive** policy understood ([../legal-safe-use.md](../legal-safe-use.md)).

## Webhooks

- [ ] Subscriptions inserted with strong random **`secret`**; receiver endpoints owned by the customer verify **`X-Aegros-Signature`**.

## Things intentionally not built yet (know the gap)

- No built-in HTTP **admin UI** for webhook CRUD (today: DB or SQL).
- **Horizontal workers** + distributed queue not in default stack (ADR documents scale path).
- **RBAC** beyond API key `role` string — extend before multi-tenant SaaS.
