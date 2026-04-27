# `@spearsystems/aegros`

Spear Aegros is a security assessment and internet fingerprinting platform.

This package is the platform CLI distribution: guided assessment workflows, internet fingerprinting, and report-driven recommendations in one install.

## Install

```bash
npm install -g @spearsystems/aegros@latest
spear-aegros --version
```

## Use (recommended)

```bash
spear-aegros
```

That opens the interactive wizard and performs scan + reporting.

## One-shot usage (non-interactive)

```bash
spear-aegros scan --domain example.com --ack-authorized
spear-aegros scan --domains example.com,example.org --policy standard --ack-authorized
spear-aegros scan --tui --domain example.com --ack-authorized
```

## Command reference

- `spear-aegros` / `spear-aegros interactive` — wizard + **Ink** UI, **collapsible activity log** (`l` / `Esc`), JSON + Markdown reports.
- `spear-aegros scan --tui …` — same log panel for a one-shot scan from flags.
- `spear-aegros scan` — DNS, HTTP fingerprint (headers / stack hints), security header findings; writes `report-*.json` + `.md`.
- `spear-aegros reports list` / `reports show <id>` — inspect saved reports.
- `spear-aegros init` — readline guided config.
- `spear-aegros config show|set|reset|path` — config management.
- `spear-aegros doctor` — local setup checks.
- `spear-aegros upgrade-help` — uninstall/reinstall flow.

Built-in help:

```bash
spear-aegros --help
spear-aegros scan --help
spear-aegros config set --help
spear-aegros reports --help
```

## Report storage

By default reports are stored in:

- `~/.spear-aegros/reports/`

Each run writes:

- JSON report (`report-*.json`)
- Markdown summary (`report-*.md`)

List and read later:

```bash
spear-aegros reports list
spear-aegros reports show <report-id-or-path>
```

## Config keys

Stored at `~/.spear-aegros/config.json`:

- `defaultPolicy` (`passive|standard|aggressive`)
- `outputDir`
- `timeoutMs`
- `maxDomains`
- `ackAuthorizedUse`

Examples:

```bash
spear-aegros config show
spear-aegros config set --default-policy standard --max-domains 50
spear-aegros config set --output-dir ./reports --timeout-ms 12000
```

## Migrate from older beta installs

```bash
npm uninstall -g @spearsystems/aegros
npm cache verify
npm install -g @spearsystems/aegros@latest
spear-aegros --version
```

## Legal

Use only on systems you are authorized to assess. Proprietary software; see `LICENSE`.

## Community

- Issues / bug reports: [github.com/spear-systems/spear-aegros/issues](https://github.com/spear-systems/spear-aegros/issues)
- Security policy: [github.com/spear-systems/spear-aegros/security/policy](https://github.com/spear-systems/spear-aegros/security/policy)
- Contributing guide: [github.com/spear-systems/spear-aegros/blob/main/docs/CONTRIBUTING.md](https://github.com/spear-systems/spear-aegros/blob/main/docs/CONTRIBUTING.md)
