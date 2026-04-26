# npm publish (`@spearsystems/aegros`)

**Operator/runtime configuration** (what customers set on servers) is **not** covered here — see [usage/configuration.md](./usage/configuration.md).

**Maintainer workflow** (clone, test, GitHub, first publish): [development/github-and-npm-release.md](./development/github-and-npm-release.md) and [development/testing-before-publish.md](./development/testing-before-publish.md).

## Why `publishConfig.provenance` is not set in `package.json`

npm **Sigstore provenance** is generated only when npm can see a **supported CI provider** (e.g. GitHub Actions) and OIDC. If `"provenance": true` sits in `publishConfig`, **`npm publish` from your laptop** fails with:

```text
npm error Automatic provenance generation not supported for provider: null
```

So this repo keeps **`access: "public"`** only under `publishConfig`. You add **`--provenance` on the CI job** that publishes (see below).

## Prerelease (first beta)

`@spearsystems/aegros` depends on **`@spearsystems/aegros-core`** at the same version. **Publish the core package first** (or in the same release window) so global installs can resolve it from the registry:

```bash
npm publish -w @spearsystems/aegros-core --tag beta
npm publish -w @spearsystems/aegros --tag beta
```

1. Bump version in **`packages/aegros/package.json`** and **`packages/aegros-core/package.json`** (and align other workspace packages + `AEGROS_CORE_VERSION` in `aegros-core/src/index.ts` if you keep them in lockstep; e.g. `0.1.0-beta.1`).
2. From repo root: `npm run build` (runs workspace builds + umbrella `prepack` bundle).
3. Inspect tarball: `npm pack -w @spearsystems/aegros` (or `npm run pack:dry` from root).
4. Publish with a **dist-tag** so `latest` stays stable (commands above).

5. Consumers: `npm i -g @spearsystems/aegros@beta` (or exact version).

## Industry-standard setup (recommended)

| Piece                                  | Purpose                                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Trusted publishing (OIDC)**          | Link the GitHub repo to `@spearsystems/aegros` on npm so CI can publish **without** a long-lived `NPM_TOKEN`. Configure in npmjs.com package settings. |
| **Publish from GitHub Actions only**   | Reproducible builds, audit trail, provenance tied to a commit.                                                                                         |
| **`npm publish … --provenance` in CI** | Attestation that the tarball was built on that workflow run.                                                                                           |

Typical CI step (after `npm ci` + `npm run build`):

```bash
npm publish -w @spearsystems/aegros --tag beta --provenance
```

Workflow needs at least:

```yaml
permissions:
  id-token: write
  contents: read
```

Follow npm’s current **“Trusted publishers” / OIDC** docs for the exact `actions/setup-node` + registry pairing for your npm account.

## Manual publish from your machine (fallback)

- `npm login` (2FA on the publisher account).
- `npm publish -w @spearsystems/aegros --tag beta` after `npm run build`.
- **No** automatic provenance on local publishes (by design). Prefer moving publishes to CI once OIDC is configured.

## Post-publish smoke

```bash
aegros-server
# elsewhere
curl -s http://127.0.0.1:3000/api/health
aegros health --url http://127.0.0.1:3000/api
```

## Changesets (optional)

- `npx changeset` for version bumps and changelog discipline; merge version PR; then publish as above.
