# Product scope (overview traceability)

Spear Aegros is an **external attack surface** product. This table maps the **master overview plan** to **delivery targets**. Status reflects the current repo snapshot.

| Overview area             | Epic                                    | Target  | Status (current)                                                |
| ------------------------- | --------------------------------------- | ------- | --------------------------------------------------------------- |
| §1 Domain input + reports | Domain normalize + job + report v2      | beta-1+ | Done — `ReportArtifactV2`, pipeline engines, SARIF              |
| §2 Nest API + async jobs  | REST `v1/jobs` + Prisma + worker        | beta-2  | Done — SQLite default; staged persistence; recovery             |
| §2 CLI scriptable         | health, jobs create/get/watch, `--json` | beta-2  | Done — Ink TUI watch; `~/.aegros/config.json` profiles          |
| §2 Portal                 | Operator jobs UI                        | beta-2  | Done — list/create/detail + API key field                       |
| §3 Full pipeline DAG      | Stages + budgets + resume               | beta-2  | Done — `PIPELINE_ORDER` executed; budgets via env               |
| §4 Docker sidecar         | `AEGROS_SCANNER_IMAGE` contract         | beta-2  | Done — stub image + server runner                               |
| §5 AI adapters            | Ollama / Gemini / OpenAI                | beta-2  | Done — `AEGROS_AI_PROVIDER` + redaction                         |
| §6 Auth / RBAC / audit    | API keys, policies, audit log           | beta-2  | Partial — API keys + audit log; RBAC/roles minimal              |
| §6 SARIF / webhooks       | Integrations                            | beta-2  | Done — SARIF export + signed webhooks (DB-backed subscriptions) |
| §6 OTel / SBOM            | Ops                                     | beta-3  | Partial — SBOM script + CI; OTEL documented only                |

**Open decisions** (overview §9): record outcomes here as you decide (hosted vs on-prem, aggressive scan defaults, scanner license matrix, tenancy).
