# Contributing

## Documentation map

- **[Development track](./development/README.md)** — local workflow, testing before publish, GitHub & npm release, maintainer-only vs operator config.
- **[Usage track](./usage/README.md)** — install, configure, CLI, portal, API (for operators and integrators).

## Prerequisites

See root [README.md](../README.md) for Node/npm versions and `.nvmrc`.

## Local workflow

See [development/local-workflow.md](./development/local-workflow.md). Quick gate:

```bash
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

## Pull requests

- One logical change per PR when possible.
- CI must be green (lint, format, typecheck, test, build).
- For UI work, follow [design/portal.md](./design/portal.md) (tokens, spacing, typography).
- If you change runtime behavior or env vars, update **`docs/usage/`** and **`packages/aegros-server/.env.example`**.

## Security

Do not run aggressive scans against hosts you do not own. See [legal-safe-use.md](./legal-safe-use.md).

## Before merge (maintainers)

Follow [development/testing-before-publish.md](./development/testing-before-publish.md) for the full pre-push checklist.
