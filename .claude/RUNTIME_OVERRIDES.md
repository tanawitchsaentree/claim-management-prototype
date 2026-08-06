# Runtime Overrides — Inline Styles & DI Side-Effects

**Read this before writing ANY layout/styling code.** These overrides write CSS at runtime AFTER your stylesheet, so class-level `padding`/`margin`/`color` rules can be silently ignored. Each entry below has burned at least one session.

When debugging "the property I set isn't applying":
1. Open DevTools → Computed → check the actual value vs your source
2. Cross-reference this file before tweaking values

---

## `[nxLayout]` writes inline padding on its host

**Source:** `node_modules/@allianz/ng-aquila/grid/` — `NxLayoutComponent` directive

`[nxLayout="grid maxwidth"]` (and `[nxLayout]`, `[nxLayout="grid"]`, `[nxLayout="grid nogutters"]`, `[nxLayout="grid nopadding"]` variants) write **inline** on the host element:

```css
padding: 0 var(--layout-inset-base);  /* desktop, ≥704px */
padding: 0 var(--layout-inset-mobile); /* mobile */
```

**The trap:** Any `padding-top` / `padding-bottom` / `padding` shorthand declared in a CSS class on the SAME element is overridden silently. Page content ends up flush against whatever sits above it.

### Workaround — outer wrapper

```html
<div class="page-wrap">
  <div nxLayout="grid maxwidth" class="page">
    …
  </div>
</div>
```

```scss
.page-wrap {
  padding-top: var(--page-content-top);    /* project token = 40px */
  padding-bottom: var(--layout-inset-base);
}
.page {
  display: flex;
  flex-direction: column;
  gap: var(--layout-inset-base);
}
```

**Never put `padding-top` on the same element that has `[nxLayout]`** — it will be ignored.

**Verify:** open DevTools → Computed → confirm `padding-top` is the token value, not `0px`.

**Burned:** session 2026-05-22 — wasted 4+ rounds tweaking `--page-content-top` from 32→40→48→calc(...). Token was correct; placement was wrong. Required a DevTools screenshot from the user to spot.

**Blessed:** `BLESSED.md` → "Page with grey toolbar/breadcrumb + content"

---

## `NxExpertModule` overrides tokens at runtime

**Source:** `app.config.ts` imports `NxExpertModule`. It injects `expert.css` as a `<style>` tag at runtime AFTER `angular.json` styles, so its `:host` / `:root` selectors win on cascade order.

It overrides:
- `--interactive-primary`: `#007ab3` → `#27abd6` (dark theme blue)
- `--text-02`: `#ffffff` → `#0f2a3d` (near-black — breaks primary button white text)

It also injects DI default options:
- `FORMFIELD_DEFAULT_OPTIONS = { appearance: 'outline', nxFloatLabel: 'always' }`

### Workaround — re-assert in styles.scss

Both overridden tokens are re-asserted in `styles.scss :root` (and `html body` for higher specificity than runtime injection). **Do not remove these overrides.**

`floatLabel: 'always'` is already global via DI — **do not add `floatLabel="always"` explicitly** on individual `<nx-formfield>` elements.

**Note:** `expert.css` is NOT loaded in this project (only the DI side-effects from `NxExpertModule`). That's why `appearance="outline"` renders broken — the CSS classes for outline are in `expert.css`. Always use default underline.

---

## `<nx-formfield>` reserves vertical space

**Source:** `node_modules/@allianz/ng-aquila/formfield/` — internal styles

### Single formfield — ~20px reserved at bottom

Every `nx-formfield` reserves ~20px at the bottom for hint/error lines, even when empty.

**The trap:** Putting a `<button>` as a sibling of `<nx-formfield>` inside the same `align-items: flex-end` container — the button appears HIGHER than the input.

### Workaround — split into two columns + outer flex-end

```html
<div class="filter-bar">
  <div class="filter-bar__inputs"><!-- nx-formfield × N --></div>
  <div class="filter-bar__actions"><!-- buttons --></div>
</div>
```

```scss
.filter-bar          { display: flex; align-items: flex-end; gap: 16px; }
.filter-bar__inputs  { display: flex; align-items: flex-start; gap: 16px; }   /* fields */
.filter-bar__actions { display: flex; align-items: center; gap: 8px;
                       padding-bottom: 20px; }                                /* buttons — match formfield bottom reserve */
```

