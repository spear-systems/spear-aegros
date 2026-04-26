# Testing before you push to GitHub or publish to npm

Run these **from the monorepo root** in order. Treat any failure as a blocker for merge or release.

## 1. Clean install gate (matches CI)

```bash
rm -rf node_modules
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

On Windows (PowerShell) use `Remove-Item -Recurse -Force node_modules` instead of `rm -rf`.

## 2. Prisma migrations apply cleanly

Use a **fresh** SQLite path to simulate a new deploy:

```bash
$env:DATABASE_URL="file:./packages/aegros-server/prisma/preflight.db"   # PowerShell
# export DATABASE_URL=file:./packages/aegros-server/prisma/preflight.db  # bash
npm run db:migrate -w @spearsystems/aegros-server
```

Confirm no errors. Delete the preflight db file afterwards if you like.

## 3. Publish tarball dry run

```bash
npm run pack:dry
```

Inspect output for unexpected `npm notice` warnings and tarball size sanity.

## 4. Optional: global smoke from packed tarball (closest to user install)

```bash
npm pack -w @spearsystems/aegros
npm install -g .\spearsystems-aegros-*.tgz   # adjust filename from pack output
aegros-server   # in one terminal, after setting .env / DATABASE_URL for that shell
aegros health --url http://127.0.0.1:3000/api
```

Uninstall when done: `npm uninstall -g @spearsystems/aegros`.

## 5. SBOM (CI parity on Ubuntu)

```bash
npm run sbom
```

Generates `sbom.json` (gitignored). CI runs this on `ubuntu-latest` after build.

## 6. Before opening a PR (push to GitHub)

- [ ] All commands in section 1 green locally.
- [ ] No secrets in diff (grep for `sk-`, `AIza`, `xox`, bearer tokens).
- [ ] Update user-facing docs if behavior or env vars changed (`docs/usage/`, `packages/aegros-server/.env.example`).

## 7. Before `npm publish`

- [ ] Version bumped in `packages/aegros/package.json` (and changelog policy if you use Changesets).
- [ ] Sections 1–3 complete on the **release commit**.
- [ ] OIDC trusted publishing (or `npm login` + token) verified per [../npm-publish.md](../npm-publish.md).
- [ ] Post-publish smoke scripted in [github-and-npm-release.md](./github-and-npm-release.md).
