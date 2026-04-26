# CLI reference (`aegros`)

## Global options

| Option            | Description                               |
| ----------------- | ----------------------------------------- |
| `--version`, `-V` | Print version.                            |
| `--help`, `-h`    | Help.                                     |
| `--json`          | Compact JSON on stdout (where supported). |

## Config file

Path: **`~/.aegros/config.json`** (create manually).

```json
{
  "apiBaseUrl": "http://127.0.0.1:3000/api",
  "apiKey": "aeg_your_key_here"
}
```

CLI flags **override** file values.

## Commands

### `aegros health`

Checks `GET …/health`.

| Option                | Description                                                    |
| --------------------- | -------------------------------------------------------------- |
| `-u, --url <base>`    | API base (default from config or `http://127.0.0.1:3000/api`). |
| `-k, --api-key <key>` | `X-API-Key` header.                                            |

### `aegros jobs create`

Creates `POST …/v1/jobs`.

| Option                | Description                                                                      |
| --------------------- | -------------------------------------------------------------------------------- |
| `-d, --domains <csv>` | **Required.** Comma-separated hostnames.                                         |
| `-u, --url`           | API base.                                                                        |
| `-k, --api-key`       | API key.                                                                         |
| `--policy <p>`        | `passive` (default), `standard`, or `aggressive`.                                |
| `--ack`               | Sets `ackAuthorized: true` (required when server has `AEGROS_ENFORCE_ACK=true`). |

### `aegros jobs get <id>`

`GET …/v1/jobs/:id`. Same `-u` / `-k` as above.

### `aegros jobs watch <id>`

Ink TUI; polls job status until terminal state. **Does not** support `--json`.

## CI / automation

Use `--json` with `health` and `jobs create` / `jobs get` for stable parsing and exit codes. Example:

```bash
aegros jobs create -d example.com --ack --json | jq -r .id
```

Ensure the job runner sets `AEGROS_ENFORCE_ACK` / API key env consistently with your policy.
