# Contributing

## Scope

- This repository is CLI-only for `@spearsystems/aegros`.
- Avoid adding server/portal or split-package assumptions back into docs or code.

## Local quality gate

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
- If CLI behavior changes, update `docs/usage/install-from-npm.md` and `docs/usage/configuration.md`.
- If release process changes, update `docs/maintainers/release.md`.

## Security

Run assessments only on systems you are explicitly authorized to test.
