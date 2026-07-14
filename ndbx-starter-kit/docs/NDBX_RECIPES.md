# NDBX Recipes — Verified Working Patterns

All patterns verified with Angular 21 standalone, no `expert.css`, underline appearance only.

---

## Text input

**Modules:** `NxFormfieldModule`, `NxInputModule`

```html
<nx-formfield label="Client name">
  <input nxInput formControlName="clientName" />
</nx-formfield>
```

With validation error:
```html
<nx-formfield label="Policy number">
  <input nxInput formControlName="policyNumber" />
  <nx-error nxFormfieldError *ngIf="form.get('policyNumber')?.errors?.['required'] && submitted">
    Required.
  </nx-error>
</nx-formfield>
```

---

## Textarea

**Modules:** `NxFormfieldModule`, `NxInputModule`

```html
<nx-formfield label="Description (optional)">
  <textarea nxInput formControlName="description" rows="3" [maxlength]="500"></textarea>
  <nx-hint nxFormfieldHint>{{ descLength }}/500</nx-hint>
</nx-formfield>
```

---

## Number input

**Modules:** `NxFormfieldModule`, `NxInputModule`

```html
<nx-formfield label="Quantity">
  <input nxInput type="number" formControlName="quantity" min="0" />
</nx-formfield>
```

---

## Date picker

**Modules:** `NxFormfieldModule`, `NxInputModule`, `NxDatefieldModule`
**Global provider:** `NxIsoDateModule` in `app.config.ts` — returns ISO `"YYYY-MM-DD"` strings

```html
<nx-formfield label="Date of occurrence">
  <input nxDatefield nxInput formControlName="dateOfOccurrence" [datepicker]="occurrencePicker" />
  <nx-datepicker-toggle nxFormfieldSuffix [for]="occurrencePicker"></nx-datepicker-toggle>
  <nx-datepicker #occurrencePicker></nx-datepicker>
  <nx-error nxFormfieldError *ngIf="form.get('dateOfOccurrence')?.errors?.['required'] && submitted">
    Required.
  </nx-error>
</nx-formfield>
```

**Gotchas:**
- Link input → picker with `[datepicker]="ref"` (NOT `[nxDatefield]="ref"`)
- Toggle links with `[for]="ref"` (NOT `[datepicker]="ref"`)
- Both `nxDatefield` AND `nxInput` directives are required on the `<input>`
- In `@for` loops, `#pickerRef` is scoped per iteration — safe to reuse the name

---

## Time picker

**Modules:** `NxTimefieldModule` only — NO `NxFormfieldModule` wrapper

`<nx-timefield>` is self-contained — it contains its own `<nx-formfield>` internally. **Never wrap in an outer `<nx-formfield>`** — triggers `"Formfield must contain a NxFormfieldControl"` and breaks ALL formfields on the page.

```html
<!-- ✅ CORRECT -->
<nx-timefield label="Time of occurrence" formControlName="timeOfOccurrence"></nx-timefield>
<p class="field-error" *ngIf="form.get('timeOfOccurrence')?.errors?.['required'] && submitted">Required.</p>

<!-- ❌ WRONG — do NOT wrap in nx-formfield -->
<nx-formfield label="Time of occurrence">
  <nx-timefield formControlName="timeOfOccurrence"></nx-timefield>
</nx-formfield>
```

---

## Single-select dropdown

**Modules:** `NxDropdownModule`

```html
<nx-formfield label="Country">
  <nx-dropdown formControlName="country" placeholder="Select country">
    @for (c of countries; track c.value) {
      <nx-dropdown-item [value]="c.value">{{ c.label }}</nx-dropdown-item>
    }
  </nx-dropdown>
  <nx-error nxFormfieldError *ngIf="form.get('country')?.errors?.['required'] && submitted">
    Required.
  </nx-error>
</nx-formfield>
```

---

## Multi-select

**Modules:** `NxMultiSelectComponent` (imported directly, from `@allianz/ng-aquila/dropdown`)

```html
<nx-formfield label="Categories">
  <nx-multi-select
    [options]="categories"
    selectValue="value"
    selectLabel="label"
    placeholder="Select categories"
    formControlName="categories"
    (selectionChange)="onCategoryChange($event)"
  ></nx-multi-select>
  <nx-error nxFormfieldError *ngIf="submitted && selectedCategories.length === 0">
    Please select at least one.
  </nx-error>
</nx-formfield>
```

