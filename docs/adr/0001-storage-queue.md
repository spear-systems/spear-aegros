# ADR 0001: Storage, artifacts, and job execution

## Status

Accepted

## Context

Spear Aegros needs durable jobs (survive process restarts), artifact storage for stage outputs, and a queue abstraction that runs on developer laptops (macOS, Windows, Linux) without mandatory Docker while remaining production-viable.

## Decision

1. **Primary database:** **SQLite** via Prisma for default single-node deployments (`DATABASE_URL=file:…`). **PostgreSQL** is supported by switching `datasource provider` and `DATABASE_URL` in production deployments (same relational model; run `prisma migrate deploy` against Postgres).
2. **Artifacts:** Large or raw stage payloads are written under **`AEGROS_ARTIFACTS_DIR`** (default `data/artifacts` relative to the server process cwd) as JSON files; the `Job` row stores pointers and compact JSON in `reportJson` / `stagesJson`.
3. **Queue / workers:** **No Redis** in the default stack. A **DB-backed coordinator** marks jobs `queued` → `running` and a Nest `OnModuleInit` worker drains the queue in-process. This is appropriate for single-replica and small teams; scale-out later with **BullMQ + Redis** or **pg-boss** + Postgres-only by ADR amendment.
4. **Crash recovery:** On startup, jobs left in `running` are reset to `queued` so a worker can pick them up again (at-most-once stage writes; stages are idempotent where possible).

## Consequences

- Operators get a working system with `npm ci` and no auxiliary services.
- High-throughput multi-tenant SaaS will require a follow-up ADR for horizontal workers and Postgres.
