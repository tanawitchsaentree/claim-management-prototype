# Project Context

This is the foundation doc — stack, tokens, traps, folder layout, forbidden patterns, NDBX gotchas. Read before any code.

Companion docs:
- `PRE_BUILD.md` — checklist + workflow for building anything
- `POST_BUILD.md` — verification before "done"
- `BLESSED.md` — verified reference implementations to copy from
- `RUNTIME_OVERRIDES.md` — directives that write inline styles at runtime (CSS layout traps)
- `docs/NDBX_RECIPES.md` — verified HTML recipe book for every NDBX component

---

## Stack

| Layer | Package | Version |
|-------|---------|---------|
| Framework | `@angular/core` | ^21.2.0 |
| Component library | `@allianz/ng-aquila` | ^21.8.0 |
| Design tokens / fonts | `@allianz/ngx-brand-kit` | ^21.8.0 |
| Reactive extensions | `rxjs` | ~7.8.0 |
| Language | `typescript` | ~5.9.2 |

**CSS loaded in angular.json (in this order — order matters):**
1. `node_modules/@allianz/ngx-brand-kit/css/allianz-base.css` — Allianz Neo font + base resets
2. `node_modules/@allianz/ngx-brand-kit/css/themes/ndbx.css` — NDBX light expert theme tokens
3. `node_modules/@allianz/ngx-brand-kit/css/ndbx-icons.css` — Allianz icon font glyphs
4. `src/styles.scss` — project-level overrides only

**`expert.css` is NOT loaded.** This means:
- `appearance="outline"` on `nx-formfield` renders as broken unstyled boxes — **never use it**
- All forms use the default underline appearance (no `appearance=` attribute)

---

## Token Traps (read this — every trap below has burned a session)

### `--text-02` is WHITE

| Token | Resolved value | Use |
|-------|---------------|-----|
| `--text-01` | `#414141` | Body text, labels, table cells — **always safe** |
| `--text-02` | `#ffffff` | ⚠️ WHITE — only on dark/brand backgrounds |
| `--text-muted` | `#767676` | Secondary/hint text on white backgrounds |

**NEVER use `--text-02` on white or light backgrounds — it is white and will be invisible.**

### NxExpertModule cascade override

`NxExpertModule` (in `app.config.ts`) injects `expert.css` at runtime AFTER the angular.json styles. It overrides:
- `--interactive-primary`: `#007ab3` → `#27abd6` (dark theme blue)
- `--text-02`: `#ffffff` → `#0f2a3d` (near-black — breaks primary button white text)

Both are re-asserted in `styles.scss` `:root`. **Do not remove these overrides.**

`NxExpertModule` also injects `FORMFIELD_DEFAULT_OPTIONS` → `{ appearance: 'outline', nxFloatLabel: 'always' }` via DI. `floatLabel: 'always'` is already global — **do not add `floatLabel="always"` explicitly.**

### `nx-radio` `labelSize="small"` is mandatory

NDBX defaults `--small-label-font-size` to `1rem` (16px). This project overrides it to `14px` in `styles.scss`, but **the override only fires when `labelSize="small"` is explicitly set**.

- **Every `<nx-radio>` MUST have `labelSize="small"`** — no exceptions
- `audit:radio-size` enforces this — fails CI if any `<nx-radio>` is missing `labelSize`
- For `<nx-checkbox>`: `labelSize` is not supported; the label inherits body font-size and is correct by default

### Don't read FormControl in `computed()`

FormControl state is RxJS, not a signal — Angular's signal graph cannot track it. `computed()` will evaluate once at init and never re-run.

✅ Bridge with `toSignal`:
```ts
private readonly xStatus = toSignal(
  this.form.get('x')!.statusChanges,
  { initialValue: this.form.get('x')!.status }
);
readonly xInvalid = computed(() => this.xStatus() !== 'VALID');
```

---

## Design System Hard Rules

### NEVER hardcode hex / rgb / px in component scss

```scss
// ❌ FORBIDDEN
color: #007ab3;
padding: 16px;
background: rgb(0, 122, 179);

// ✅ CORRECT
color: var(--interactive-primary);
padding: var(--button-medium-padding);
```

If no token exists → ask the user. Do not invent token names.

