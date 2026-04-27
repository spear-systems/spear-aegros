# Spear Aegros

Spear Aegros is a security assessment and internet fingerprinting platform.

`@spearsystems/aegros` is the platform CLI distribution. It provides guided assessment workflows, internet fingerprinting, and report-driven recommendations in one package.

## Install

```bash
npm install -g @spearsystems/aegros@latest
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
