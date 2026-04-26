# npm publish (`@spearsystems/aegros`)

**Operator/runtime configuration** (what customers set on servers) is **not** covered here — see [usage/configuration.md](./usage/configuration.md).

**Maintainer workflow** (clone, test, GitHub, first publish): [development/github-and-npm-release.md](./development/github-and-npm-release.md) and [development/testing-before-publish.md](./development/testing-before-publish.md).

## Prerelease (first beta)

1. Bump version in **`packages/aegros/package.json`** (e.g. `0.1.0-beta.0`).
2. From repo root: `npm run build` (runs workspace builds + umbrella `prepack` bundle).
3. Inspect tarball: `npm pack -w @spearsystems/aegros` (or `npm run pack:dry` from root).
4. Publish with a **dist-tag** so `latest` stays stable:

```bash
npm publish -w @spearsystems/aegros --tag beta
```

5. Consumers: `npm i -g @spearsystems/aegros@beta` (or exact version).

## Provenance

- `packages/aegros` sets `"provenance": true` under `publishConfig`.
- Configure **trusted publishing** on npmjs.com for this package + GitHub repo (OIDC). Follow npm’s official “Connecting a repository” documentation.

## Manual publish (fallback)

- `npm login` (2FA required on publisher account).
- `npm publish -w @spearsystems/aegros` after `npm run build`.

## Post-publish smoke

```bash
aegros-server
# elsewhere
curl -s http://127.0.0.1:3000/api/health
aegros health --url http://127.0.0.1:3000/api
```

## Changesets (optional)

- `npx changeset` for version bumps and changelog discipline; merge version PR; then publish as above.
