# NDBX Recipes — Verified Working Patterns

All patterns verified in this project (Angular 21 standalone, no `expert.css`, underline appearance only).

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

**VERIFIED IN:** `src/app/features/fnol/steps/step-1-search/step-1-search.component.html` line 24–26

---

## Textarea

**Modules:** `NxFormfieldModule`, `NxInputModule`

```html
<nx-formfield label="Loss description (optional)">
  <textarea nxInput formControlName="lossDescription" rows="3" [maxlength]="500"></textarea>
  <nx-hint nxFormfieldHint>{{ descLength }}/500</nx-hint>
</nx-formfield>
```

**VERIFIED IN:** `src/app/features/fnol/steps/step-loss-information/step-loss-information.component.html` line 127–129

---

## Number input

**Modules:** `NxFormfieldModule`, `NxInputModule`

```html
<nx-formfield label="Affected area (m²) (optional)">
  <input nxInput type="number" formControlName="affectedAreaSqm" min="0" />
</nx-formfield>
```

**VERIFIED IN:** `src/app/features/fnol/steps/step-loss-information/step-loss-information.component.html` line 173–175

---

## Date picker

**Modules:** `NxFormfieldModule`, `NxInputModule`, `NxDatefieldModule`
**Global provider:** `NxIsoDateModule` (already in `app.config.ts`) — returns ISO `"YYYY-MM-DD"` strings

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
- In `*ngFor` loops, `#pickerRef` is scoped per iteration — safe to reuse name

**VERIFIED IN:** `src/app/features/fnol/steps/step-loss-information/step-loss-information.component.html` line 13–23

---

## Time picker

**Modules:** `NxTimefieldModule` only — no `NxFormfieldModule` wrapper needed or allowed

`<nx-timefield>` is a **self-contained component** — it contains its own `<nx-formfield>` and its own `NxFormfieldControl` implementor (`<nx-timefield-control>`) internally. **Never wrap it in an outer `<nx-formfield>`** — that triggers `"Formfield must contain a NxFormfieldControl"` and breaks ALL formfields on the page.

```html
<!-- ✅ CORRECT — standalone, label via attribute -->
<nx-timefield label="Time of occurrence" formControlName="timeOfOccurrence"></nx-timefield>
<p class="field-error" *ngIf="form.get('timeOfOccurrence')?.errors?.['required'] && submitted">Required.</p>

<!-- ❌ WRONG — do NOT wrap in nx-formfield -->
<nx-formfield label="Time of occurrence">
  <nx-timefield formControlName="timeOfOccurrence"></nx-timefield>
</nx-formfield>
```

**VERIFIED IN:** `src/app/features/fnol/steps/step-loss-information/step-loss-information.component.html` line 26

---

## Single-select dropdown

**Modules:** `NxDropdownModule`

```html
<nx-formfield label="Country">
  <nx-dropdown formControlName="country" placeholder="Select country">
    <nx-dropdown-item *ngFor="let c of vm.countries" [value]="c.value">{{ c.label }}</nx-dropdown-item>
  </nx-dropdown>
  <nx-error nxFormfieldError *ngIf="form.get('country')?.errors?.['required'] && submitted">
    Required.
  </nx-error>
</nx-formfield>
```

With `@for` (Angular 17+ control flow):
```html
<nx-formfield label="Underwriting year">
  <nx-dropdown formControlName="underwritingYear" placeholder="Select">
    @for (year of years; track year) {
      <nx-dropdown-item [value]="year">{{ year }}</nx-dropdown-item>
    }
  </nx-dropdown>
</nx-formfield>
```

**VERIFIED IN:** `src/app/features/fnol/steps/step-1-search/step-1-search.component.html` line 31–36

---

## Multi-select

**Modules:** `NxMultiSelectComponent` (imported directly, from `@allianz/ng-aquila/dropdown`)

```html
<nx-formfield label="Cause of loss">
  <nx-multi-select
    [options]="vm.causeOfLoss"
    selectValue="value"
    selectLabel="label"
    placeholder="Select cause of loss"
    formControlName="causeOfLoss"
    (selectionChange)="onCauseOfLossChange($event)"
  ></nx-multi-select>
  <nx-error nxFormfieldError *ngIf="submitted && selectedCauses.length === 0">
    Please select at least one cause of loss.
  </nx-error>
</nx-formfield>
```

**Gotchas:**
- Does NOT use `NG_VALUE_ACCESSOR` — uses `NgControl` injection. `formControlName` works correctly.
- Do NOT use `[value]` input binding — it does not exist as a public input.
- `_onChange` fires BEFORE `selectionChange.emit`, so when your custom handler runs the form value is already up to date.
- `[options]` = full array; `selectValue` = field to use as the form value; `selectLabel` = field to display.

**VERIFIED IN:** `src/app/features/fnol/steps/step-loss-information/step-loss-information.component.html` line 96–107

---

## Checkbox

**Modules:** `NxCheckboxModule`

