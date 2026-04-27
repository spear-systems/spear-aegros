# Maintainer Release Flow

This project ships one package: `@spearsystems/aegros`.

## Branch model

- `main` is integration.
- `release` is the publish branch.
- Publish from `release` only.

## One-time setup

- npm package exists and maintainer account has publish rights.
- GitHub repository secret `NPM_TOKEN` is configured (token-based publish).
- Branch protection enabled on `main` and `release`.

### Create `NPM_TOKEN` (automation token)

1. Log in to npm as a package owner (`npm owner ls @spearsystems/aegros`).
2. npm website -> account settings -> **Access Tokens** -> create **Automation** token.
3. GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret:
   - Name: `NPM_TOKEN`
   - Value: paste the npm automation token
4. (Optional verify locally) `npm whoami`

## Prepare a release

1. Branch from `main` to `release`.
2. Update version in `packages/aegros/package.json` (examples: `1.0.0`, `1.0.1`, `1.1.0-beta.1`).
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

For `v1.0.0-rc.1` and later, validate report consumers tolerate additive JSON blocks (`summary`, `scoring`, `infrastructureMap`, `integrations`) while preserving existing `schema@v2` fields.
For current RC line updates, also validate additive domain intelligence blocks (for example `subdomains`, `tls`, `delivery`, `hosting`, and `ports`) are treated as optional by downstream consumers.

## Publish from `release`

Publishing is automatic via `.github/workflows/release.yml`.
The workflow derives npm tag from version:

- `x.y.z` -> `latest`
- `x.y.z-rc.n` -> `rc`
- `x.y.z-beta.n` -> `beta`
- `x.y.z-alpha.n` -> `alpha`

You only need to bump `packages/aegros/package.json` version, then merge/push to `release`.
After publish, the workflow moves `latest` to the same version.

## Make `.github/workflows/release.yml` work

Required checklist:

1. Branch exists: `release`.
2. Workflow file is on default branch (so GitHub can run it).
3. Repository secret `NPM_TOKEN` is set.
4. Package version in `packages/aegros/package.json` is new (npm rejects republishing same version).
5. GitHub Actions permissions allow `contents: write`.
6. Repository allows pushing tags from workflow (`vX.Y.Z` / `vX.Y.Z-rc.N` / etc).

Quick verification before trigger:

```bash
npm view @spearsystems/aegros dist-tags --json
```

Then push to `release` (or run workflow_dispatch).

Notes:

- `npm publish --tag <tag>` assigns prerelease/stable tag; workflow then rewrites `latest` to this version.
- Workflow uses a concurrency guard to avoid parallel duplicate publishes.

## Publish locally (without GitHub Actions)

Use this when CI publish is unavailable or you intentionally want a manual release.

1. Ensure your npm user has publish rights:

```bash
npm whoami
npm owner ls @spearsystems/aegros
```

2. Build and verify locally:

```bash
npm ci
npm run build
npm run lint
npm run typecheck
npm test
npm run pack:dry
```

3. Publish with the correct tag:

- Stable (`1.0.0`):

  ```bash
  npm publish -w @spearsystems/aegros --tag latest
  ```

- RC (`1.0.0-rc.1`):

  ```bash
  npm publish -w @spearsystems/aegros --tag rc
  ```

- Beta (`1.1.0-beta.1`):

  ```bash
  npm publish -w @spearsystems/aegros --tag beta
  ```

4. Verify tags:

```bash
npm view @spearsystems/aegros dist-tags --json
```

If newest version is not on `latest`, force it:

```bash
npm dist-tag add @spearsystems/aegros@1.0.0-rc.1 latest
```

5. Create and push matching git tag:

```bash
git tag v1.0.0-rc.1
git push origin v1.0.0-rc.1
```

Notes:

- Local publishes bypass CI safeguards; use only when needed.

## GitHub release

1. Tag commit from `release` (example `v1.0.0` or `v1.0.1`).
2. Create GitHub Release from that tag.
3. Include install and verification snippet:

```bash
npm install -g @spearsystems/aegros@1.0.0
spear-aegros --version
```

## Post-release smoke test

```bash
npm install -g @spearsystems/aegros@1.0.0
spear-aegros doctor
spear-aegros scan --domain example.com --ack-authorized
```
