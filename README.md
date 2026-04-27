# Spear Aegros

`@spearsystems/aegros` is now a **single-package CLI** distribution for guided external attack-surface assessment.

This repository keeps source for that package only. Server/portal/core split packaging has been removed for this release-candidate line.

## Install

```bash
npm install -g @spearsystems/aegros@rc
spear-aegros --version
```

## User flow (simple)

1. Install from npm.
2. Run `spear-aegros` (interactive wizard + live logs) **or** `spear-aegros init` then `spear-aegros scan --ack-authorized …`.
3. Open saved reports under `~/.spear-aegros/reports/` or run `spear-aegros reports list`.

Full docs: `docs/usage/install-from-npm.md`.

## Documentation

- Users: `docs/usage/install-from-npm.md`
- Config reference: `docs/usage/configuration.md`
- Features: `docs/usage/features.md`
- Maintainers: `docs/maintainers/release.md`
- Contributors: `docs/CONTRIBUTING.md`

## Local development

```bash
npm ci
npm run build
npm run lint
npm run format:check
npm run typecheck
npm test
```

## License

Proprietary software. Use is governed by `LICENSE`. Third-party notices are in `NOTICE`.