In a group (manual checked/change pattern for FormArray-backed checkboxes):
```html
<div class="checkbox-row">
  <nx-checkbox
    *ngFor="let opt of options"
    [checked]="isChecked(opt.value)"
    (checkedChange)="onToggle(opt.value, $event)"
  >{{ opt.label }}</nx-checkbox>
</div>
```

With `formControlName` for single boolean:
```html
<nx-checkbox formControlName="agreeToTerms">I agree to the terms</nx-checkbox>
```

**VERIFIED IN:** `src/app/features/fnol/steps/step-loss-information/step-loss-information.component.html` line 215–219

---

## Radio button

**Modules:** `NxRadioModule`

### CRITICAL: always add `labelSize="small"` to every `<nx-radio>`

NDBX defaults `--small-label-font-size` to `1rem` (16px). This project overrides it to `14px` in `styles.scss`, but the override only activates when `labelSize="small"` is explicitly set on the element. Without it, radio labels render at the wrong 16px size.

`audit:radio-size` enforces this — it fails if any `<nx-radio` is missing `labelSize`.

Manual pattern (not CVA-bound, for boolean yes/no):
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

All radios in a group share the same `name` attribute. Use `[checked]` + `(valueChange)` to bind to component state.

**VERIFIED IN:** `src/app/features/fnol/steps/step-loss-information/step-loss-information.component.html` line 144–154

---

## Radio group with formControlName

**Modules:** `NxRadioModule`

For a radio group bound to a `FormGroup` control, use `nx-radio-group` with `formControlName` and `nx-radio` for each option:

```html
<!-- ✅ CORRECT — nx-radio-group owns the formControlName -->
<nx-radio-group formControlName="reasonKey" class="my-form__radios">
  @for (opt of options; track opt.value) {
    <nx-radio [value]="opt.value" labelSize="small">{{ opt.label }}</nx-radio>
  }
</nx-radio-group>
```

The parent `<form [formGroup]="fg">` (or `[formGroup]` on a wrapper `<div>`) is required — `formControlName` on `nx-radio-group` needs a parent FormGroup context.

**Gotchas:**
- `formControlName` goes on `nx-radio-group`, NOT on individual `nx-radio` elements
- Each `nx-radio` binds its option via `[value]` (the value written to the FormControl when selected)
- Always `labelSize="small"` — see note above
- Do NOT also set `[formControl]="fg.controls.x"` on the same element — that is a double-binding error

```html
<!-- ❌ WRONG — double binding -->
<nx-radio-group formControlName="reasonKey" [formControl]="narrativeForm.controls.reasonKey">

<!-- ❌ WRONG — missing parent FormGroup context -->
<div>
  <nx-radio-group formControlName="reasonKey">   <!-- no [formGroup] parent → runtime error -->
```

**VERIFIED IN:** `src/app/features/fnol/steps/step-reserves/step-reserves.component.html`

---

## Toggle (switcher)

**Modules:** `NxSwitcherModule`

With `formControlName`:
```html
<nx-switcher formControlName="useDifferentDates">
  Dates different from event 1
</nx-switcher>
```

With `[formControl]` (e.g., from FormArray):
```html
<nx-switcher [formControl]="$any(eventGroup(i).get('useDifferentDates'))">
  Use different dates
</nx-switcher>
```

**VERIFIED IN:** `src/app/features/fnol/steps/step-loss-information/step-loss-information.component.html` line 240–243

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

<!-- Tertiary (outline-style ghost) -->
<button nxButton="tertiary" type="button" (click)="onCancel()">Cancel</button>
<button nxButton="tertiary small" type="button" (click)="onReset()">Reset search</button>

<!-- Plain (text-link style) -->
<button nxPlainButton type="button" (click)="onCancel()">Cancel</button>
```

Sizes: `primary`, `primary small`, `secondary`, `secondary small`, `tertiary`, `tertiary small`.

**VERIFIED IN:** `src/app/features/fnol/steps/step-1-search/step-1-search.component.html` line 39–47

---

## Spinner

**Modules:** `NxSpinnerModule`

```html
<!-- Inline inside button -->
<button nxButton="primary small" type="submit" [disabled]="isLoading">
  @if (isLoading) {
    <nx-spinner size="small"></nx-spinner>
  } @else {
    Search
  }
</button>

<!-- Standalone loading state -->
<div class="results-loading">
  <nx-spinner size="medium"></nx-spinner>
  <span>Searching…</span>
</div>
```

Sizes: `small`, `medium`, `large`.

**VERIFIED IN:** `src/app/features/fnol/steps/step-1-search/step-1-search.component.html` line 39–45

---

## Validation error message

**Modules:** `NxFormfieldModule` (provides `nxFormfieldError` directive)

Inside `nx-formfield`:
```html
<nx-error nxFormfieldError *ngIf="form.get('field')?.errors?.['required'] && submitted">
  Required.
</nx-error>
<nx-error nxFormfieldError *ngIf="form.get('field')?.errors?.['futureDate']">
  Cannot be a future date.
</nx-error>
```

Group-level error (outside formfield, for cross-field validators):
```html
<nx-error class="group-error" *ngIf="myGroup.errors?.['dateOrder'] && submitted">
  Date of notification must be on or after date of occurrence.
