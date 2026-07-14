# NDBX Context

Foundation doc — stack, tokens, traps, forbidden patterns, NDBX gotchas. Read before writing any code.

Companion docs:
- `BLESSED.md` — verified reference patterns to copy from
- `docs/NDBX_RECIPES.md` — verified HTML snippets for every NDBX component
- `.claude/skills/` — targeted skill files for specific traps

---

## Stack

| Layer | Package | Version |
|-------|---------|---------|
| Framework | `@angular/core` | ^21.x |
| Component library | `@allianz/ng-aquila` | ^21.x |
| Design tokens / fonts | `@allianz/ngx-brand-kit` | ^21.x |
| Reactive extensions | `rxjs` | ~7.8.0 |
| Language | `typescript` | ~5.x |

**CSS loaded in angular.json (order matters):**
1. `node_modules/@allianz/ngx-brand-kit/css/allianz-base.css`
2. `node_modules/@allianz/ngx-brand-kit/css/themes/ndbx.css`
3. `node_modules/@allianz/ngx-brand-kit/css/ndbx-icons.css`
4. `src/styles.scss` — project-level overrides only

**`expert.css` is NOT loaded.**
- `appearance="outline"` on `nx-formfield` renders broken — never use it
- All forms use default underline appearance (no `appearance=` attribute)

---

## Token Traps

### `--text-02` is WHITE

| Token | Resolved value | Use |
|-------|---------------|-----|
| `--text-01` | `#414141` | Body text, labels, table cells — always safe |
| `--text-02` | `#ffffff` | ⚠️ WHITE — only on dark/brand backgrounds |
| `--text-muted` | `#767676` | Secondary/hint text on white backgrounds |

**NEVER use `--text-02` on white backgrounds.**

### NxExpertModule cascade override

`NxExpertModule` injects `expert.css` at runtime AFTER angular.json styles. It overrides `--interactive-primary` and `--text-02`. Re-assert both in `styles.scss :root`. Do not remove those overrides.

`NxExpertModule` also injects `floatLabel: 'always'` globally — do not add `floatLabel="always"` explicitly on formfields.

### `nx-radio` requires `labelSize="small"`

NDBX defaults radio label to `1rem`. Projects override to `14px` in `styles.scss`, but the override only fires when `labelSize="small"` is explicitly set. Every `<nx-radio>` must have it.

### Don't read FormControl in `computed()`

FormControl state is RxJS, not a signal. `computed()` evaluates once and never re-runs.

Bridge with `toSignal`:
```ts
private readonly xStatus = toSignal(
  this.form.get('x')!.statusChanges,
  { initialValue: this.form.get('x')!.status }
);
readonly xInvalid = computed(() => this.xStatus() !== 'VALID');
```

---

## NDBX Component Protocol — MANDATORY

Before writing any UI element:

### Step 1 — Check NDBX first
```bash
ls node_modules/@allianz/ng-aquila/
find node_modules/@allianz/ng-aquila -type d -name "*<name>*"
```

### Step 2 — Import in standalone component
```ts
@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NxFormfieldModule, NxInputModule],
})
```

### Step 3 — Use NDBX selector, NOT native HTML

See `docs/NDBX_RECIPES.md` for verified snippets.

---

## NDBX Component Reference

| What you need | Module | Selector |
|---------------|--------|----------|
| Text input | `NxFormfieldModule` + `NxInputModule` | `<input nxInput>` |
| Dropdown (single) | `NxDropdownModule` | `<nx-dropdown>` |
| Multi-select | `NxMultiSelectComponent` (from `dropdown`) | `<nx-multi-select>` |
| Checkbox | `NxCheckboxModule` | `<nx-checkbox>` |
| Radio | `NxRadioModule` | `<nx-radio>` |
| Date picker | `NxDatefieldModule` | `<input nxDatefield nxInput>` + `<nx-datepicker>` |
| Time picker | `NxTimefieldModule` | `<nx-timefield>` |
| Toggle | `NxSwitcherModule` | `<nx-switcher>` |
| Textarea | `NxFormfieldModule` + `NxInputModule` | `<textarea nxInput>` |
| Button | `NxButtonModule` | `<button nxButton="primary">` |
| Icon | `NxIconModule` | `<nx-icon name="...">` |
| Card | `NxCardModule` | `<nx-card>` |
| Tabs | `NxTabsModule` | `<nx-tab-group>` |
| Tooltip | `NxTooltipModule` | `[nxTooltip]="text"` |
| Modal | `NxModalModule` | `NxModalService.open()` |
| Message/Banner | `NxMessageModule` | `<nx-message>` |
| Pagination | `NxPaginationModule` | `<nx-pagination>` |
| Spinner | `NxSpinnerModule` | `<nx-spinner>` |
| Context menu | `NxContextMenuModule` | `<nx-context-menu>` |
| Breadcrumb | `NxBreadcrumbModule` | `<ol nxBreadcrumb>` |
| Grid | `NxGridModule` | `[nxLayout]`, `[nxRow]`, `[nxCol]` |

