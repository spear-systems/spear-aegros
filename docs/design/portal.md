# Portal design system (canonical)

This document is the **source of truth** for `packages/aegros-portal`. Implementation uses **CSS custom properties** in `src/styles/tokens.css` and component rules in `src/styles/components.css`.

**Typography:** **Inter** is used for display headings. **Arial** (with a sensible system-ui stack where applicable) is used for body copy, buttons, and form controls. **IBM Plex Mono**—loaded from Google Fonts—serves compact UI labels and captions. If the product adopts a different licensed monospace later, update this document and the font import together.

## 1. Visual theme

- Minimal, functional, security-adjacent.
- Charcoal neutrals + disciplined purple / teal / blue accents.
- Generous whitespace; typography-led hierarchy; minimal shadows.

## 2. Color roles

| Token          | Hex                   | Role                                      |
| -------------- | --------------------- | ----------------------------------------- |
| Charcoal       | `#181717`             | Primary text, headings                    |
| Dark gray      | `#2E2D2D`             | Secondary text                            |
| Purple         | `#995FC3`             | Brand accent / accent CTA                 |
| Teal           | `#09825D`             | Infrastructure accent                     |
| Blue           | `#5A82DE` … `#CEDEFD` | Technical / data states                   |
| Black          | `#000000`             | Primary solid button                      |
| White          | `#FFFFFF`             | Surfaces on dark; primary text on buttons |
| Off-white      | `#F9F7F6`, `#F7F5F4`  | Subtle surfaces                           |
| Light gray     | `#EEEBEA`             | Borders, dividers                         |
| Error          | `#D04841`             | Errors / destructive emphasis             |
| Nav background | `#A9A9A9`             | Top navigation bar                        |

## 3. Typography

| Role         | Font          | Size                          | Weight | Line height |
| ------------ | ------------- | ----------------------------- | ------ | ----------- |
| Display / H1 | Inter         | 48px (clamp on small screens) | 500    | ~1.2        |
| Heading / H3 | Arial         | 20px                          | 700    | 30px        |
| Body         | Arial         | 14px                          | 400    | 21px        |
| Button       | Arial         | 14px                          | 600    | 21px        |
| UI label     | IBM Plex Mono | 12px                          | 500    | 14.4px      |
| Caption      | IBM Plex Mono | 12px                          | 400    | 14.4px      |

Weights allowed: **400, 500, 600, 700** only. No decorative italics in core UI.

## 4. Buttons

- **Primary:** `#000000` bg, `#FFFFFF` text, 40px height, `0` radius, hover `#2E2D2D`, active `#181717`.
- **Secondary:** transparent, `#000000` text, `1px solid #000000`, hover bg `#F9F7F6`.
- **Ghost:** transparent, `#181717`, Inter 14/500, radius `8px`, hover `#F9F7F6`.
- **Accent:** `#995FC3` bg, white text, radius `16px`, subtle md shadow; hover `#8B4DAF`.

## 5. Cards

- **Standard:** white bg, `1px #EEEBEA`, radius `8px`, padding `24px`, md shadow.
- **Elevated:** padding `32px`, lg shadow.
- **Semantic (error):** `#D04841` bg, white text (use sparingly).

## 6. Inputs

- Height `40px`, padding `12px 16px`, Arial 14/400, `1px solid #000000`, radius `0`.
- Placeholder `#2E2D2D` at 60% opacity.
- Focus: border `#000000` + lg shadow; visible focus ring on all interactives.

## 7. Top navigation

- Height **72px**, horizontal padding **32px**, background `#A9A9A9`.
- Links: monospace label stack (IBM Plex Mono), uppercase, white; hover `#CEDEFD`, active `#5A82DE`.
- Dropdown (future): menu bg `#181717`, item hover `#2E2D2D`.

## 8. Spacing scale (only these px values)

`4, 8, 12, 16, 20, 24, 32, 36, 64, 72, 84` — no arbitrary spacing.

## 9. Layout

- Max content width **1400px**, centered.
- Section gaps **64px–84px** desktop; reduce on tablet/mobile per responsive table.

## 10. Breakpoints

- **Mobile:** 320–767px — single column, 16px page gutters, nav drawer pattern when implemented.
- **Tablet:** 768–1024px — 2-column grids, 24px gutters.
- **Desktop:** 1025–1400px — 3–4 column grids, 32px gutters.
- **Large:** 1401px+ — max-width 1400px centered.

## 11. Shadows (elevation)

| Level | Value                               | Use               |
| ----- | ----------------------------------- | ----------------- |
| md    | `rgba(24,23,23,0.02) 0 4px 8px 0`   | Cards             |
| lg    | `rgba(7,26,36,0.24) 0 3px 10px 1px` | Elevated / focus  |
| xl    | `rgba(24,23,23,0.16) 0 4px 16px 0`  | Modals / emphasis |

## 12. Do / Don’t (PR checklist)

**Do:** use the neutral scale for hierarchy; reserve accents for CTAs and status; keep line-height ≥1.2× for body; use spacing scale only; implement focus states; minimum contrast 4.5:1.

**Don’t:** use accent colors for body copy; add decorative shadows to flat inputs; invent new hex values; mix random border radii on primary/secondary buttons; skip keyboard focus.

## 13. Touch targets

Minimum **44×44px** tap targets; keep **16px** minimum gap between adjacent primary actions on mobile.
