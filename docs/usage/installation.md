# Installation

## From npm (recommended for users)

Install the published umbrella package (adjust tag/version to match what Spear ships):

```bash
npm install -g @spearsystems/aegros@beta
```

Binaries on your `PATH`:

| Command         | Description                              |
| --------------- | ---------------------------------------- |
| `aegros`        | CLI                                      |
| `aegros-server` | Starts the HTTP API and serves `/portal` |

## First-time server start

1. Create a working directory and copy environment template from the **repository** (the npm tarball may not ship `.env.example`; clone or copy from GitHub), **or** set the same variables in your process manager.

   If you have the repo:

   ```bash
   cp packages/aegros-server/.env.example packages/aegros-server/.env
   ```

2. Set at least **`DATABASE_URL`** and run migrations from the **same** `aegros-server` package layout you use in production (see [configuration.md](./configuration.md)).

3. Start:

   ```bash
   aegros-server
   ```

   Default listen: `HOST` / `PORT` from env (see configuration doc).

4. Verify: `curl -s http://127.0.0.1:3000/api/health | jq .`

## From source (contributors or fork consumers)

```bash
git clone <repo>
cd spear-aegros
npm ci
npm run db:migrate -w @spearsystems/aegros-server
npm run start:dev -w @spearsystems/aegros-server
```

## Global CLI profile (optional)

Create `~/.aegros/config.json`:

```json
{
  "apiBaseUrl": "https://your-host.example/api",
  "apiKey": "aeg_…"
}
```

The CLI merges this with flags (`-u`, `-k` override). See [cli.md](./cli.md).
