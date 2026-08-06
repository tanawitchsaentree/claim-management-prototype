# Technical Debt Baseline — Violations Report

> This is the technical debt baseline captured on 2026-05-07.
> **New code must not add to this list.**
> Existing violations to be fixed in dedicated cleanup PRs, not inline with feature work.

> **⚠️ STALE — captured 2026-05-07, not re-verified since.** Re-run `npm run audit:colors` for current counts before relying on the numbers below; as of 2026-08-06 the live count is materially different (17 lines, mostly in files not listed here) and 3 of the 10 files below (`claim-form.scss`, `claim-list.scss`, `claim-detail.scss`) no longer exist. Kept for historical context on why the fix-forward policy exists — do not treat as the current baseline.

---

## Audit results summary

| Rule | Status | Violations |
|------|--------|-----------|
| `audit:colors` — no hardcoded hex/rgb | ❌ FAIL | 78 lines across 10 files |
| `audit:imports` — no cross-feature imports | ✅ PASS | 0 |
| `audit:any` — no TypeScript `any` | ✅ PASS | 0 |
| `audit:subscribe` — no `.subscribe()` in components | ✅ PASS | 0 |
| `audit:hardcoded-data` — no inline data arrays in features | ✅ PASS | 0 |

---

## Rule: `audit:colors` — Hardcoded hex / rgb values

### `src/app/features/sections/sections.html`

| Line | Violation |
|------|-----------|
| 9 | `fill="#003781"` in inline SVG `<circle>` |

### `src/app/features/sections/sections.scss`

| Line | Violation |
|------|-----------|
| 4 | `$blue-active: #006192` — SCSS variable, should be CSS custom property |
| 5 | `$gray-bg: #f5f5f5` — SCSS variable |
| 6 | `$text-main: #404040` — SCSS variable |
| 7 | `$text-muted: #767676` — SCSS variable |
| 8 | `$border-color: #d9d9d9` — SCSS variable |
| 9 | `$brand-blue: #003781` — SCSS variable |
| 28 | `background: #fff` |
| 87 | `color: #006192` |
| 90 | `color: #006192` |
| 100 | `background: #006192` |
| 125 | `border: 1px solid #767676` |
| 140 | `background: #fff` |
| 142 | `color: #767676` (placeholder) |
| 149 | `background: #006192 !important` |
| 158 | `color: #fff !important` |
| 164 | `background: #49648c` |
| 169 | `color: #fff` |
| 246 | `background: rgba(0,0,0,0.05)` |
| 252 | `color: #ffffff` |
| 256 | `color: #ffffff` |
| 257 | `color: #ffffff !important` |
| 260 | `color: #ffffff` |
| 308 | `background: #ffffff` |
| 342 | `color: #006192` |
| 343 | `border: 2px solid #006192` |
| 353 | `color: #006192` |
| 357 | `background: rgba(0, 97, 146, 0.06)` |
| 363 | `background: #fff` |
| 403 | `background: #fdf3d6; color: #7a5200` (status chip --pending) |
| 404 | `background: #e8e8e8; color: $text-muted` (status chip --not-assigned) |
| 405 | `background: #dce9f8; color: #006192` (status chip --in-progress) |
| 406 | `background: #d4edda; color: #155724` (status chip --completed) |
| 434 | `color: #fff !important` |
| 456 | `color: #fff !important` |
| 466 | `background: #f0f4fb !important` |
| 470 | `background: #fff !important` |
| 472 | `box-shadow: 0 4px 12px rgba(0,0,0,0.12) !important` |

### `src/app/features/layout/sidebar/sidebar.scss`

| Line | Violation |
|------|-----------|
| 3 | `background: #fff` |
| 29 | `color: #767676` |
| 33 | `color: #003781` |
| 34 | `color: #003781` |
| 38 | `background: #e8f0fb` |
| 39 | `color: #003781` |
| 40 | `border-left-color: #003781` |
| 42 | `color: #003781` |

### `src/app/features/layout/navbar/navbar.scss`

| Line | Violation |
|------|-----------|
| 8 | `color: #fff` |
| 9 | `box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15)` |
| 21 | `color: #fff` |
| 22 | `color: #fff` |
| 34 | `background: rgba(255, 255, 255, 0.2)` |
| 41 | `color: #fff` |
| 53 | `color: #fff` |
| 59 | `color: rgba(255, 255, 255, 0.75)` |

### `src/app/features/layout/shell/shell.scss`

| Line | Violation |
|------|-----------|
| 18 | `background-color: #f5f5f5` |

### `src/app/features/dashboard/dashboard.html`

| Line | Violation |
|------|-----------|
| 7 | `fill="#003781"` in inline SVG `<circle>` |

### `src/app/features/dashboard/dashboard.scss`

| Line | Violation |
|------|-----------|
| 3–8 | SCSS variables `$blue-active`, `$brand-blue`, `$gray-bg`, `$text-main`, `$text-muted`, `$border-color` |
| 20 | `background: #fff` |
| 29 | `background: #fff` |
| 116 | `border: 1px solid #767676` |
| 131 | `background: #fff` |
| 133 | `color: #767676` (placeholder) |
| 149 | `color: #fff !important` |
| 155 | `background: #49648c` |
| 160 | `color: #fff` |
| 180 | `background: #fff` |
| 220–221 | `background: #fff; border: 1px solid #999` |
| 235 | `background: #f5f8ff` |
| 256 | `background: #fff` |
| 345 | `background: #dce9f8` |
| 357 | `color: #fff` |
| 379 | `background: #fff` |
| 416–420 | Status chip colors: `#dce9f8`, `#fdf3d6`, `#7a5200`, `#d4edda`, `#155724`, `#e8e8e8` |
| 432–434 | Priority dot colors: `#e4003a`, `#fdd25c`, `#d9d9d9` |
| 452 | `background: #fff` |
| 559 | `background: rgba(0, 97, 146, 0.06)` |

### `src/app/features/claims/claim-form/claim-form.scss`

| Line | Violation |
|------|-----------|
| 15 | `border-bottom: 1px solid #e8e8e8` |
| 31 | `border-top: 1px solid #e8e8e8` |

### `src/app/features/claims/claim-list/claim-list.scss`

| Line | Violation |
|------|-----------|
| 24 | `color: #c0392b !important` (delete button) |
| 28 | `color: #767676` |

### `src/app/features/claims/claim-detail/claim-detail.scss`

| Line | Violation |
|------|-----------|
| 11 | `color: #767676` |
| 12 | `background: #f2f2f2` |
| 38 | `border-bottom: 1px solid #f2f2f2` |
| 47 | `color: #767676` |

### `src/app/app.scss`

| Line | Violation |
|------|-----------|
| 18 | `background-color: #f4f6f9` |

---

## Notes on violations

- The SCSS `$variable` pattern (e.g. `$blue-active: #006192`) is not caught by `audit:colors` because the grep targets literal hex in property values, not variable declarations. The lines above are manually confirmed — the variables are then used in property values which do trigger the grep.
- Status chip and priority dot colors (`#fdd25c`, `#e4003a`, `#d4edda`, etc.) have no equivalent ndbx.css tokens. Before fixing, confirm with designer whether these should become CSS variables in `styles.scss` or stay as exceptions.
- `rgba()` semi-transparent overlays (`rgba(0,0,0,0.05)`) also have no ndbx token equivalent. Treat as exception candidates.
- `fill="#003781"` in SVG attributes cannot use `var(--token)` directly — use `currentColor` and set color via CSS on the parent element.
