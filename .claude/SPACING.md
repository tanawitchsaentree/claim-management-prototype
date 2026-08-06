# Dashboard Spacing & Icon Rules

**Read this before touching any spacing in dashboard components.**
Canonical source. If a value isn't here, derive from scale — never invent.

---

## Spacing Scale (4px base)

| Token name  | Value | Use for |
|-------------|-------|---------|
| `$sp-xs`    | 4px   | Icon-to-text gap within a single inline element |
| `$sp-sm`    | 8px   | Gap between sibling text/chip elements; tab item padding |
| `$sp-md`    | 12px  | Row/cell vertical padding; toggle-row bottom; widget footer padding |
| `$sp-base`  | 16px  | Default element padding; card side content; section gap in panel |
| `$sp-lg`    | 20px  | Widget card header top padding |
| `$sp-xl`    | 24px  | Widget card horizontal inset (sides); between widget cards |
| `$sp-2xl`   | 32px  | Page layout inset (`main-content` padding) — maps to `--layout-inset-base` |

Do **not** use values outside this scale in dashboard SCSS. If you think you need 18px, use 16 or 20.

---

## Widget Card Anatomy

```
┌─────────────────────────────────────────────────────┐
│  ←20px top→                                         │
│  ←24px→ [icon 32px] ←10px→ [Title 20px/600]  [link]│
│  ←14px bottom of header→                            │
│  ←24px→ [toggle if present]  ←12px bottom→         │
│  ─────────────────────── divider ───────────────────│  ← portfolio tabs sit here
│  [table th: 10px vertical / 24px horizontal]        │
│  ─── row divider ──────────────────────────────────│
│  [table td: 12px vertical / 24px horizontal]        │
│  ─── row divider ──────────────────────────────────│
│  ─────────────────────── footer divider ────────────│
│  ←12px top/bottom→ ←24px→ [footer link]             │
└─────────────────────────────────────────────────────┘
```

### Card padding rule
- Top of card → first content: **20px** (not 24 — keeps card compact)
- Left/right: **24px** everywhere inside a widget card
- Bottom of header before body content: **14px**
- Between cards: **24px** (`.widget-card { margin-bottom: 24px }`)

---

## Icon Rules

### Widget header icon (circular container)
- Container: **32×32px**, `border: 1px solid var(--ui-04)` (light grey, NOT `--text-01`)
- Icon inside: **`font-size: 16px`**
- This gives a 50% fill ratio — standard for icons in outlined circles

### Action card icon (right sidebar CTAs)
- Same: **32×32px**, `border: 1px solid var(--ui-04)`
- Icon inside: **`font-size: 16px`**

### Inline status icons (overdue triangle, heads-up severity)
- **`font-size: 12px`** — must not exceed text font-size of host element
- Use `display: flex; align-items: center; gap: $sp-xs` on the wrapper

### Sort icons in table headers
- **`font-size: 14px`** — slightly smaller than th text (16px)
- Color: `var(--text-muted)`

### Right panel section icons (calendar, news type icons)
- **`font-size: 14px`** — matches the 13px body text around them

### Icon COLOUR & OPACITY (read every time you place an icon — no exceptions)

This is the rule you must apply without being told. When you put an icon anywhere, the colour and opacity are part of the job — not a follow-up fix.

- **Colour comes from a token, never a literal.** Use `var(--interactive-primary)`, `var(--text-muted)`, `var(--warning)`, `var(--danger)`, `var(--claim-status-*-color)`, etc. Never a raw hex.
- **Match the icon to its context's accent.** If a tile/card/row has an accent colour (left border, status, severity), the icon uses the SAME token — not a generic blue. (KPI tiles: open→green, pending→amber, reserves→primary — each icon tinted to match its own accent, not all primary.)
- **Opacity floor for tinted accent / watermark icons: `0.4`.** The big tinted icon in a KPI tile (and similar accent icons) must stay ≈ 0.4 — verified on-screen. `0.18` was tried and is still too faint, especially for light hues like amber/`--warning` which need more presence than blue. Never go below 0.3 for a coloured accent icon on white. If it must be subtler, lighten the *colour token*, don't crush opacity.
- **Functional icons are full-opacity.** Any icon that conveys state or is interactive (status, severity, nav, action, sort) = `opacity: 1`. Opacity < 1 is ONLY for `:disabled` states (0.35 is the disabled convention) or explicit decorative watermarks (≥ 0.18).
- **Contrast:** an icon sitting on a coloured/tinted background must remain distinguishable. If unsure, full opacity + token colour.

