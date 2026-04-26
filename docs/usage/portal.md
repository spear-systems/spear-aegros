# Operator portal

New installs: **[Install from npm — section 8 (first job from the portal)](./install-from-npm.md#8-first-job-from-the-portal)**.

## Where it is served

- When using **`aegros-server`**: open **`http://<host>:<port>/portal/`** (trailing slash recommended).
- **Vite dev** (`npm run dev -w @spearsystems/aegros-portal`): open the URL Vite prints; the dev server **proxies** `/api` to `http://127.0.0.1:3000`, so keep `aegros-server` running on port 3000 or adjust `vite.config.ts`.

## Features (current)

- List recent jobs (polls every few seconds).
- Create a job: domains (comma-separated), policy (`passive` / `standard` / `aggressive`), sends `ackAuthorized: true`.
- Store **`X-API-Key`** in the browser (`localStorage`) when your API has `API_KEYS_REQUIRED=true`.
- Select a job to view JSON detail and a link pattern for SARIF export.

## SARIF download in the browser

`GET /api/v1/jobs/:id/sarif` may require the same API key as JSON APIs. Browsers do not attach `X-API-Key` when opening a new tab from a plain `<a href>`. Options:

- Use a download tool or script with the header, or
- Terminate TLS at a gateway that injects auth, or
- Add a same-origin proxy you control (advanced).

For many teams, SARIF is fetched by **CI** using `curl` with `-H "X-API-Key: …"`.

## Design system

Visual tokens and components: [../design/portal.md](../design/portal.md).
