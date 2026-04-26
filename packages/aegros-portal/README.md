# `@spearsystems/aegros-portal`

Operator **React** app (Vite). Built with `base: '/portal/'` for hosting under the Nest static path.

## Design system

Canonical spec: **[docs/design/portal.md](../../docs/design/portal.md)** — color roles, typography, spacing, and components.

Implementation:

- `src/styles/tokens.css` — CSS variables (palette, spacing, radii, shadows).
- `src/styles/components.css` — buttons, cards, nav, inputs, layout shell.

**Fonts:** Inter + IBM Plex Mono (Google Fonts) + Arial stack; IBM Plex Mono stands in for **MDIO** until licensed.

## Dev

```bash
npm run dev -w @spearsystems/aegros-portal
```

Vite dev server (port 5173) does not serve `/api`; run the Nest server separately or proxy later.

## Build

```bash
npm run build -w @spearsystems/aegros-portal
```

Output: `dist/` consumed by `aegros-server` or the umbrella bundle.
