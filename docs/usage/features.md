# Features

`@spearsystems/aegros` (RC line) is a single CLI tool focused on practical external security analysis.

## Core capabilities

- **Interactive mode by default**: `spear-aegros` opens a guided wizard.
- **Collapsible activity logs**: live scan logs with `l` / `Esc` toggle.
- **Policy modes**:
  - `passive`: DNS + HTTPS HEAD fingerprint
  - `standard`: DNS + HTTP(S) GET + header checks
  - `aggressive`: standard + extra `www` probe
- **Web fingerprinting**:
  - `Server` and `X-Powered-By`
  - common platform hints (Cloudflare, nginx, Apache, Vercel, IIS, etc.)
  - security header presence inventory
- **Security findings**:
  - missing SPF / DMARC
  - missing HSTS / CSP / framing controls
  - endpoint/server error observations
- **Report persistence**:
  - JSON report files in `~/.spear-aegros/reports/`
  - Markdown summary files beside JSON
  - index file (`index.jsonl`) for report listing/search

## Report workflows

- List saved reports: `spear-aegros reports list`
- Open a report by id/path: `spear-aegros reports show <id-or-path>`
- Pipe structured output: add `--json` on supported commands

## Operator safety guardrails

- Explicit authorized-use acknowledgement is required.
- Domain normalization and configurable domain limits.
- Timeout and max-domain controls in config.
