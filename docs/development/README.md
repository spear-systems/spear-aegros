# Development (maintainers & contributors)

Use this track to **build, test, and ship** Spear Aegros from the monorepo. End-user install and runtime configuration lives under [../usage/README.md](../usage/README.md).

## What you must configure (maintainers only)

These are **not** settings for people who only _run_ a published build. They concern **your** org, registry, and release pipeline:

| Item                                               | Purpose                                                                                            |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **GitHub org & repo**                              | Hosting, branch protection, OIDC to npm ([github-and-npm-release.md](./github-and-npm-release.md)) |
| **npm trusted publishing (OIDC)** or **npm token** | Publishing `@spearsystems/aegros` ([../npm-publish.md](../npm-publish.md))                         |
| **Version bumps**                                  | `packages/aegros/package.json` (and aligned workspace versions if you policy-lock them)            |
| **CI secrets** (only if not using OIDC)            | Legacy `NPM_TOKEN` for `npm publish`                                                               |

**Everyone who runs the server** (including you in staging) uses **operator** settings documented in [../usage/configuration.md](../usage/configuration.md) — `DATABASE_URL`, `API_KEYS_REQUIRED`, AI keys, etc.

Clarified list: [maintainer-config.md](./maintainer-config.md).

## Guides

1. [Local workflow](./local-workflow.md) — clone, install, Prisma, dev server, portal dev proxy.
2. [Testing before publish & push](./testing-before-publish.md) — exact commands to run locally and what “green” means.
3. [GitHub & npm release](./github-and-npm-release.md) — first-time org setup, CI, publishing, post-release smoke.
4. [Production readiness review](./production-readiness-review.md) — checklist before calling a release “production” (CORS, TLS, DB, secrets, legal).

## Existing deep dives

- [../github-setup.md](../github-setup.md) — branch protection, Dependabot (summary; release flow expanded in github-and-npm-release.md).
- [../npm-publish.md](../npm-publish.md) — dist-tags, provenance, pack.
- [../CONTRIBUTING.md](../CONTRIBUTING.md) — PR gate (lint, format, typecheck, test, build).
