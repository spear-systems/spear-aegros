# Observability

## Current (beta)

- **Structured health:** `GET /api/health` includes `database` and configured `aiProvider`.
- **Job stages:** persisted in `Job.stagesJson` and streamed via `GET /api/v1/jobs/:id/events` (SSE) or polling `GET /api/v1/jobs/:id`.
- **Audit trail:** `AuditLog` rows for job lifecycle events (create, succeeded, failed).

## Recommended (production)

- **OpenTelemetry:** trace each pipeline stage span; export OTLP to your collector (`OTEL_EXPORTER_OTLP_ENDPOINT`). Wire in `main.ts` when you adopt a collector in every environment.
- **Metrics:** queue depth, job wall time, HTTP budget exhaustion, Docker sidecar invocations, AI token usage per provider.
- **Logging:** JSON logs with `jobId`, `stage`, `correlationId`; avoid logging raw API keys or third-party responses in full.

## SBOM

- Root script: `npm run sbom` (CycloneDX JSON). CI runs this on Ubuntu after `npm run build`.
