# GitHub and npm: what to do next

This is the **maintainer checklist** for connecting the repo to **GitHub** and shipping **`@spearsystems/aegros`** on **npm**. Operators installing the product do not perform these steps.

## A. GitHub (first time)

1. **Create the repository** under `spear-systems` (e.g. `spear-systems/spear-aegros`), default branch `main`.
2. **Push this monorepo** (after local testing per [testing-before-publish.md](./testing-before-publish.md)):

   ```bash
   git remote add origin https://github.com/spear-systems/spear-aegros.git
   git push -u origin main
   ```

3. **Branch protection** on `main`: require PR, require CI workflow success, no force-push (see [../github-setup.md](../github-setup.md)).
4. **Enable GitHub Actions** if disabled for new repos.
5. Optional: **Dependabot** for `npm`, **CODEOWNERS** on `packages/**`.

## B. npm organization

1. Ensure package scope **`@spearsystems`** exists and your publisher user has **publish** rights.
2. Enable **2FA** on publishing accounts (npm requirement).
3. Configure **Trusted Publishing** (OIDC) from GitHub → npm for `@spearsystems/aegros` (recommended; see [../npm-publish.md](../npm-publish.md)).

## C. First publish (manual path)

From monorepo root after a green [testing-before-publish.md](./testing-before-publish.md) run:

```bash
npm run build
npm publish -w @spearsystems/aegros --tag beta
```

Use `--tag beta` until you intentionally promote a stable `latest`.

## D. CI expectations

The workflow at `.github/workflows/ci.yml` runs on `ubuntu-latest` and `windows-latest`: install, lint, format, typecheck, test, build, SBOM (Ubuntu only). **PRs should stay green on both OSes.**

## E. After publish (smoke)

On a clean machine or container:

```bash
npm i -g @spearsystems/aegros@beta
aegros health --url http://<your-server-host>/api
```

If you self-host the API, set operator env on that host per [../usage/configuration.md](../usage/configuration.md).

## F. Ongoing releases

1. Bump version in `packages/aegros/package.json` (align changelog if you use Changesets).
2. Merge to `main` with green CI.
3. `npm publish -w @spearsystems/aegros --tag <beta|latest>` (or automated workflow you add).
4. Tag the git release (`v0.1.0-beta.x`) for traceability.

## Related

- [maintainer-config.md](./maintainer-config.md) — what only Spear configures vs operators.
- [../npm-publish.md](../npm-publish.md) — provenance, dist-tags, pack details.
