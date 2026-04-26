# Local development workflow

## Prerequisites

- **Node.js** and **npm** per root [README.md](../../README.md) and `.nvmrc`.
- **Git**.
- Optional: **Docker Desktop** (macOS/Windows) or **Docker Engine** (Linux) if you test the scanner sidecar.

## First clone

```bash
git clone <your-repo-url>
cd spear-aegros
nvm use   # or install Node version from .nvmrc
npm ci
```

## Server database and env

```bash
cp packages/aegros-server/.env.example packages/aegros-server/.env
# Edit .env — at minimum DATABASE_URL (defaults to SQLite file under packages/aegros-server/prisma/)
npm run db:migrate -w @spearsystems/aegros-server
```

## Run API + bundled portal

```bash
npm run start:dev -w @spearsystems/aegros-server
```

- API: `http://127.0.0.1:3000/api/health`
- Portal (served by Nest): `http://127.0.0.1:3000/portal/`

## Run portal with Vite (hot reload)

In a second terminal:

```bash
npm run dev -w @spearsystems/aegros-portal
```

Vite proxies `/api` to `http://127.0.0.1:3000` (see `packages/aegros-portal/vite.config.ts`). Open the URL Vite prints (typically `http://localhost:5173/portal/`).

## CLI from workspace

```bash
npm run build -w @spearsystems/aegros-cli
node packages/aegros-cli/dist/cli.js health
node packages/aegros-cli/dist/cli.js jobs create -d example.com --ack
```

## Useful workspace commands

| Command                                   | Purpose                                    |
| ----------------------------------------- | ------------------------------------------ |
| `npm run lint`                            | ESLint                                     |
| `npm run format` / `npm run format:check` | Prettier                                   |
| `npm run typecheck`                       | TypeScript                                 |
| `npm test`                                | All workspace tests                        |
| `npm run build`                           | Full production build + umbrella bundle    |
| `npm run pack:dry`                        | Validate publish tarball without uploading |