**Self-check before finishing any icon work:** colour from token? matches context accent? not a faded watermark below 0.18? functional icon at full opacity? If any answer is no, fix it now — do not wait to be told.

---

## Table Rules

| Element | Padding | Notes |
|---------|---------|-------|
| `th`    | `10px 24px` | Slightly more than before — header deserves same weight as data |
| `td`    | `12px 24px` | Vertical breathing room, consistent density |
| Row hover | `background: var(--ui-02)` | Already correct |
| Row divider | `border-bottom: 1px solid var(--ui-03)` | Subtle, already correct |

Table column padding is always **24px** horizontal — never less, never more, for alignment consistency with card header sides.

---

## Portfolio / Scope Tabs

- Container padding: `0 24px` — aligns tab text with table column text
- Tab item: `padding: 8px 16px 8px 0` (right-padded, not right-bordered)
- Active indicator: 3px bottom border `var(--interactive-text)`
- Spacer between tabs row and table: **`height: 8px`** — just enough visual break, not dead space

---

## Widget Toggle Row

- `padding: 0 24px 12px` — left/right match card inset, bottom 12px ($sp-md) before next element

---

## Right Panel Cards

- Container: `gap: 24px` between cards
- Card padding: `16px` all sides
- Card title: `font-size: 16px / font-weight: 600` (not 20px — panel is narrower)

Exception: Stats card `.stats-number` stays at 40px (intentional large display number).

---

## KPI Row (KCM)

- Tile padding: `16px 20px` — slightly narrower horizontal than widget cards
- Gap between tiles: `16px`
- Value font: `32px / 700`
- Label font: `13px`, `var(--text-muted)`
- Left accent border: `4px solid [role-color]`

---

## Scope Tabs (KCM group selector)

- Container: `padding: 0 24px 12px` — aligns with card inset
- Pill: `padding: 4px 12px`, `border-radius: 12px`
- Active: `background: var(--interactive-primary); color: #fff`

---

## Inline Icon + Text Rule (MANDATORY)

**Every time an icon sits beside text in a table cell, list item, or inline label — wrap them.**

```html
<!-- ✅ CORRECT -->
<span class="icon-text">
  <span>TSK-001</span>
  <nx-icon name="launch"></nx-icon>
</span>
```
```scss
.icon-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
nx-icon { font-size: 14px; } // or omit size= entirely to inherit
```

```html
<!-- ❌ WRONG — sibling elements without flex wrapper -->
<span>TSK-001</span>
<nx-icon name="launch" size="s"></nx-icon>
```

Without the wrapper, `nx-icon` sits on the text baseline. `size="s"` = 24px which is larger than 14px td text, making it worse.

### nx-icon size values (memorise these)

| Attribute | Resolves to | Use for |
|---|---|---|
| `size="s"` | **24px** | Standalone nav/sidebar icons only — never inline with body text |
| `size="m"` | **48px** | Display icons, illustration-scale |
| no `size` attribute | **inherits** parent `font-size` | ✅ Inline with text — always use this |
| `size="auto"` | `font-size: inherit` | Same as no attribute, but explicit |

**Rule:** If the icon is sitting beside text at reading scale (12–16px), never use `size="s"` or `size="m"`. Either omit size entirely or set `font-size` on the icon via SCSS.

---

## What NOT to do

- Never use `margin-bottom` on `.widget-header` — use `padding-bottom` instead
- Never set `portfolio-tabs-spacer` height > 8px
- Never use `border: 1px solid var(--text-01)` on icon containers (too dark)
- Never set icon `font-size` larger than the text it sits beside
- Never use raw px values outside this scale (no 18px, no 22px, no 28px)
- Never use `rgba()` in SCSS — use CSS custom properties (`var(--warning-dimmed)`)
- Never put `<nx-icon>` beside text without a `display: inline-flex; align-items: center` wrapper