**Blessed:** `step-entities-damages.component.scss` — `.ed-toolbar__filter-inputs` / `.ed-toolbar__filter-actions`

### Stacked formfields — ~32px reserved per field

NDBX `nx-formfield` already reserves ~32px below each field for hint/error text. **Never add `gap: 16px` or `margin-bottom: 16px` between stacked formfields** — it compounds to ~48px and looks broken.

```scss
.my-form { display: flex; flex-direction: column; gap: 0; }
.my-form nx-formfield { width: 100%; margin-bottom: 4px; }   /* 4px, not 16 */
```

### `nx-formfield { width: 100% }` is mandatory

`nx-formfield` does NOT auto-fill its parent. Without `nx-formfield { width: 100% }` on the container (e.g. `.my-form nx-formfield { width: 100% }`), fields shrink to intrinsic content width. Required in every modal, card, or flex/grid container that stacks form fields.

Apply on the parent selector, not on `nx-formfield` directly.

**Blessed:** `step-skeleton-create.component.scss:42–51`

---

## `<nx-radio>` `labelSize` is required

**Source:** NDBX defaults `--small-label-font-size` to `1rem` (16px). This project overrides to 14px in `styles.scss`, but **only when `labelSize="small"` is explicitly set**.

Without `labelSize="small"` → the radio renders 16px regardless of token override.

```html
<nx-radio labelSize="small" name="x" value="a">A</nx-radio>
```

`audit:radio-size` enforces this in CI. `<nx-checkbox>` does not support `labelSize` — checkbox labels inherit body font-size correctly.

---

## FormControl state ≠ signal

**Source:** Angular `@angular/forms` — `FormControl.value` / `FormControl.valid` are RxJS-driven, not signal-tracked.

**The trap:** Reading `form.get('x')?.value` or `form.get('x')?.valid` directly inside a `computed()`. Angular's signal graph cannot track FormControl state — `computed()` evaluates ONCE at init and never re-runs.

### Workaround — bridge with toSignal

```ts
private readonly xStatus = toSignal(
  this.form.get('x')!.statusChanges,
  { initialValue: this.form.get('x')!.status }
);
readonly xInvalid = computed(() => this.xStatus() !== 'VALID');
```

For value bridging:
```ts
private readonly xValue = toSignal(
  this.form.get('x')!.valueChanges,
  { initialValue: this.form.get('x')!.value }
);
```

---

## `<nx-error>` requires `nxFormfieldError` directive

**Source:** `node_modules/@allianz/ng-aquila/formfield/` — formfield uses content projection slots.

**The trap:** Without the `nxFormfieldError` directive, `<nx-error>` text renders unconditionally (regardless of touched/invalid state) AND is not slotted below the control properly.

```html
<!-- ❌ WRONG -->
<nx-error>Field is required</nx-error>

<!-- ✅ CORRECT -->
<nx-error nxFormfieldError>Field is required</nx-error>
```

**No exceptions** — including conditional `@if` blocks. `audit:formfield-error` (in `audit:all`) catches violations at commit time.

**Blessed:** `step-skeleton-create.component.html:29,43,58`

---

## `<nx-radio-group>` zero default gap

**Source:** NDBX `nx-radio-group` has no default vertical spacing.

**The trap:** Vertical (stacked) radio list renders illegibly cramped without explicit gap.

```scss
nx-radio-group, .radio-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;   /* default; use 4px for tight contexts */
}
```

**Blessed:** `step-loss-information.component.scss:161–167` (gap: 8px); `step-reserves.component.scss:71–78` (gap: 4px)

---

## How to spot a runtime override fast

Symptoms that should immediately make you suspect this file:
1. "The property I set in CSS isn't showing up in DevTools Computed"
2. Class rule shows in DevTools but is **crossed out** with a more-specific inline rule winning
3. Token value is correct but visual result is wrong
4. The bug happens only when a specific NDBX directive is on the element
5. `npm run build` passes, audits pass, but UI is wrong

Diagnostic flow:
```
1. DevTools → element → Computed tab → look at actual value
2. DevTools → element → Styles tab → find what overrode you
3. Cross-reference this file
4. If a directive is the source → wrap or use the documented workaround
5. If runtime CSS is the source → re-assert in styles.scss :root
```

**Never tweak px values blindly.** If the property doesn't apply, the value isn't the problem.
