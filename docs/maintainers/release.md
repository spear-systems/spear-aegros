# Maintainer Release Flow

This project ships one package: `@spearsystems/aegros`.

## Branch model

- `main` is integration.
- `release` is the publish branch.
- Publish from `release` only.

## One-time setup

- npm package exists and maintainer account has publish rights.
- GitHub Actions has npm trusted publishing (OIDC) configured, or a fallback `NPM_TOKEN`.
- Branch protection enabled on `main` and `release`.

## Your current npm state (from beta)

If npm org still shows both:

- `@spearsystems/aegros` (older beta metadata may still mention umbrella wording)
- `@spearsystems/aegros-core`

That is expected historically. For the RC line:

- Keep publishing only `@spearsystems/aegros`.
- Stop releasing new `@spearsystems/aegros-core` versions.
- Do not remove old versions abruptly unless your org policy requires cleanup.
- If desired later, deprecate old package line:

```bash
npm deprecate @spearsystems/aegros-core@"*" "Deprecated: functionality merged into @spearsystems/aegros"
```

## Prepare a release

1. Branch from `main` to `release`.
2. Update version in `packages/aegros/package.json` (examples: `0.1.0-rc.1`, `0.1.0`, `0.2.0-beta.1`).
3. Run local quality gate:

```bash
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
npm run pack:dry
```

4. Open PR into `release` and merge after review.

## Publish from `release`

Publishing is automatic via `.github/workflows/release.yml`.
The workflow derives npm tag from version:

- `x.y.z` -> `latest`
- `x.y.z-rc.n` -> `rc`
- `x.y.z-beta.n` -> `beta`
- `x.y.z-alpha.n` -> `alpha`

You only need to bump `packages/aegros/package.json` version, then merge/push to `release`.

## Make `.github/workflows/release.yml` work

Required checklist:

1. Branch exists: `release`.
2. Workflow file is on default branch (so GitHub can run it).
3. npm trusted publisher is configured for this repo/package (recommended), **or** repository secret `NPM_TOKEN` is set.
4. Package version in `packages/aegros/package.json` is new (npm rejects republishing same version).
5. GitHub Actions permissions allow:
   - `id-token: write`
   - `contents: write`
6. Repository allows pushing tags from workflow (`vX.Y.Z` / `vX.Y.Z-rc.N` / etc).

Quick verification before trigger:

```bash
npm view @spearsystems/aegros dist-tags --json
```

Then push to `release` (or run workflow_dispatch).

Notes:

- `npm publish --tag <tag>` already assigns the right dist-tag; the workflow does not do extra tag rewrites.
- Workflow uses a concurrency guard to avoid parallel duplicate publishes.

## GitHub release

1. Tag commit from `release` (example `v0.1.0-rc.1` or `v0.1.0`).
2. Create GitHub Release from that tag.
3. Include install and verification snippet:

```bash
npm install -g @spearsystems/aegros@0.1.0-rc.1
spear-aegros --version
```

## Post-release smoke test

```bash
npm install -g @spearsystems/aegros@0.1.0-rc.1
spear-aegros doctor
spear-aegros scan --domain example.com --ack-authorized
```