</nx-error>
```

**VERIFIED IN:** `src/app/features/fnol/steps/step-loss-information/step-loss-information.component.html` line 17–22

---

## Message / banner

**Modules:** `NxMessageModule`

```html
<nx-message context="warning" [closable]="true" (close)="dismissBanner()">
  <strong>3 skeleton claims need attention</strong>
  <p>CL-001 • John Doe • 5 days ago</p>
</nx-message>
```

Contexts: `info`, `warning`, `error`, `success`.

**VERIFIED IN:** `src/app/features/fnol/steps/step-1-search/step-1-search.component.html` line 121–139

---

## Icon

**Modules:** `NxIconModule`

```html
<nx-icon name="arrow-left"></nx-icon>
<nx-icon name="info-circle-o" size="s"></nx-icon>
<nx-icon name="chevron-down-small"></nx-icon>
<nx-icon name="exclamation-triangle-o"></nx-icon>
```

Sizes: `s`, `m` (default), `l`, `xl`, `2xl`, `3xl`.

**VERIFIED IN:** `src/app/features/fnol/steps/step-1-search/step-1-search.component.html` line 8, 93

---

## Card

**Modules:** `NxCardModule`

```html
<nx-card>
  <!-- content -->
</nx-card>
```

**VERIFIED IN:** `src/app/features/claims/claim-form/claim-form.html` line 6

---

## Tabs

**Modules:** `NxTabsModule`

```html
<nx-tab-group [(selectedIndex)]="activeTab">
  <nx-tab>
    <ng-template nxTabLabel>Clients ({{ count }})</ng-template>
  </nx-tab>
  <nx-tab>
    <ng-template nxTabLabel>Policies ({{ count }})</ng-template>
  </nx-tab>
</nx-tab-group>

@if (activeTab === 0) {
  <!-- clients content -->
}
@if (activeTab === 1) {
  <!-- policies content -->
}
```

Note: Tab content is rendered manually with `@if`, not inside `<nx-tab>` body, so the list doesn't unmount hidden tabs.

**VERIFIED IN:** `src/app/features/fnol/steps/step-1-search/step-1-search.component.html` line 165–182

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

**VERIFIED IN:** `src/app/features/fnol/steps/step-1-search/step-1-search.component.html` line 246–251

---

## Tooltip

**Modules:** `NxTooltipModule`

```html
<span [nxTooltip]="'This field is read-only'" nxTooltipPosition="top">
  <button nxButton="secondary" [disabled]="true">Disabled action</button>
</span>
```

Positions: `top`, `bottom`, `left`, `right`.

**VERIFIED IN:** `src/app/features/fnol/steps/step-1-search/step-1-search.component.html` line 414–418

---

## Context menu

**Modules:** `NxContextMenuModule`

```html
<!-- Trigger -->
<button type="button"
        [nxContextMenuTriggerFor]="myMenu"
        [nxContextMenuTriggerData]="{ item: row }">
  <nx-icon name="ellipsis-v"></nx-icon>
</button>

<!-- Menu definition -->
<nx-context-menu #myMenu="nxContextMenu">
  <ng-template nxContextMenuContent let-item="item">
    <button nxContextMenuItem type="button" (click)="onView(item.id)">View</button>
    <button nxContextMenuItem type="button" (click)="onDelete(item.id)">Delete</button>
  </ng-template>
</nx-context-menu>
```

**VERIFIED IN:** `src/app/features/fnol/steps/step-1-search/step-1-search.component.html` line 369–396

---

## Hint text

**Modules:** `NxFormfieldModule`

```html
<nx-formfield label="Date of loss">
  <input nxInput formControlName="dateOfLoss" />
  <span nxFormfieldHint>DD-MM-YYYY</span>
</nx-formfield>
```

Character counter variant:
```html
<nx-formfield label="Description">
  <textarea nxInput formControlName="description" [maxlength]="500"></textarea>
  <nx-hint nxFormfieldHint>{{ description.length }}/500</nx-hint>
</nx-formfield>
```

**VERIFIED IN:** `src/app/features/fnol/steps/step-1-search/step-1-search.component.html` line 57–60

---

## FORBIDDEN patterns (will break silently or render incorrectly)

| Pattern | Why broken |
|---------|------------|
| `appearance="outline"` on `nx-formfield` | `expert.css` not loaded — renders as unstyled broken box |
| `<input type="date">` | Ignore NDBX — use `input[nxDatefield]` + `nx-datepicker` |
| `<select>` / `<option>` | Use `nx-dropdown` + `nx-dropdown-item` |
| `[value]="myVal"` on `nx-multi-select` | No public `[value]` input — use `formControlName` |
| `[nxDatefield]="pickerRef"` on input | Wrong — use `[datepicker]="pickerRef"` |
| `<nx-formfield><nx-timefield>` | nx-timefield is self-contained — wrapping it triggers "Formfield must contain a NxFormfieldControl" and breaks ALL formfields on page |
| `subscribe()` in component | Use `async` pipe instead |
