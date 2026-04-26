# Requirements

## Runtime

- **Node.js** ≥20.19 and &lt;27 (see root `README.md` and `engines` in `package.json`).
- **npm** ≥10 (for global install of the umbrella package).

## Operating systems

- **Linux**, **macOS**, and **Windows** are supported for **Node-only** operation (API + CLI + portal static files).
- **Docker** is optional: required only if you use the **Linux scanner sidecar** (`AEGROS_SCANNER_IMAGE`). On macOS/Windows use Docker Desktop if you enable that feature.

## Network

- Outbound **HTTPS** to assessed targets (HTTP probes, certificate transparency).
- If you use **Ollama**: reachability to your Ollama host (often `localhost` or LAN).
- If you use **OpenAI** or **Gemini**: outbound HTTPS to vendor APIs.

## Permissions

- Read/write access to the **database** path (SQLite file or Postgres URL).
- Read/write access to **`AEGROS_ARTIFACTS_DIR`** for stage artifacts.
- If using **Docker sidecar**: permission for the `aegros-server` process to invoke the `docker` CLI (or run the server inside a container that has Docker-in-Docker — advanced).

## Accounts & keys (operator-provided)

- **API keys** for clients (if `API_KEYS_REQUIRED=true`) — you generate on the server.
- **LLM vendor keys** — you supply if AI is enabled.
- **Webhook secrets** — you supply when inserting webhook rows (until an admin API exists).

Spear Systems does **not** need your operator secrets; see [../development/maintainer-config.md](../development/maintainer-config.md) for what is maintainer-only.
