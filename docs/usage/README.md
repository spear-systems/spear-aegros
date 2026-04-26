# Usage (operators and integrators)

This track is for **anyone who installs and runs** Spear Aegros from **npm** on their own infrastructure — not for Spear engineers publishing packages (see **[Development](../development/README.md)**).

## Primary guide (npm, start to finish)

**[Install and run from npm (complete guide)](./install-from-npm.md)** — prerequisites, `npm install -g`, obtaining Prisma schema/migrations from GitHub, migrations, `.env`, starting `aegros-server`, health checks, first CLI and portal jobs, API keys, troubleshooting, and pointers to integrations.

Always read **[Legal / safe use](../legal-safe-use.md)** before running assessments.

## Reference (detail beyond the install guide)

| Document                            | Use when you need                                     |
| ----------------------------------- | ----------------------------------------------------- |
| [Configuration](./configuration.md) | Full table of server and client environment variables |
| [CLI](./cli.md)                     | Every `aegros` flag and `--json` behavior             |
| [Portal](./portal.md)               | Operator UI at `/portal/`, SARIF in the browser       |
| [API overview](./api-overview.md)   | REST routes, auth headers, SSE, rate limits           |

## Integrations

- **[Integrations](../integrations.md)** — webhooks and SARIF export

## Deprecated entry points

- **[Installation](./installation.md)** — redirects to the npm guide above.
- **[Requirements](./requirements.md)** — redirects to the npm guide above.
