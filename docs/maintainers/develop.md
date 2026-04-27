# Maintainer Development Guide

This document is the day-to-day maintainer workflow for developing `@spearsystems/aegros`.

Use this alongside:

- `docs/CONTRIBUTING.md` for contribution policy and quality gate
- `docs/maintainers/release.md` for publish/release procedures
- `docs/usage/*.md` for user-facing behavior that must stay accurate

## 1) Prerequisites

- Node.js `>=20.19.0 <27`
- npm `>=10`
- Git
- Internet access for passive intelligence integrations (many checks call public APIs)

Verify:

```bash
node -v
npm -v
```

## 2) Clone and install

From repo root:

```bash
npm ci
```

Workspace layout:

- root workspace scripts in `package.json`
- package implementation in `packages/aegros`
- CLI source in `packages/aegros/src`

## 3) Build, typecheck, test

Run full local quality gate from repo root:

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

Package-only checks (faster inner loop):

```bash
npm run typecheck -w @spearsystems/aegros
npm test -w @spearsystems/aegros
npm run build -w @spearsystems/aegros
```

## 4) Run the CLI during development

Build first:

```bash
npm run build -w @spearsystems/aegros
```

Run from workspace root with npm exec:

```bash
npm exec -- spear-aegros --help
npm exec -- spear-aegros interactive
npm exec -- spear-aegros scan --domain example.com --ack-authorized
```

Run with explicit policy:

```bash
npm exec -- spear-aegros scan --domain example.com --policy passive --ack-authorized
npm exec -- spear-aegros scan --domain example.com --policy standard --ack-authorized
npm exec -- spear-aegros scan --domain example.com --policy aggressive --ack-authorized
```

Run TUI one-shot scan:

```bash
npm exec -- spear-aegros scan --tui --domain example.com --ack-authorized
```

## 5) Configuration while developing

Show config:

```bash
npm exec -- spear-aegros config show
```

Set common values:

```bash
npm exec -- spear-aegros config set --default-policy standard --max-domains 50 --timeout-ms 12000
npm exec -- spear-aegros config set --ack-authorized-use true
```

Optional integration keys (redacted in output):

```bash
npm exec -- spear-aegros config set --virustotal-key "<key>" --otx-key "<key>"
npm exec -- spear-aegros config set --abuseipdb-key "<key>" --safebrowsing-key "<key>"
```

Environment variables override config values when present:

- `AEGROS_VIRUSTOTAL_API_KEY`
- `AEGROS_OTX_API_KEY`
- `AEGROS_ABUSEIPDB_API_KEY`
- `AEGROS_SAFEBROWSING_API_KEY`

## 6) Typical development loop

1. Create branch from `main`.
2. Implement one logical change set.
3. Run package checks (`typecheck`, `test`, `build`).
4. Run at least one real CLI smoke command (`scan` or `interactive`).
5. Update docs in the same change set if behavior changed.
6. Run full root quality gate before PR.

## 7) Reporting and artifact checks

After scan commands, validate:

- JSON report is written
- Markdown summary is written (unless disabled)
- report index has new entry

Useful commands:

```bash
npm exec -- spear-aegros reports list
npm exec -- spear-aegros reports latest
npm exec -- spear-aegros reports show <id-or-path>
npm exec -- spear-aegros doctor
```

## 8) Policy boundary validation checklist

When changing scanner logic, verify:

- `passive` does not perform aggressive activities
- `standard` enables safe probing only
- `aggressive` enables full active checks
- missing optional keys do not fail the scan

## 9) Debugging guidance

- Start with `npm exec -- spear-aegros doctor`
- Use `--json` on commands for machine-readable inspection
- Use smaller scope (`--domain`, lower `--max-domains`) during debug loops
- Increase timeout temporarily with `--timeout-ms` for unstable networks
- Keep flaky external integrations non-fatal and clearly reported as skipped/unavailable

## 10) Documentation maintenance rules

If behavior changes, update docs in the same PR:

- user behavior: `docs/usage/features.md`, `docs/usage/configuration.md`, `docs/usage/install-from-npm.md`
- maintainer workflow: this file
- release impacts: `docs/maintainers/release.md`

## 11) Pre-PR maintainer checklist

- Code compiles and tests pass.
- Lint and format checks pass.
- CLI commands still work for existing workflows.
- New functionality is covered by tests where practical.
- Docs are updated and consistent.
- No secrets are committed.

## 12) Safety note

Only run scans against assets you are explicitly authorized to assess.