```bash
grep -- '--your-token-name' node_modules/@allianz/ngx-brand-kit/css/themes/ndbx.css
```

### NEVER override NDBX tokens at component scope without justification

- `styles.scss` is the **only** place project-level token overrides are allowed
- `.page-shell` style overrides are forbidden — they cascade unpredictably into child components
- Component-scoped `--token` overrides require an explicit comment stating why

---

## NDBX Component Protocol — MANDATORY

Before writing ANY UI element, follow this protocol:

### Step 1: Check NDBX first

```bash
ls node_modules/@allianz/ng-aquila/                                # all modules
find node_modules/@allianz/ng-aquila -type d -name "*<name>*"      # find a specific component
cat node_modules/@allianz/ng-aquila/<component>/index.d.ts         # public API
```

### Step 2: Document the finding (in your response, before any code)

- Component needed: e.g. "multi-select dropdown"
- NDBX equivalent: e.g. "NxMultiSelectComponent from NxDropdownModule"
- Module to import: exact import path
- Selector to use: e.g. `<nx-multi-select>`

### Step 3: Import in component (standalone)

```ts
@Component({
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxFormfieldModule,   // always required for inputs
    NxInputModule,       // for nxInput directive
    NxDropdownModule,    // for nx-dropdown and nx-multi-select
    // ...
  ],
})
```

### Step 4: Use NDBX selector, NOT native HTML

❌ WRONG:
```html
<select><option>...</option></select>
<input type="text" />
<input type="date" />
<nx-formfield appearance="outline" label="...">...</nx-formfield>
```

✅ CORRECT — see `docs/NDBX_RECIPES.md` for verified snippets per component.

---

## NDBX Component Reference (verified in this project)

| What you need | NDBX module | Import path | Selector |
|---------------|-------------|-------------|----------|
| Text input | `NxFormfieldModule` + `NxInputModule` | `formfield` / `input` | `<input nxInput>` |
| Dropdown (single) | `NxDropdownModule` | `dropdown` | `<nx-dropdown>` |
| Multi-select | `NxMultiSelectComponent` | `dropdown` | `<nx-multi-select>` |
| Checkbox | `NxCheckboxModule` | `checkbox` | `<nx-checkbox>` |
| Radio button | `NxRadioModule` | `radio-button` | `<nx-radio>` |
| Date picker | `NxDatefieldModule` | `datefield` | `<input nxDatefield>` + `<nx-datepicker>` |
| Time picker | `NxTimefieldModule` | `timefield` | `<nx-timefield>` |
| Toggle/Switcher | `NxSwitcherModule` | `switcher` | `<nx-switcher>` |
| Textarea | `NxFormfieldModule` + `NxInputModule` | `formfield` / `input` | `<textarea nxInput>` |
| Button | `NxButtonModule` | `button` | `<button nxButton="primary">` |
| Icon | `NxIconModule` | `icon` | `<nx-icon name="...">` |
| Card | `NxCardModule` | `card` | `<nx-card>` |
| Tabs | `NxTabsModule` | `tabs` | `<nx-tab-group>` |
| Tooltip | `NxTooltipModule` | `tooltip` | `[nxTooltip]="text"` |
| Modal | `NxModalModule` | `modal` | `NxModalService.open()` |
| Toast/Alert | `NxMessageModule` | `message` | `<nx-message>` |
| Pagination | `NxPaginationModule` | `pagination` | `<nx-pagination>` |
| Spinner | `NxSpinnerModule` | `spinner` | `<nx-spinner>` |
| Context menu | `NxContextMenuModule` | `context-menu` | `<nx-context-menu>` |
| Toolbar | `NxToolbarModule` | `toolbar` | `<nx-toolbar>` |
| Breadcrumb | `NxBreadcrumbModule` | `breadcrumb` | `<ol nxBreadcrumb>` |
| Avatar | `NxAvatarModule` | `avatar` | `[nxAvatar]` |
| Grid | `NxGridModule` | `grid` | `[nxLayout]`, `[nxRow]`, `[nxCol]` |

If a component is NOT in this list → run Step 1 to verify before assuming it doesn't exist.

---

## Known NDBX gotchas

