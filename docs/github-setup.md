# GitHub setup (Spear Systems)

End-to-end release steps (push, CI, npm): **[development/github-and-npm-release.md](./development/github-and-npm-release.md)**.

## 1. Repository

- Create (or migrate) the repo under org **`spear-systems`** (e.g. `spear-systems/spear-aegros`).
- Default branch: **`main`**.
- Optional: work from a **`spear-master-dev`** integration fork—match your org convention.

## 2. Branch protection (`main`)

- Require pull request before merge.
- Require status checks: **CI** workflow (lint, format, typecheck, test, build).
- Disallow force-push where policy allows.

## 3. npm publishing from CI (recommended)

- Prefer **OIDC trusted publishing** from GitHub Actions to npm for `@spearsystems/aegros` instead of long-lived npm tokens in secrets.
- See [npm-publish.md](./npm-publish.md).

## 4. Optional

- **GitHub Environments** (e.g. `production`) with required reviewers for release workflows.
- **CODEOWNERS** for `packages/**`.
- **Dependabot** for npm (version + security updates).

## 5. First push checklist

- `.cursor/plans/` remains gitignored (local plans only); commit `.cursor/rules` if you add team rules.
- Commit **`package-lock.json`**, workflows, and `docs/`.
