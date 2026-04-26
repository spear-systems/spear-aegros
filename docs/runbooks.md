# Runbooks

Full environment reference for operators: [usage/configuration.md](./usage/configuration.md).

## Database migrations

1. Set `DATABASE_URL` (see [packages/aegros-server/.env.example](../packages/aegros-server/.env.example)).
2. From repo root: `npm run db:migrate -w @spearsystems/aegros-server`
3. Restart the API so Prisma reconnects if the URL changed.

## API keys

1. `API_KEYS_REQUIRED=true` on the server.
2. Create a key: `npm run create-api-key -w @spearsystems/aegros-server -- "Robot name"` with `DATABASE_URL` set.
3. Clients send `X-API-Key: <secret>` (or `Authorization: Bearer`).

## Stuck jobs

- On restart, jobs left `running` are reset to `queued` with a recovery message; only those rows are auto-drained.
- Manually inspect `Job.errorMessage` and artifact files under `AEGROS_ARTIFACTS_DIR`.

## Docker sidecar

- Build: see [docker.md](./docker.md).
- Set `AEGROS_SCANNER_IMAGE` to your image tag; aggressive policy triggers optional sidecar calls on supported platforms.