- **`NxMultiSelectComponent`** — does NOT use `NG_VALUE_ACCESSOR`. Uses `NgControl` injection. `formControlName` works correctly. Do NOT use `[value]` input binding.
- **`NxDatefieldModule`** — requires `NxIsoDateModule` (already in `app.config.ts`) and `dayjs`. Input directive selector is `input[nxDatefield]`. Link to datepicker with `[datepicker]="ref"` (NOT `[nxDatefield]`). Toggle links with `[for]="ref"`. Both `nxDatefield` AND `nxInput` directives required on the input.
- **`NxTimefieldModule` / `<nx-timefield>`** — self-contained. Contains its own `<nx-formfield>` and `<nx-timefield-control>` (the `NxFormfieldControl` implementor) internally. **Never wrap `<nx-timefield>` in an outer `<nx-formfield>`** — causes `"Formfield must contain a NxFormfieldControl"`. Use `<nx-timefield label="…">` directly with `formControlName`.
- **`NxDropdownModule`** — single-select only via `<nx-dropdown>`. Multi-select is a separate component `<nx-multi-select>` (same import path).
- **`nx-formfield` appearance** — never use `appearance="outline"` (renders as broken boxes). Use default (no `appearance` attribute). `audit:appearance` catches this.
- **`nx-formfield` reserves space** — see `RUNTIME_OVERRIDES.md` (formfield bottom 20px reserve, stacked formfield 32px reserve).
- **`nx-error` inside `nx-formfield` MUST have `nxFormfieldError`** — without it, the error text renders unconditionally regardless of touched/invalid state. Every `<nx-error>` direct child of `<nx-formfield>` must be `<nx-error nxFormfieldError>`. `audit:formfield-error` (in `audit:all`) catches this.
- **`nx-radio-group` vertical spacing** — zero default gap between radio items. For any vertical (stacked) radio list, the wrapping container or the `nx-radio-group` itself MUST have `display: flex; flex-direction: column; gap: 8px` (4px for tighter contexts).
- **`nx-formfield` width** — does NOT auto-fill its parent. Without `nx-formfield { width: 100% }` on the container (e.g. `.my-form nx-formfield { width: 100% }`), fields shrink to intrinsic content width. Required in every modal, card, or flex/grid container that stacks form fields.
- **`NxIsoDateModule`** — already in `app.config.ts`; do not re-import in components.

---

## Component Rules

- **Standalone components only** — no NgModule declarations
- **Reactive Forms only** — no template-driven forms (`ngModel`)
- **Loading / error / data** → ViewModel pattern with `vm$ | async` pipe
- **File size limits:**
  - `.ts` ≤ 300 lines
  - `.html` ≤ 200 lines
  - `.scss` ≤ 250 lines
  - If a component exceeds limits → split before adding more code

---

## Folder Structure

```
src/app/
├── core/           ← models, mock layer, services, guards — used app-wide
│   ├── models/     ← all TypeScript interfaces/types (no any)
│   ├── services/   ← real + mock service implementations
│   ├── mock/       ← mock data layer (see core/mock/README-mock.md)
│   └── guards/     ← route guards
├── shared/         ← reusable UI components, directives, pipes
│   ├── components/ ← status-chip, priority-dot, amount-display, etc.
│   ├── directives/
│   └── pipes/
├── features/       ← one folder per page/feature
│   ├── dashboard/
│   ├── sections/
│   ├── claims/
│   ├── fnol/
│   ├── administration/
│   └── layout/     ← shell, navbar, sidebar (layout scaffolding)
└── layouts/        ← top-level layout wrappers (future use)
```

**Features must NOT import from other features.**

```ts
// ❌ FORBIDDEN
import { SomeComponent } from '../dashboard/some.component';

// ✅ CORRECT — extract to shared/ first
import { SomeComponent } from '../../shared/components/some.component';
```

---

## Data Layer

- All data comes from `src/app/core/services/` or `src/app/core/mock/services/`
- Services return `Observable<T>` — never raw synchronous values
- Components **NEVER** call `HttpClient` directly
- Components **NEVER** hardcode data arrays — pull from service even for mock data
- Mock layer details: `src/app/core/mock/README-mock.md`

---

## Forbidden Patterns

