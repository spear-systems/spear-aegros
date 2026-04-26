# Install and run Aegros from npm (complete guide)

This document is the **full path** for operators who install **`@spearsystems/aegros`** from the public npm registry: prerequisites, global install, database setup, environment, first server start, first job (CLI and portal), and common problems.

Spear does **not** host your API or database. You run `aegros-server` on your own machine or VM and supply every secret and URL yourself.

Before you run any assessment, read **[Legal / safe use](../legal-safe-use.md)**.

---

## 1. What you get from npm

The package **`@spearsystems/aegros`** is an **umbrella** release. Installing it globally adds two commands to your `PATH`:

| Command         | Role |
| --------------- | ---- |
| `aegros-server` | Starts the HTTP API (NestJS) and serves the operator **portal** static UI under `/portal/`. |
| `aegros`        | CLI: `health`, `jobs create`, `jobs get`, `jobs watch`. |

The npm tarball contains **pre-built** server and CLI code plus the portal assets. It does **not** ship the Prisma **schema** or **migration SQL** files. You still need those files on disk once so you can create and migrate the database (see [section 4](#4-database-prisma-schema-and-migrations)).

---

## 2. Requirements

### Node.js and npm

- **Node.js** ≥ 20.19 and &lt; 27 (see the package `engines` field on npm if in doubt).
- **npm** ≥ 10 (recommended for `npm install -g`).

Check versions:

```bash
node -v
npm -v
```

### Operating system

- **Linux**, **macOS**, and **Windows** are supported for normal operation: API + CLI + portal (all Node).
- **Docker** is optional. It is only needed if you set **`AEGROS_SCANNER_IMAGE`** for the Linux scanner sidecar. On macOS or Windows, Docker Desktop is typical if you enable that feature.

### Network (outbound)

- **HTTPS** (and sometimes HTTP) to targets you assess.
- If you use **Ollama**: your server must reach the Ollama HTTP API (often `http://127.0.0.1:11434`).
- If you use **OpenAI** or **Gemini**: outbound HTTPS to the vendor APIs.

### Disk and permissions

- A writable directory for the **SQLite** file (or a **PostgreSQL** URL you control).
- A writable directory for **job artifacts** (`AEGROS_ARTIFACTS_DIR`; default is relative to the process working directory — see [section 5](#5-environment-file)).

---

## 3. Install the package globally

### Install (beta tag)

```bash
npm install -g @spearsystems/aegros@beta
```

To pin an exact version (recommended for reproducible servers):

```bash
npm install -g @spearsystems/aegros@0.1.0-beta.1
```

### Confirm the binaries

```bash
aegros --version
aegros-server --version
```

On Windows, if the commands are not found, ensure your global npm **bin** directory is on `PATH` (npm prints it with `npm bin -g`).

### Updates

```bash
npm update -g @spearsystems/aegros
```

After a major or minor bump, re-check [section 4](#4-database-prisma-schema-and-migrations): migration folders must match the server version you run.

---

## 4. Database: Prisma schema and migrations

The running server expects a database that matches its **Prisma schema**. You apply that with **`prisma migrate deploy`** (or equivalent in your org).

The npm package **does not** include `schema.prisma` or the `prisma/migrations` folder. You need a copy of:

- `packages/aegros-server/prisma/schema.prisma`
- `packages/aegros-server/prisma/migrations/` (entire directory tree)

…at the **same Git revision** as the npm version you installed when possible (e.g. Git tag `v0.1.0-beta.1` matching `0.1.0-beta.1` on npm). If no tag exists yet, use the **`main`** tree for bleeding-edge beta.

**Canonical locations on GitHub** (replace `main` with your tag when you pin versions):

- Folder: `https://github.com/spear-systems/spear-aegros/tree/main/packages/aegros-server/prisma`
- Environment template: `https://github.com/spear-systems/spear-aegros/blob/main/packages/aegros-server/.env.example`

### 4a. Layout on your server

Create a **runtime directory** that will hold config, the database file, and artifacts. Example:

```text
/opt/aegros/
  .env
  prisma/
    schema.prisma
    migrations/
      ...
  data/
    artifacts/     # created automatically or set AEGROS_ARTIFACTS_DIR here
```

You can obtain `prisma/` and copy `.env.example` → `.env` by any of these methods:

1. **Download the repository ZIP** from GitHub, extract only `packages/aegros-server/prisma` into `prisma/` under your runtime dir, and save `.env.example` as `.env` in the same root.
2. **Sparse git clone** (if you use Git and want minimal disk use):

   ```bash
   git clone --depth 1 --filter=blob:none --sparse \
     https://github.com/spear-systems/spear-aegros.git aegros-src
   cd aegros-src
   git sparse-checkout set \
     packages/aegros-server/prisma \
     packages/aegros-server/.env.example \
     packages/aegros-server/scripts/create-api-key.mjs
   ```

   Then copy `packages/aegros-server/prisma` to your runtime directory, copy `.env.example` to `.env`, and keep a copy of **`create-api-key.mjs`** wherever you run key creation (see [section 10](#10-creating-api-keys-in-production)).

### 4b. Set `DATABASE_URL` in `.env`

For **SQLite** (simplest self-hosted start), use a **file URL** pointing at a file under your runtime directory, for example:

```env
DATABASE_URL="file:../data/aegros.db"
```

Paths in `file:` URLs are interpreted relative to the **Prisma schema file** location (`prisma/schema.prisma`), not necessarily your shell cwd. Keeping `../data/aegros.db` next to the layout above places the DB in `data/aegros.db`.

For **PostgreSQL**, use a standard Prisma Postgres URL (see Prisma docs). Same migration command applies.

### 4c. Run migrations

From the directory that contains the `prisma/` folder (parent of `schema.prisma`), run **`migrate deploy`** using a Prisma CLI version compatible with the project (**6.19.x** at time of writing):

```bash
cd /opt/aegros
npx prisma@6.19 migrate deploy --schema=./prisma/schema.prisma
```

You should see migrations applied successfully. Re-run this after upgrading the npm package if release notes mention new migrations.

---

## 5. Environment file

The server loads **`.env`** and **`.env.local`** from the **current working directory** when the process starts (Nest `ConfigModule`). There is no automatic search of your home directory.

**Always start `aegros-server` from your runtime directory** (the one that contains `.env`).

Copy variables from the repo template:

`https://github.com/spear-systems/spear-aegros/blob/main/packages/aegros-server/.env.example`

### Minimum to get a local API listening

| Variable | Notes |
| -------- | ----- |
| `DATABASE_URL` | Set as in [section 4b](#4b-set-database_url-in-env). |
| `PORT` | Optional; default **3000**. |
| `HOST` | Optional; default **0.0.0.0**. |

### Strongly recommended before exposing the internet

| Variable | Notes |
| -------- | ----- |
| `NODE_ENV=production` | Enables production-oriented behavior (e.g. CORS warning if misconfigured). |
| `CORS_ORIGIN` | Comma-separated allowed browser origins. Do **not** leave `*` for public deployments. |
| `API_KEYS_REQUIRED=true` | Require `X-API-Key` / `Bearer` on APIs (except health). Create keys with **`create-api-key.mjs`** (see [section 10](#10-creating-api-keys-in-production)) or your own process — see [runbooks](../runbooks.md). |

### Artifacts directory

| Variable | Notes |
| -------- | ----- |
| `AEGROS_ARTIFACTS_DIR` | Defaults to `data/artifacts` **relative to the process cwd**. Set an **absolute path** in production so behavior does not depend on where you start the binary from. |

### AI (all optional)

If unset, AI stages effectively no-op. To enable, set **`AEGROS_AI_PROVIDER`** to `ollama`, `openai`, or `gemini` and the matching vendor variables from the template.

**Every variable** is documented in **[Configuration reference](./configuration.md)**.

---

## 6. Start the server

1. Open a shell.
2. **`cd`** to your runtime directory (where `.env` lives).
3. Run:

```bash
aegros-server
```

The wrapper sets **`AEGROS_PORTAL_DIST`** to the portal assets shipped inside the global package, so you do not need to build the portal yourself.

### Verify health

In another terminal:

```bash
curl -s http://127.0.0.1:3000/api/health
```

Or with the CLI (from any directory, if defaults match):

```bash
aegros health
```

You should see JSON including database connectivity and a core version string.

---

## 7. First job from the CLI

### Optional: default API URL and API key

Create **`~/.aegros/config.json`** (Linux/macOS) or **`%USERPROFILE%\.aegros\config.json`** (Windows):

```json
{
  "apiBaseUrl": "http://127.0.0.1:3000/api",
  "apiKey": "aeg_your_key_if_required"
}
```

Flags **override** this file. Full CLI options: **[CLI reference](./cli.md)**.

### Create a job

```bash
aegros jobs create -d example.com --json
```

If your server enforces authorized use, add **`--ack`** (matches `"ackAuthorized": true` in the API).

If **`API_KEYS_REQUIRED=true`**, pass **`-k`** or set the key in the config file.

### Watch progress (interactive)

```bash
aegros jobs watch <job-id>
```

For scripts, use **`aegros jobs get <id> --json`** on a schedule instead of `watch`.

---

## 8. First job from the portal

In a browser (trailing slash recommended):

`http://127.0.0.1:3000/portal/`

Create a job from the UI. If API keys are required, the portal can store **`X-API-Key`** in the browser (see **[Portal](./portal.md)** for SARIF download caveats in the browser).

---

## 9. Where integrations fit

- **Webhooks and SARIF** (for CI and defect tracking): **[Integrations](../integrations.md)**.
- **Docker scanner sidecar**: **[Docker](../docker.md)**.

---

## 10. Creating API keys in production

When **`API_KEYS_REQUIRED=true`**, you must insert hashed keys into the database. The npm tarball does **not** register a `create-api-key` command. Spear ships a small Node script in the repo:

`https://github.com/spear-systems/spear-aegros/blob/main/packages/aegros-server/scripts/create-api-key.mjs`

**Recommended (same runtime directory as the server):**

1. Save **`create-api-key.mjs`** next to your `prisma/` folder (from the [GitHub script path](https://github.com/spear-systems/spear-aegros/blob/main/packages/aegros-server/scripts/create-api-key.mjs) or your sparse clone).

2. One-time dev dependencies for key generation only:

   ```bash
   cd /opt/aegros          # your runtime root (same layout as section 4a)
   npm init -y             # once; creates package.json if missing
   npm install @prisma/client@6.19.3
   npx prisma@6.19 generate --schema=./prisma/schema.prisma
   ```

3. With `DATABASE_URL` matching **production** `.env`, run:

   ```bash
   export DATABASE_URL="…"   # same value the server uses
   node create-api-key.mjs "Production portal"
   ```

   The script prints the **`aeg_…`** secret once; store it in a password manager.

**Postgres:** use the same URL the server uses (often over TLS). **SQLite:** point at the live file path; stop `aegros-server` briefly if you must avoid concurrent write locks, or run from a replica path your org prefers.

Never commit secrets or run the script where stdout is logged without redaction.

---

## 11. Troubleshooting

| Symptom | What to check |
| ------- | ------------- |
| `command not found: aegros-server` | Global npm bin not on `PATH`; reinstall with `npm i -g` and follow npm’s PATH instructions for your OS. |
| Server starts but health shows database errors | `DATABASE_URL` wrong; migrations not applied; file permissions on SQLite path. |
| `P1001` / connection refused (Postgres) | Network, credentials, TLS mode in URL, firewall. |
| `.env` ignored | You did not **`cd`** to the directory containing `.env` before `aegros-server`. |
| CORS errors from the portal | `CORS_ORIGIN` must include the browser origin you use (scheme + host + port). |
| `401` on API | `API_KEYS_REQUIRED=true` but missing or wrong `X-API-Key` / `Authorization`. |
| Permission errors on artifacts | Set **`AEGROS_ARTIFACTS_DIR`** to a writable absolute path. |

For migrations and API key procedures in production, see **[Runbooks](../runbooks.md)**.

---

## 12. Reference index (same usage track)

| Topic | Document |
| ----- | -------- |
| Full environment variable table | **[Configuration](./configuration.md)** |
| CLI flags and `--json` | **[CLI](./cli.md)** |
| Portal behavior and SARIF in browser | **[Portal](./portal.md)** |
| HTTP routes, SSE, rate limits | **[API overview](./api-overview.md)** |

Spear engineers building or publishing the product should use **[Development](../development/README.md)** instead of this guide.