---

## Known NDBX Gotchas

- **`NxMultiSelectComponent`** — no `NG_VALUE_ACCESSOR`. Use `formControlName`. Do NOT use `[value]` input.
- **`NxDatefieldModule`** — needs `NxIsoDateModule` in `app.config.ts` + `dayjs`. Link picker with `[datepicker]="ref"`, toggle with `[for]="ref"`. Both `nxDatefield` AND `nxInput` required on the input.
- **`<nx-timefield>`** — self-contained, has its own internal `<nx-formfield>`. **Never wrap in `<nx-formfield>`** — triggers `"Formfield must contain a NxFormfieldControl"` and breaks all formfields on the page.
- **`nx-formfield` appearance** — never `appearance="outline"`.
- **`nx-formfield` reserves space** — see `.claude/skills/nx-formfield-spacing-trap/SKILL.md`.
- **`nx-error` needs `nxFormfieldError`** — without it, error shows unconditionally regardless of touched/invalid state.
- **`nx-radio-group` gap** — zero default gap. For stacked radios: `display:flex; flex-direction:column; gap:8px` on the group.
- **`nx-formfield` width** — does not auto-fill parent. Add `nx-formfield { width: 100% }` on any container that stacks fields.
- **`[nxLayout]` writes inline padding** — `padding-top` on the same element is overridden. Wrap with an outer `*-wrap` div that owns vertical padding; let `nxLayout` own horizontal.

---

## Project-Level Tokens

Define your project's custom tokens in `styles.scss` under `:root`. Never hardcode hex/rgba in component `.scss` files.

Common categories to define:
- Status chip colors (background + text per status)
- Priority/severity colors
- Hover overlay rgba values
- Page chrome gaps

To find available NDBX base tokens:
```bash
grep -- '--ui-0' node_modules/@allianz/ngx-brand-kit/css/themes/ndbx.css
grep -- '--interactive' node_modules/@allianz/ngx-brand-kit/css/themes/ndbx.css
```

---

## Component Rules

- Standalone components only — no NgModule declarations
- Reactive Forms only — no `ngModel`
- File size limits: `.ts` ≤ 300 lines, `.html` ≤ 200 lines, `.scss` ≤ 250 lines

---

## Forbidden Patterns

| Pattern | Why |
|---------|-----|
| `subscribe()` in component | Use `async` pipe |
| `: any` | Define interface in `core/models/` |
| Inline template > 30 lines | Extract to `.html` |
| Inline styles | Extract to `.scss` |
| Cross-feature imports | Features must be independently deployable |
| Native `<select>`, `<input type="date">` | Use NDBX equivalents |
| `nx-formfield appearance="outline"` | Renders broken without expert.css |
| Hardcoded hex/rgb in component scss | Use tokens |
| `font-size` below 14px on readable text | WCAG 2.1 AA minimum |

---

## Accessibility

- Minimum readable text size: **14px**
- All icon-only buttons need `aria-label`
- Scroll containers need `tabindex="0"` for keyboard access
- Modals: trap focus while open, restore on close (NDBX `NxDialogService` handles this)
- Dynamic content (toasts, banners): pair with `LiveAnnouncer.announce()` from `@angular/cdk/a11y`

---

## When Uncertain

**Ask. Don't guess.**

- Token names — grep `ndbx.css`
- Design intent — ask for Figma reference
- Data shapes — check `core/models/`