| Pattern | Why banned |
|---------|------------|
| `subscribe()` in component class | Use `async` pipe — subscriptions leak |
| `: any` or `<any>` | Define interface in `core/models/` |
| Inline template over 30 lines | Extract to `.html` file |
| Inline styles | Extract to `.scss` file |
| `console.log` in committed code | Except in `mock-base.service.ts` |
| `TODO` / `FIXME` without owner + ticket | Dead comments rot |
| Cross-feature imports | Features must be independently deployable |
| Hardcoded data arrays in components | Use service layer |
| Native `<select>`, `<input type="date">`, raw `<input>` outside formfield | Use NDBX equivalents |
| `nx-formfield appearance="outline"` | expert.css not loaded — outline renders broken |
| Skipping NDBX verification step | Custom HTML breaks design system |
| `font-size` below 14px on readable text | Fails WCAG 2.1 AA — minimum 14px (`--paragraph-04-font-size`). Icons exempt. |

---

## Accessibility — Typography

WCAG 2.1 AA. All readable text must meet the minimum font-size rule below. Audited 2026-05-08.

### Minimum font sizes

| Use case | Minimum | Token |
|---|---|---|
| Body text, labels, table cells, form hints, form field labels/hints | **14px** | `var(--paragraph-03-font-size)` or `var(--paragraph-04-font-size)` |
| Headings, section titles | 16px+ | `var(--paragraph-03-font-size)` or above |
| Decorative icons, checkmark glyphs inside icon containers | no minimum | n/a — not readable text |

### Resolved token values in this project

`styles.scss` overrides the NDBX paragraph scale. Use these actual px values when reasoning about sizes:

| Token | Resolved px | Use |
|---|---|---|
| `--paragraph-01-font-size` | **16px** | Body copy, input value text |
| `--paragraph-02-font-size` | **14px** | Secondary text |
| `--paragraph-03-font-size` | **14px** | Labels, hints, captions (raised from NDBX 12px) |
| `--paragraph-04-font-size` | **14px** | Same floor — use either 03 or 04 |
| `--paragraph-05-font-size` | **12px** | Do not use for readable text |
| `--formfield-label-font-size` | **14px** | Form field floating labels (overridden in styles.scss) |
| `--formfield-hint-font-size` | **14px** | Form field hint/error text (overridden in styles.scss) |

NDBX defaults for `--paragraph-01/02/03` are 20/18/16px — our project compresses the scale intentionally for UI density. Floor is 14px.

### Hard rules

- **Never use font-size below 14px for any readable text** (labels, captions, table data, status text, helper text, badge text, chip text)
- `--paragraph-05-font-size` (12px) and `--paragraph-04-font-size` (14px) are the only tokens below 16px — use `paragraph-04` as the absolute floor
- **Hardcoded px values below 14px are forbidden for text** — `11px`, `12px`, `13px` all fail
- **Exception:** `font-size` on icon-only elements (e.g., `.dot-check` stepper checkmark glyph, `nx-icon` decorative) is exempt

### Readable vs not readable

- **Readable** = labels, captions, table headers, table rows, status chips, badges, helper/hint text, error messages, breadcrumbs, sub-rows
- **NOT readable** = decorative icon glyphs sized via `font-size`

### Known violations (pre-existing — fix before shipping)

| File | Line | Current | Fix |
|---|---|---|---|
| `fnol/steps/step-1-search/step-1-search.component.scss` | 235 | 11px `.broker-label` | → `var(--paragraph-04-font-size)` |
| `fnol/steps/step-1-search/step-1-search.component.scss` | 271 | 11px `.skeleton-linked` | → `var(--paragraph-04-font-size)` |
| `fnol/steps/step-1-search/step-1-search.component.scss` | 429 | 12px | → `var(--paragraph-04-font-size)` |
| `fnol/steps/step-1-search/step-1-search.component.scss` | 231 | 13px `.text-mono` | → `var(--paragraph-04-font-size)` |
| `fnol/steps/step-1-search/step-1-search.component.scss` | 261 | 13px `.skeleton-status` | → `var(--paragraph-04-font-size)` |
| `fnol/steps/step-1-search/step-1-search.component.scss` | 318 | 13px skeleton table | → `var(--paragraph-04-font-size)` |
| `claims/claim-detail/claim-detail.scss` | 10 | 13px `.claim-number` | → `var(--paragraph-04-font-size)` |
| `claims/claim-detail/claim-detail.scss` | 45 | 12px `.info-label` | → `var(--paragraph-04-font-size)` |
| `shared/components/status-chip/status-chip.component.scss` | 6 | 12px chip text | → `var(--paragraph-04-font-size)` |
| `dashboard/dashboard.scss` | 384 | 13px table `th` | → `var(--paragraph-04-font-size)` |
| `dashboard/dashboard.scss` | 547 | 13px `.stats-bar-value` | → `var(--paragraph-04-font-size)` |

