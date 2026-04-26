# Maintainer-only configuration (not for end users)

This page lists what **Spear Systems / release engineers** configure in **GitHub, npm, and local publish workflows**. These values are **not** read by the Aegros server at runtime.

## GitHub (`spear-systems`)

| Responsibility                             | Notes                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Repository creation, default branch `main` | See [../github-setup.md](../github-setup.md)                                                    |
| Branch protection                          | Require PR + CI green                                                                           |
| **OIDC → npm** “Trusted publisher”         | Preferred over long-lived `NPM_TOKEN`; pair the GitHub repo with package `@spearsystems/aegros` |
| Environments (optional)                    | e.g. `production` with required reviewers for a release workflow                                |
| **Secrets**                                | Only if you **do not** use OIDC: store `NPM_TOKEN` for `npm publish` (rotate; never commit)     |

## npm (`@spearsystems`)

| Responsibility                | Notes                                                                  |
| ----------------------------- | ---------------------------------------------------------------------- |
| Organization access           | Who may publish                                                        |
| **2FA** on publisher accounts | Required by npm for publishing                                         |
| **Provenance**                | Already enabled in umbrella `publishConfig`; ensure OIDC linkage works |
| **Dist-tag policy**           | e.g. `beta` until GA; avoid moving `latest` accidentally               |

## Release artifacts (your machine or CI)

| Step                                                                        | Owner           |
| --------------------------------------------------------------------------- | --------------- |
| Bump `packages/aegros` version (and optionally lockstep workspace versions) | Maintainer      |
| `npm run build` at monorepo root                                            | CI / you        |
| `npm publish -w @spearsystems/aegros --tag beta` (or CI job)                | Maintainer / CI |

## What is _not_ maintainer-only

Anything that appears in [packages/aegros-server/.env.example](../../packages/aegros-server/.env.example) is for **whoever runs `aegros-server`** (customer, partner, or your own staging VM). That is **operator** configuration — see [../usage/configuration.md](../usage/configuration.md).
