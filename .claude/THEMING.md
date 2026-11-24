# Theming: NDBX and A1 (Allianz One)

Read this before touching any colour, spacing, radius or font size, and whenever
"X doesn't change when I switch to A1".

Added 2026-10-21. Before this, `src/styles.scss` pinned ~190 NDBX values on plain
`:root`, which also overrode `allianz-one.css`, so the dev-banner "Switch to A1"
only changed a few colours.

---

## A1 is tokens AND component behaviour

Found 2026-10-22. Besides `allianz-one.css`, a switch called `ALLIANZ_ONE`
(`@allianz/ng-aquila/config/allianz-one/token`) makes dropdown, datefield,
timefield, message, icon, grid, pagination, popover, sidebar, tooltip and
file-uploader render differently (dropdown options get a radio indicator, A1
icons, 5 years per row in the date picker, ...). `app.config.ts` provides it as
`enabled = theme is 'a1'`, so the dev-banner toggle flips it live. Do not add
`NxAllianzOneModule` (hard-codes it on). A1 docs for each component are in
`node_modules/@allianz/ng-aquila/mcp/generated/components/*.md` (look for the
`docs-a1` / `docs-hide-a1` blocks); tokens are in `@allianz/a1-design-tokens`.

---

## Text roles (A1 hierarchy)

Added 2026-10-22. The A1 library maps `--text-01` to the interactive navy, so
headings, labels, values and links were all one colour. Project tokens
`--text-heading`, `--text-label` and `--text-01` (content) now carry three roles.
NDBX: all three resolve to the same grey as before (snapshot identical on 16
pages). A1 (`themes/_a1.scss`): heading = `on-surface-primary-resting` (navy),
content = `on-surface-primary-readonly` (slate #2F3C49), label =
`on-surface-secondary-readonly` (grey #68727B, 4.9:1 on white). Navy therefore
means "can be pressed, or is a heading". Use `--text-heading` for titles and
`--text-label` for field labels in new code; the shared mixins
(`_card-shell`, `_form-section`, `_modal-layout`, `_bottom-sheet-layout`) already do.
Titles written directly with `--text-01` in a component stay slate in A1.

Type scale and weights (2026-10-22): the library's A1 scale (paragraph 20/18/16/14)
is far bigger than what NDBX pins in this app (16/14/14/14), so switching to A1
made every screen look zoomed in. `themes/_a1.scss` pins the same sizes and line
heights as NDBX. `--font-weight-label` / `--font-weight-value` are 600 / 400 in
NDBX and 400 / 600 in A1 (light grey label, semibold slate value) so a label and
its value are told apart by weight as well as colour. Library components still
use their own A1 sizes. Used by the claim overview field mixins
(`_card-shell.scss`); other pages with their own label/value styles are not on it yet.

---

## Three themes (2026-11-24)

The DEV banner ⋮ menu offers NDBX, **A1 (with our adjustments)** and **A1 pure (library only)**.
`themes/_a1.scss` has two parts:

1. **Translation** (`[data-theme='a1']` and `[data-theme='a1-pure']`): our project tokens
   (spacing, radius, display sizes, status chips, tints, shadows, backgrounds, text-muted,
   error colour, hover) mapped onto A1 values, so our own screens use A1's scale. This is
   not a patch on A1, it is how our screens speak A1.
2. **Adjustments** (`[data-theme='a1']` only): where we override A1 itself: text colour
   roles (`--text-01` slate, `--text-heading` navy, `--text-label` grey), label/value
   weights 400/600, and the smaller type scale (`--paragraph-*`, formfield label/hint).

A1 pure = library A1 (`allianz-one.css` + `ALLIANZ_ONE`) + part 1, no part 2. Seen on
claim overview: type 16-18px, label, value and link all navy (links stop looking
clickable), bold labels. That is the library, not a bug. Proven 2026-11-24: splitting the
file left A1 (adjusted) and NDBX pixel-identical on dashboard, overview and sections.
Still applied in every theme: `_globals.scss` / `_overlays.scss` (icon font fix, tooltip,
modal motion, DEV banner dropdown) and each component's own SCSS.
`isA1()` in `theme.service.ts` is true for both A1 variants.
New A1 token mappings: put them in part 1 unless they change what A1 itself decides.

## A1 compact and the A1-native test page (2026-11-24)

- **Theme 'A1 compact (CHAMP target)':** `allianz-one-compact.css` + part 1 of `_a1.scss`, no adjustments. Source for the target: Confluence 3229947080 "Claim Handling NOM (CHAMP) - A1 defects" (defects like "Input text size following spacious density mode in a expert compact application", "Card with mixed A1 and NDBX UI styling", "Button text should not be in CAPS") and 2929349658 (NDBX to A1 migration guide: "A1 Light theme with Compact M (expert) density"). Design reference: Figma "Claims-CHAMP" (bs1kFq4KTXvOxDYD26SBpt), linked from Confluence 3234285794 (Case Manager A1 QA: widget title 22/28 semantic blue, one 1px semantic-blue container, 16px between data rows).
- **Density gap (fixed same day):** `allianz-one-compact.css` shrinks A1's own `--semantic-font-size-body-*` (16/14) but keeps the NDBX-named `--paragraph-*` at 20/18/16/14, which our screens use, so real pages looked identical in A1 pure and A1 compact. Part 1b of `_a1.scss` points `--paragraph-*` at the A1 body roles for `a1-compact` only. Claim overview values/labels went 18/16 to 16/14; NDBX, A1 (adjusted) and A1 pure pixel-identical before/after.
- **The official A1 setup is `provideA1Theme()`** (`@allianz/ngx-brand-kit/config`): formfield outline + float label always, error text, data-display size m, footer/small-stage/layout defaults, grid styles. This app only provides the `ALLIANZ_ONE` flag (so the theme can switch at runtime) plus `NxExpertModule`, which already gives the same formfield defaults.
- **`/mock/a1-native`:** the claim overview's General information and Financial summary rebuilt only from A1 building blocks (nxEyebrow + nxHeadline, nx-badge type, nx-data-display, nx-link, nx-card on nxSurface="emphasis", nx-toggle-button-group). Seen in A1 compact: links are underlined (the affordance A1 pure loses on our screens comes back with nx-link), fields fit on one line, buttons are not in caps. The 22px card title from the CHAMP spec is not on A1's scale at 1440px wide: nxHeadline `xl` renders 25px, `l` 20px. Check against the Figma.
- **What "A1 native" changes vs our screens:** our label/value pairs are hand-styled in 28 files; A1's are `nx-data-display`. None of data-display, eyebrow, text, surface, toggle-button, signal-button, tile, indicator or list was used anywhere before this page.

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

## Library upgrade (2026-11-03)

Angular 22.2 + ng-aquila / ngx-brand-kit 22.6 (from 21.8). 22.6 adds Allianz One
behaviour to button, tabs, badge, formfield, link, modal, header, context menu and
slider, and `allianz-one.css` grew ~33%. Visually the A1 screens barely changed:
those additions are behaviour (e.g. tabs never fold into an accordion in A1), not
new looks. The A1 look in meeting screenshots (capsule tabs with counts, grey page
canvas, icon-in-a-box KPI cards) is NOT in the library. Real values for those exist
as component tokens in `@allianz/a1-design-tokens` (`segmented-control-*`, `tag-*`,
`indicator-*`, `icon-contained-*`, `list-*`, `button-*`, `pagination-*`), and the
brand-kit ships official density variants `allianz-one-dense.css` /
`allianz-one-compact.css` (we load the standard one). Production is still on 21.10.