`fnol-stepper/fnol-stepper.component.scss:61` — 10px `.dot-check` is **exempt** (icon glyph, not readable text).

---

## Accessibility — Beyond Typography

NDBX components are WCAG 2 Level AA compliant out of the box. Using them does **not** make the application accessible by default — the rules below cover what we add on top.

### Supported screen reader matrix

| Screen reader | Browser |
|---|---|
| NVDA | Firefox |
| JAWS 2023 | Edge / Chrome |
| VoiceOver (macOS / iOS) | Safari |

### `aria-label` is mandatory for icon-only / ambiguous controls

```html
<!-- ❌ WRONG: kebab with no label -->
<button nxIconButton><nx-icon name="ellipsis-v"></nx-icon></button>

<!-- ✅ CORRECT -->
<button nxIconButton aria-label="Row actions"><nx-icon name="ellipsis-v"></nx-icon></button>

<!-- ✅ Variable binding -->
<nx-icon [attr.aria-label]="contextLabel"></nx-icon>
```

Required wherever the visible text alone is ambiguous: kebab buttons, close ✕, sort toggles, expand/collapse triggers, status icons.

### LiveAnnouncer for dynamic content (toasts, banners, updates)

Toast banners visible only in DOM are read by VoiceOver but **not** by NVDA/JAWS reliably. Pair the visual banner with `LiveAnnouncer` from `@angular/cdk/a11y`:

```ts
import { LiveAnnouncer } from '@angular/cdk/a11y';

private readonly live = inject(LiveAnnouncer);

private flashToast(msg: string): void {
  this.toast.set(msg);
  this.live.announce(msg, 'polite');     // 'assertive' for errors
  setTimeout(() => this.toast.set(null), TOAST_DURATION_MS);
}
```

**Verified in:** `mass-events.component.ts` — toast on edit/create/delete

### Scroll containers must be keyboard-focusable

Modal bodies, long lists, table viewports — any element with `overflow-y: auto`. Add `tabindex="0"` so keyboard users (Edge/Chrome) can scroll without a mouse:

```html
<div class="modal-body" tabindex="0" overflow-y: auto>…</div>
```

Firefox already focuses scroll containers natively; this fixes Edge/Chrome.

### High-contrast SVG (Windows MS Edge)

Custom SVGs need explicit color in high-contrast mode. NDBX components handle this internally; **anything we author** must include:

```scss
@media screen and (-ms-high-contrast: active) {
  .my-custom-svg {
    fill: windowText;          /* IE/Edge proprietary system color */
  }
}
```

Use `fill: currentColor` for SVG/CSS-drawn icons whenever possible — they pick up the parent's high-contrast color automatically.

### `autocomplete` on inputs

Forms must declare expected input type for password managers + a11y:

```html
<input nxInput autocomplete="email" />
<input nxInput autocomplete="off" />     <!-- search/filter inputs -->
<input nxInput autocomplete="given-name" />
```

### Color contrast

NDBX components meet AA out of the box. Custom additions (status chip tokens, priority dots, badges) must also meet **4.5:1** for body text and **3:1** for large text / UI components.

