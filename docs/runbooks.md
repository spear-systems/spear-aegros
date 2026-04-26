# Runbooks

Full environment reference for operators: [usage/configuration.md](./usage/configuration.md).

**npm installs** (no monorepo checkout): follow [usage/install-from-npm.md](./usage/install-from-npm.md) for `npx prisma migrate deploy`, `.env`, and `create-api-key.mjs`.

## Database migrations

1. Set `DATABASE_URL` (see [packages/aegros-server/.env.example](../packages/aegros-server/.env.example)).
2. **Monorepo / Spear development:** from repo root, `npm run db:migrate -w @spearsystems/aegros-server`.
3. **Global npm package:** from your runtime directory with a copy of `prisma/`, `npx prisma@6.19 migrate deploy --schema=./prisma/schema.prisma` (see [install-from-npm.md](./usage/install-from-npm.md)).
4. Restart the API so Prisma reconnects if the URL changed.

## API keys

1. `API_KEYS_REQUIRED=true` on the server.
2. Create a key:
   - **Monorepo:** `npm run create-api-key -w @spearsystems/aegros-server -- "Robot name"` with `DATABASE_URL` set.
   - **Global npm install:** use `create-api-key.mjs` as in [usage/install-from-npm.md §10](./usage/install-from-npm.md#10-creating-api-keys-in-production).
3. Clients send `X-API-Key: <secret>` (or `Authorization: Bearer`).

## Stuck jobs

- On restart, jobs left `running` are reset to `queued` with a recovery message; only those rows are auto-drained.
- Manually inspect `Job.errorMessage` and artifact files under `AEGROS_ARTIFACTS_DIR`.

## Docker sidecar

- Build: see [docker.md](./docker.md).
- Set `AEGROS_SCANNER_IMAGE` to your image tag; aggressive policy triggers optional sidecar calls on supported platforms.