**Gotchas:**
- Does NOT use `NG_VALUE_ACCESSOR` — uses `NgControl` injection. `formControlName` works.
- Do NOT use `[value]` input — it does not exist as a public input.
- `[options]` = full array; `selectValue` = field used as form value; `selectLabel` = field displayed.

---

## Checkbox

**Modules:** `NxCheckboxModule`

Group (FormArray-backed, manual checked/change):
```html
<div class="checkbox-row">
  <nx-checkbox
    *ngFor="let opt of options"
    [checked]="isChecked(opt.value)"
    (checkedChange)="onToggle(opt.value, $event)"
  >{{ opt.label }}</nx-checkbox>
</div>
```

Single boolean with `formControlName`:
```html
<nx-checkbox formControlName="agreeToTerms">I agree to the terms</nx-checkbox>
```

---

## Radio button

**Modules:** `NxRadioModule`

**CRITICAL:** Every `<nx-radio>` must have `labelSize="small"` — without it the label renders at the wrong size.

Manual boolean pattern:
```html
<div class="radio-field">
  <p class="radio-label">Fire department called?</p>
  <div class="radio-row">
    <nx-radio name="fireDept" [value]="true"
      [checked]="fireDeptCalled === true"
      (valueChange)="setFireDeptCalled(true)" labelSize="small">Yes</nx-radio>
    <nx-radio name="fireDept" [value]="false"
      [checked]="fireDeptCalled === false"
      (valueChange)="setFireDeptCalled(false)" labelSize="small">No</nx-radio>
  </div>
</div>
```

---

## Radio group with formControlName

**Modules:** `NxRadioModule`

```html
<!-- ✅ CORRECT — nx-radio-group owns formControlName -->
<nx-radio-group formControlName="reasonKey" class="my-form__radios">
  @for (opt of options; track opt.value) {
    <nx-radio [value]="opt.value" labelSize="small">{{ opt.label }}</nx-radio>
  }
</nx-radio-group>
```

**Gotchas:**
- `formControlName` goes on `nx-radio-group`, NOT individual `nx-radio`
- Always `labelSize="small"` on every `<nx-radio>`
- Parent `<form [formGroup]="fg">` is required

---

## Toggle (switcher)

**Modules:** `NxSwitcherModule`

```html
<nx-switcher formControlName="isActive">Enable feature</nx-switcher>
```

---

## Button

**Modules:** `NxButtonModule`

```html
<!-- Primary -->
<button nxButton="primary" type="submit">Save</button>
<button nxButton="primary small" type="button" (click)="onNext()">Next</button>

<!-- Secondary -->
<button nxButton="secondary small" type="button" (click)="onBack()">
  <nx-icon name="arrow-left" class="btn-icon-left"></nx-icon>
  Back
</button>

<!-- Tertiary (ghost) -->
<button nxButton="tertiary" type="button" (click)="onCancel()">Cancel</button>
<button nxButton="tertiary small" type="button" (click)="onReset()">Reset</button>

<!-- Plain text-link style -->
<button nxPlainButton type="button" (click)="onCancel()">Cancel</button>
```

Sizes: `primary`, `primary small`, `secondary`, `secondary small`, `tertiary`, `tertiary small`.

---

## Spinner

**Modules:** `NxSpinnerModule`

```html
<!-- Inside button -->
<button nxButton="primary small" type="submit" [disabled]="isLoading">
  @if (isLoading) { <nx-spinner size="small"></nx-spinner> }
  @else { Submit }
</button>

<!-- Standalone loading state -->
<div class="loading-state">
  <nx-spinner size="medium"></nx-spinner>
  <span>Loading…</span>
</div>
```

Sizes: `small`, `medium`, `large`.

---

## Validation error message

**Modules:** `NxFormfieldModule`

