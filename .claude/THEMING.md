# Theming: NDBX and A1 (Allianz One)

Read this before touching any colour, spacing, radius or font size, and whenever
"X doesn't change when I switch to A1".

Added 2026-10-21. Before this, `src/styles.scss` pinned ~190 NDBX values on plain
`:root`, which also overrode `allianz-one.css`, so the dev-banner "Switch to A1"
only changed a few colours.

---

## How a theme switch works

1. The dev banner calls `ThemeService.toggle()` (`src/app/core/services/theme.service.ts`).
2. `sync()` enables exactly one library stylesheet (`<link id="theme-link-ndbx">` or
   `theme-link-a1` in `src/index.html`, copied from `@allianz/ngx-brand-kit/css/themes`)
   and stamps `<html data-theme="ndbx|a1">`.
3. Our own layers are scoped to that attribute, so library + overrides always switch together.

A1 here = `allianz-one.css`, standard density (not `-dense` / `-compact`).
`NxExpertModule` stays on in both themes: it only sets component defaults
(outline formfields, expert tabs), and `allianz-one.css` styles those too.

## Who owns which value

| File | Owns | Rule |
|---|---|---|
| `allianz-one.css` / `ndbx.css` (library) | Every NDBX-named token (`--text-01`, `--ui-04`, `--button-*`, `--paragraph-*`, ...) | Never edit. A1 defines them all from its semantic palette. |
| `src/styles/themes/_ndbx.scss` | Our NDBX density/colour pins over `ndbx.css` (compressed type scale, 38px buttons, white inputs, ...) | NDBX-named tokens only. Scoped `:root:where([data-theme='ndbx'])` so specificity equals plain `:root`. |
| `src/styles/_tokens.scss` | Project tokens: `--space-*`, `--radius-*`, `--display-*`, `--text-muted`, overlays, tints, z-index | Default (NDBX) values. Theme-neutral selector `:root`. |
| `src/styles/_status-tokens.scss` | Status chip / badge colour pairs | Same as above. |
| `src/styles/themes/_a1.scss` | A1 mapping of the project tokens | Right-hand side is always an A1 `--semantic-*` token, never a raw value. Nothing NDBX-named goes here. |
| `src/styles/_globals.scss`, `_overlays.scss` | Global element rules, CDK overlay / popover / side-sheet surfaces | Tokens only, like components. |
| Components | Use tokens | No raw colour, no px spacing/radius/font-size (see audit below). |

Project tokens with no A1 role are deliberately NOT mapped and keep their
`_tokens.scss` value in A1: chart fills, priority dots, avatar, dev-banner
colours, navbar scrims, tree indent, z-index, fixed sizes.

## The scales

**Spacing** (`--space-*`): xs 4, sm 8, md 12, base 16, lg 20, xl 24, 2xl 32,
3xl 40, 4xl 48, 5xl 64. A1 maps each to `--semantic-gap-all-static-*`
(same px; A1 has no 20 so `lg` becomes 24).
`--space-ndbx-5/6/7/10/14/18/28` are hand-tuned NDBX in-between values: exact in
NDBX, snapped to the nearest A1 step in A1. Prefer a scale step in new code.
Under 4px is an optical nudge and allowed as a raw px.

**Radius** (`--radius-*`): xs 2, s 4, m 8, chip 10, pill 999, plus
`--radius-ndbx-3/6/12`. A1 copies the library's own shift: 4px becomes 8px
(`--semantic-border-radius-m`), chips/pills become fully round.

**Font size**: paragraph/heading tokens from the library; `--display-s/m/l`
(24/28/32) for page titles and KPI figures, mapped to A1 headlines.

**Colour**: library tokens first (`--text-01`, `--ui-0x`, `--danger`,
`--success`, `--color-subtle-<hue>` + `--color-on-subtle-<hue>` for tints),
then project tokens. `--negative` is WHITE in NDBX (inverse text), never red.
Use `--danger` for red text.

## Debugging "X doesn't follow A1"

1. `npm run audit:theme` lists every raw colour, px spacing/radius/font-size,
   dead `var(--x, #fallback)` and token defined nowhere, with file:line.
   `--fix` applies the rewrites that leave NDBX pixel-identical.
2. DevTools on the element, Computed, click the property: the winning rule shows
   which file set it. If it's `_ndbx.scss` while `data-theme="a1"`, the attribute
   didn't switch (ThemeService). If it's a component file with a literal, tokenise it.
3. If the token resolves but A1 looks wrong, the A1 mapping is in `themes/_a1.scss`
   (project token) or in `allianz-one.css` (library token, not ours to change).

Exemptions: put `theme-exempt: <reason>` on the line or the line above. Use it
only for values that are not theme decisions (Figma-fixed widths, glyph sizes).

## Proving a styling refactor changed nothing

```
npm start
npm run snapshot:theme -- capture .theme-snapshots/before ndbx
# ...change...
npm run snapshot:theme -- capture .theme-snapshots/after ndbx
npm run snapshot:theme -- compare .theme-snapshots/before .theme-snapshots/after
```

16 pages, full-page PNG plus computed styles of every visible element; compare
names the element and property that changed. `.theme-snapshots/` is gitignored.

## Known gaps (2026-10-21)

- No A1 Figma exists for this product, so A1 = library standard, not a designed A1.
- Button sizes are component inputs in templates (`size="small"`), not tokens: A1
  inputs are 48px tall, most of our buttons stay 32px.
- `font-weight` literals and fixed `width`/`height` px are not tokenised (layout
  decisions, not theme values).
- `--formfield-align-top/bottom` (22/23px) line buttons up with an nx-formfield
  input. Measured aligned in both themes; re-measure if formfield geometry changes.
