# Integrations

## Shipped (current)

- **Webhooks** — `WebhookSubscription` table; on `job.completed`, `WebhooksService` POSTs JSON with `X-Aegros-Signature: sha256=<hmac>` using the subscription secret. Events list is JSON in `eventsJson` (e.g. `["job.completed"]`).
- **SARIF** — `GET /api/v1/jobs/:id/sarif` returns SARIF 2.1.0 JSON when a report exists.

## Planned

- **Jira / Linear / GitHub Issues** — one-way export of prioritized findings.
- **OIDC / SSO** — operator authentication for the portal beyond API keys.

Configuration keys and admin APIs for webhook CRUD will be documented when exposed beyond direct DB seeding.