Use [WebAIM contrast checker](https://webaim.org/resources/contrastchecker/) when adding any new project token color.

### Required for every page

- [ ] Tab through entire page — focus indicator visible at each stop
- [ ] Tab order matches visual reading order
- [ ] Skip-to-content link exists (or page is short enough not to need one)
- [ ] All icon-only buttons have `aria-label`
- [ ] Modal traps focus while open and restores on close (NDBX `NxDialogService` handles this)
- [ ] Toast / banner success messages call `LiveAnnouncer.announce()`
- [ ] Scroll containers have `tabindex="0"`
- [ ] No information conveyed by color alone

---

## Project-level tokens

NDBX provides no tokens for status colors, priority colors, overlay rgba, or page chrome→content gap. These are defined in `styles.scss` under `/* Project-level tokens */` and **must be used in all components**. Never write the raw hex/px in component `.scss` files.

### Page chrome → content gap

| Token | Value | Use |
|-------|-------|-----|
| `--page-content-top` | `40px` | Single canonical gap between top chrome (navbar + optional toolbar/breadcrumb) and page content (eyebrow / h1 / etc.). Equals blessed step-1-search stack: layout-inset-base 32 + 8 = 40. |

⚠️ See `RUNTIME_OVERRIDES.md` — when an element uses `[nxLayout="grid maxwidth"]`, `padding-top` on the same element is overridden by NDBX inline padding. Wrap it with an outer `*-wrap` div instead.

### Claim status chip

| Token | Value | Use |
|-------|-------|-----|
| `--claim-status-open-bg` / `--claim-status-open-color` | `#dce9f8` / `#006192` | "Open" chip |
| `--claim-status-in-progress-bg` / `--claim-status-in-progress-color` | `#dce9f8` / `#006192` | "In progress" claim chip |
| `--claim-status-bound-bg` / `--claim-status-bound-color` | `#d4edda` / `#155724` | "Bound" chip |
| `--claim-status-declined-bg` / `--claim-status-declined-color` | `#f8d7da` / `#721c24` | "Declined" chip |
| `--claim-status-closed-bg` / `--claim-status-closed-color` | `#e8e8e8` / `#767676` | "Closed" chip |
| `--claim-status-priced-bg` / `--claim-status-quoted-bg` | `#e8e8e8` / `#404040` | Neutral — no Figma color yet |

### Task status chip (different from claim status — amber ≠ blue)

| Token | Value | Use |
|-------|-------|-----|
| `--task-status-in-progress-bg` / `--task-status-in-progress-color` | `#fdf3d6` / `#7a5200` | **Task** in-progress chip (amber) |
| `--task-status-open-bg` / `--task-status-open-color` | `#dce9f8` / `#006192` | Task open chip |
| `--task-status-done-bg` / `--task-status-done-color` | `#d4edda` / `#155724` | Task done chip |

⚠️ `--task-status-in-progress-*` (amber) ≠ `--claim-status-in-progress-*` (blue). Different concepts. Wrong token = wrong color.

### Priority dot

| Token | Value |
|-------|-------|
| `--claim-priority-high` | `#e4003a` |
| `--claim-priority-medium` | `#fdd25c` |
| `--claim-priority-low` | `#d9d9d9` |

### Stats bars

| Token | Value |
|-------|-------|
| `--claim-bar-in-progress` | `#fdd25c` |
| `--claim-bar-priced` | `#8a679c` |
| `--claim-bar-quoted` | `#7fe4e0` |
| `--claim-bar-bound` | `#ccdd61` |
| `--claim-bar-declined` | `#e4003a` |

### Overlays

| Token | Value | Use |
|-------|-------|-----|
| `--claim-overlay-hover` | `rgba(0, 97, 146, 0.06)` | Interactive hover on white bg |
| `--claim-overlay-nav-hover` | `rgba(0, 0, 0, 0.05)` | Sidebar nav item hover scrim |
| `--claim-overlay-shadow` | `rgba(0, 0, 0, 0.12)` | Dropdown / modal shadow |
| `--claim-overlay-navbar-shadow` | `rgba(0, 0, 0, 0.15)` | Navbar box-shadow |
| `--claim-overlay-navbar-input` | `rgba(255, 255, 255, 0.2)` | Search on dark navbar |
| `--claim-overlay-navbar-muted` | `rgba(255, 255, 255, 0.75)` | Secondary text on dark navbar |

---

## When Uncertain

**Ask. Don't guess.**

- Don't guess token names — grep ndbx.css
- Don't guess design intent — ask for Figma reference
- Don't invent data shapes — check `core/models/`
- Stop and ask the user rather than proceeding on assumptions