```html
<!-- Inside nx-formfield — nxFormfieldError is REQUIRED -->
<nx-error nxFormfieldError *ngIf="form.get('field')?.errors?.['required'] && submitted">
  Required.
</nx-error>
<nx-error nxFormfieldError *ngIf="form.get('field')?.errors?.['futureDate']">
  Cannot be a future date.
</nx-error>

<!-- Cross-field / group-level error (outside formfield) -->
<nx-error class="group-error" *ngIf="myGroup.errors?.['dateOrder'] && submitted">
  End date must be after start date.
</nx-error>
```

---

## Message / banner

**Modules:** `NxMessageModule`

```html
<nx-message context="warning" [closable]="true" (close)="dismissBanner()">
  <strong>Attention required</strong>
  <p>Something needs your attention.</p>
</nx-message>
```

Contexts: `info`, `warning`, `error`, `success`.

---

## Icon

**Modules:** `NxIconModule`

```html
<nx-icon name="arrow-left"></nx-icon>
<nx-icon name="info-circle-o" size="s"></nx-icon>
<nx-icon name="chevron-down-small"></nx-icon>
```

Sizes: `s`, `m` (default), `l`, `xl`, `2xl`, `3xl`.

---

## Card

**Modules:** `NxCardModule`

```html
<nx-card>
  <!-- content -->
</nx-card>
```

---

## Tabs

**Modules:** `NxTabsModule`

```html
<nx-tab-group [(selectedIndex)]="activeTab">
  <nx-tab>
    <ng-template nxTabLabel>Tab one ({{ count }})</ng-template>
  </nx-tab>
  <nx-tab>
    <ng-template nxTabLabel>Tab two</ng-template>
  </nx-tab>
</nx-tab-group>

@if (activeTab === 0) { <!-- tab one content --> }
@if (activeTab === 1) { <!-- tab two content --> }
```

Tab content is rendered with `@if`, NOT inside `<nx-tab>` body — prevents unmounting hidden tabs.

---

## Pagination

**Modules:** `NxPaginationModule`

```html
<nx-pagination
  [count]="totalItems"
  [page]="currentPage"
  [perPage]="pageSize"
  type="advanced"
  (goPrev)="currentPage = currentPage - 1"
  (goNext)="currentPage = currentPage + 1"
  (goPage)="currentPage = $event">
</nx-pagination>
```

---

## Tooltip

**Modules:** `NxTooltipModule`

```html
<span [nxTooltip]="'Tooltip text'" nxTooltipPosition="top">
  <button nxButton="secondary" [disabled]="true">Disabled</button>
</span>
```

Positions: `top`, `bottom`, `left`, `right`.

---

## Context menu (kebab on table row)

**Modules:** `NxContextMenuModule`

```html
<button type="button"
        [nxContextMenuTriggerFor]="rowMenu"
        [nxContextMenuTriggerData]="{ item: row }">
  <nx-icon name="ellipsis-v"></nx-icon>
</button>

<nx-context-menu #rowMenu="nxContextMenu">
  <ng-template nxContextMenuContent let-item="item">
    <button nxContextMenuItem type="button" (click)="onView(item.id)">View</button>
    <button nxContextMenuItem type="button" (click)="onDelete(item.id)">Delete</button>
  </ng-template>
</nx-context-menu>
```

---

## Hint text

**Modules:** `NxFormfieldModule`

```html
<nx-formfield label="Date of loss">
  <input nxInput formControlName="dateOfLoss" />
  <span nxFormfieldHint>DD-MM-YYYY</span>
</nx-formfield>
```

---

## FORBIDDEN patterns

| Pattern | Why broken |
|---------|------------|
| `appearance="outline"` on `nx-formfield` | Renders as unstyled broken box without expert.css |
| `<input type="date">` | Use `input[nxDatefield]` + `nx-datepicker` |
| `<select>` / `<option>` | Use `nx-dropdown` + `nx-dropdown-item` |
| `[value]="myVal"` on `nx-multi-select` | No public `[value]` input — use `formControlName` |
| `[nxDatefield]="pickerRef"` on input | Wrong attribute — use `[datepicker]="pickerRef"` |
| `<nx-formfield><nx-timefield>` | nx-timefield is self-contained — wrapping breaks all formfields on the page |
| `subscribe()` in component | Use `async` pipe |
| `<nx-error>` without `nxFormfieldError` | Error shows unconditionally regardless of touched/invalid state |
