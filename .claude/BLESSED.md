# Blessed Files — Verified Reference Implementations

**DO NOT IMPROVISE. COPY FROM THESE.** Adjust only: field names, bindings, labels, routes.

A file qualifies as blessed when: renders correctly in browser + 0 console errors + all interactions work + passes `audit:all` + user-confirmed.

When user confirms a new feature works → ask: "Should I add `[file]` to BLESSED.md?"

**For ALL spacing decisions → read `.claude/SPACING.md` first.**

---

## Filter bar + search form + tabbed results table

**File:** `src/app/features/fnol/steps/step-1-search/step-1-search.component.html`
**Lines:** Full file — filter inputs (24–60), tab results table (165–255), context menu on row (369–396)
**SCSS:** `step-1-search.component.scss` — `.row1` flex 80/20 (lines 52–74), `.form-row.form-row--3col` (38–49)
**Use for:** Any search/filter UI with tabbed results, pagination, row selection, kebab menus
**Verified working:** 2026-05-08

### Reusable header pattern (eyebrow + title + caption + form)

From step-1-search:
```html
<p class="step-breadcrumb">Claim notification</p>
<h1 class="step-title">Client and policy search</h1>
<p class="step-subtitle">
  Kindly refer to specific field level criteria's to perform search.
  <nx-icon name="info-circle-o" size="s" class="subtitle-icon"></nx-icon>
</p>
```

```scss
.step-breadcrumb { font-size: 14px; color: var(--text-muted); margin: 0 0 4px; }
.step-title      { font-size: 28px; font-weight: 400; color: var(--text-01); margin: 0 0 8px; line-height: 1.2; }
.step-subtitle   { display: flex; align-items: center; gap: 6px; font-size: 14px; color: var(--text-muted); margin: 0 0 32px; }
.subtitle-icon   { flex-shrink: 0; color: var(--interactive-text); }
```

### Reusable form pattern (row1 = inputs 80% + actions 20%, form-row--3col below)

```scss
.row1 {
  display: flex;
  align-items: flex-end;
  gap: 24px;
}
.row1-inputs {
  flex: 0 0 80%;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 24px;
  align-items: start;
}
.row1-actions {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
  padding-bottom: 23px;   /* aligns buttons with formfield baseline */
}
.form-row {
  display: grid;
  gap: 24px;
  align-items: start;
  width: 80%;
  &--3col { grid-template-columns: 1fr 1fr 1fr; }
}
```

---

## Form with validation + error summary

**File:** `src/app/features/fnol/steps/step-loss-information/step-loss-information.component.ts`
**Companion HTML:** `step-loss-information.component.html` — date picker, timefield, multi-select, textarea, radio, checkbox, switcher all in one verified file
**Use for:** Reactive form with custom validators, cross-field validation, submitted-state errors

---

## Observable mock service with delay + scenarios

**File:** `src/app/core/mock/services/mock-entities-damages.service.ts` (preferred — extends `MockBaseService`)
**Alt:** `src/app/core/mock/services/mock-claim.service.ts`
**Use for:** Any new mock service — static JSON import, `structuredClone`, `respond()` helper

---

## Token-based status chip

**Files:** `src/app/shared/components/status-chip/status-chip.component.ts` + `.html` + `.scss`
**Selector:** `<app-status-chip [status]="row.status" domain="entity|claim|task">`
**Use for:** Any status badge using CSS project tokens (not hardcoded hex)

---

## Modal dialog with form + table (full pattern)

**Files:** `src/app/features/fnol/components/entity-search-modal/entity-search-modal.component.ts` + `.html`
**Use for:** Any `NxDialogService.open()` dialog that contains a form and results table
**Pattern:** `NX_MODAL_DATA` injection, `NxModalRef.close(result)`, `firstValueFrom(ref.afterClosed())`

### Mandatory modal SCSS pattern — copy exactly for every new modal

```scss
// ─── :host ───────────────────────────────────────────────────────────────────
:host {
  display: flex;
  flex-direction: column;
  max-width: 100vw;
  max-height: 80vh;    // ← REQUIRED — prevents overflow on small screens
  overflow: hidden;    // ← REQUIRED — scroll containment
}

// ─── Header ──────────────────────────────────────────────────────────────────
.xxx-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--ui-04);
  flex-shrink: 0;      // ← REQUIRED — header never shrinks
}

// ─── Body ────────────────────────────────────────────────────────────────────
.xxx-body {
  flex: 1;             // ← REQUIRED — body grows between header and footer
  overflow-y: auto;    // ← REQUIRED — body scrolls when content overflows
  padding: 24px;
}

// ─── Footer (lives INSIDE .xxx-body, after the last content block) ───────────
.xxx-footer {
  padding-top: 16px;   // ← NOT padding: 16px 24px — no extra horizontal padding
  margin-top: 8px;
  border-top: 1px solid var(--ui-04);
}
```

```ts
// Width via open() options — NOT via :host { width }
const ref = this.dialogSvc.open(XxxComponent, { data, width: '480px' });
```

### Why these rules exist

- Missing `max-height + overflow: hidden` on `:host` → dialog grows taller than viewport
- Missing `flex: 1` on body → footer jams against last content item (no breathing room)
- `padding: 16px 24px` on footer → doubles horizontal spacing because dialog wrapper already has padding
- `width` on `:host` instead of `open()` → NDBX overlay container may be wider than component, creating right-side whitespace
- Footer as `:host`-level sibling (not inside body) + no `flex: 1` on body → footer floats immediately below last item regardless of modal height

### Modal pre-ship checklist

- [ ] `:host` has `max-height: 80vh` and `overflow: hidden`
- [ ] body div has `flex: 1` and `overflow-y: auto`
- [ ] footer padding is `padding-top: 16px; margin-top: 8px` (no horizontal padding)
- [ ] `width` passed to `dialogSvc.open()`, NOT set on `:host`

**Verified working:** 2026-05-12

---

## Confirm dialog (danger variant)

**Files:** `src/app/shared/components/confirm-dialog/confirm-dialog.component.ts` + `.html` + `.scss`
**Use for:** Destructive action confirmation — Remove, Delete, Cancel with danger button
**Note:** Danger button uses `--message-error-border-color` (NOT `--negative` which resolves to `#ffffff`)

---

## Move / reassign dialog

**Files:** `src/app/features/fnol/components/move-entity-dialog/move-entity-dialog.component.ts` + `.html`
**Use for:** Two-dropdown "move to section + group" dialog pattern
**Pattern:** `hasChanged` getter guards confirm button; `form.setValue()` in `ngOnInit`

---

## Context menu on table row (kebab)

**File:** `src/app/features/fnol/steps/step-entities-damages/step-entities-damages.component.html`
**Lines:** 131–138 (per-row `#entityMenu` scoped inside `@for`)
**Use for:** Any action menu on a table row
**Pattern:** `[nxContextMenuTriggerFor]="entityMenu"` + `<nx-context-menu #entityMenu="nxContextMenu">` inside `@for` loop

---

## Reactive data with BehaviorSubject refresh

**File:** `src/app/features/fnol/steps/step-entities-damages/step-entities-damages.component.ts`
**Lines:** 77–99 (`refresh$` + `switchMap` + `currentData` snapshot pattern)
**Use for:** Any page that mutates data in-memory and needs to re-render after add/move/remove

---

## Vertical wizard stepper with router

**File:** `src/app/features/fnol/fnol-shell/fnol-shell.component.html`
**Use for:** Wizard shell layout — sidebar stepper + `<router-outlet>`

---

## Card layout / stat panels

**File:** `src/app/features/dashboard/dashboard.html`
**Use for:** Card-based page layout, stat widgets, action cards

---

## Split toolbar (left info / right action)

**Pattern:** `margin-left: auto` on right group pushes it to far right within a flex row.

```scss
.toolbar         { display: flex; align-items: center; width: 100%; }
.toolbar__left   { display: flex; align-items: center; gap: 16px; }
.toolbar__right  { margin-left: auto; display: flex; align-items: center; }
```

```html
<div class="toolbar">
  <div class="toolbar__left"><!-- counter, toggle, filters --></div>
  <div class="toolbar__right"><!-- primary action button --></div>
</div>
```

**Verified in:** `step-entities-damages.component.html` + `.scss` (`.ed-toolbar__meta`)
**Use for:** Any toolbar where info sits left and primary action sits right (table toolbars, list headers)
**Never use:** `justify-content: space-between` on the toolbar itself — creates empty dead space in the middle

---

## FNOL wizard footer (Cancel / Back / Next)

**File:** `src/app/shared/components/wizard-footer/wizard-footer.component.ts` + `.html` + `.scss`
**Use for:** Every FNOL step that needs Cancel (left) + Back + Next (right) footer navigation
**Selector:** `<app-wizard-footer (cancel)="…" (back)="…" (next)="…">`
**Inputs:** `nextLabel`, `nextDisabled`, `showBack`, `showCancel`
**Import:** `WizardFooterComponent` from `shared/components/wizard-footer/wizard-footer.component`
**Never:** Write inline `nxButton="secondary small"` Back or `nxButton="primary small"` Next in step templates — `audit:wizard-footer` will fail pre-commit
**Exceptions:** step-1-search (dynamic tooltip buttons), step-skeleton-create (spinner in submit)
**Verified in:** loss-information, entities-damages, parties, reserves, summary — 2026-05-13

---

## Tree child rows in a table (sub-items under expandable parent)

**File:** `src/app/features/fnol/steps/step-entities-damages/step-entities-damages.component.html`
**Lines:** sub-item `@for` block inside entity `@for`
**SCSS:** `step-entities-damages.component.scss` — `.sub-item-row`, `.sub-item__cell`, `.sub-item__name`
**Token:** `--tree-child-indent: 32px` defined in `styles.scss`

### Pattern — copy exactly

```html
<!-- parent row: checkbox in col-check, chevron button + text in col-name -->
<tr nxTableRow class="entity-row …">
  <td nxCell class="col-check"><nx-checkbox …></nx-checkbox></td>
  <td nxCell class="col-name">
    <div class="entity-cell">
      <button nxIconButton="tertiary small" (click)="entity.expanded = !entity.expanded">
        <nx-icon [name]="entity.expanded ? 'chevron-down-small' : 'chevron-right-small'"></nx-icon>
      </button>
      <span>{{ entity.name }}</span>
    </div>
  </td>
  …
</tr>

<!-- sub-item rows: col-check EMPTY, checkbox+text together in col-name -->
@if (entity.expanded && entity.subItems?.length) {
  @for (sub of entity.subItems; track sub.itemId) {
    <tr nxTableRow class="sub-item-row">
      <td nxCell class="col-check"></td>
      <td nxCell class="col-name">
        <div class="sub-item__cell">
          <nx-checkbox [checked]="sub.selected" (checkedChange)="onSubItemToggle(entity, sub, $event)"></nx-checkbox>
          <span class="sub-item__name">{{ sub.name }}</span>
        </div>
      </td>
      …
    </tr>
  }
}
```

```scss
.sub-item-row { background: var(--ui-02); }

.sub-item__cell {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: var(--tree-child-indent);   // = 32px
}

.sub-item__name {
  font-size: var(--paragraph-03-font-size);
  color: var(--text-01);
}
```

### Why col-check is empty on sub-item

Checkbox + text must have the same gap as the parent row (the col boundary provides it). Putting checkbox back in col-check makes the gap between checkbox and text inconsistent.

### Why NOT to use `nxExpandableTableRow` / `nxExpandableTableCell`

Those directives are for a SINGLE row that expands its own content in-place (accordion). They are NOT for multiple child rows — using them causes column width to shift on expand.

---

## App Page Shell (use for EVERY feature page — no exceptions)

**Files:** `src/app/shared/components/page-shell/page-shell.component.{ts,html,scss}`
**Selector:** `<app-page-shell [breadcrumb]="..." [toast]="..." [align]="..." (toastClose)="..."> ...content... </app-page-shell>`

### Why this is the default
- Single source of truth for navbar / toolbar / page-wrap / padding-top
- Breadcrumb auto-aligns with navbar menu (32px), not nested page content (64px)
- Toast banner pairs with `LiveAnnouncer` (a11y for NVDA/JAWS)
- Avoids the `[nxLayout]` padding trap (`RUNTIME_OVERRIDES.md`) — wrapper is correct internally
- Refactor spacing once → every page updates

### Inputs

| Input | Type | Default | Use |
|---|---|---|---|
| `breadcrumb` | `BreadcrumbItem[]` | `[]` | Empty = no toolbar; non-empty = toolbar with breadcrumb |
| `toast` | `string \| null` | `null` | Success banner above content |
| `align` | `'grid' \| 'navbar'` | `'grid'` | See below |

### `align` values — pick by content type

| Value | Inner edge | Use for |
|---|---|---|
| `'grid'` (default) | ~64px (nxLayout 32 + nxCol gutter 32) | Forms, tables, filter bars, lists with dense data → matches step-1-search blessed |
| `'navbar'` | 32px (matches `--header-padding`) | **Landing pages, card grids, dashboards** — content that should sit flush with top chrome menu items |

**Heuristic:** if the page is "lists of cards/links/widgets that flow horizontally", use `align="navbar"`. If it's a form or data table, use `align="grid"` (default).

### Patterns — copy these

**Landing / card-grid page (e.g. admin home):**
```html
<app-page-shell align="navbar">
  @for (group of groups; track group.title) {
    <section class="admin-group">
      <h2 class="admin-group__title">{{ group.title }}</h2>
      <div class="admin-cards">
        @for (card of group.cards; track card.key) { … }
      </div>
    </section>
  }
</app-page-shell>
```

**Form/table page with breadcrumb + toast (e.g. Mass Events):**
```html
<app-page-shell
  [breadcrumb]="breadcrumb"
  [toast]="toast()"
  (toastClose)="toast.set(null)">

  <p class="page-eyebrow">Section</p>
  <h1 class="page-title">Page title</h1>
  <!-- form, table, etc. -->
</app-page-shell>
```

```ts
import { PageShellComponent, BreadcrumbItem } from 'shared/components/page-shell/page-shell.component';

readonly breadcrumb: BreadcrumbItem[] = [
  { label: 'Administration', route: '/administration' },
  { label: 'Mass events' },              // last item: no route
];
```

### When to NOT use the shell

- Modal / dialog content (modals have their own host pattern — see "Modal dialog" below)
- Print views / embed widgets that don't have a navbar
- Anything with a fundamentally different chrome (rare; if you need this, ask)

**Verified in:**
- `administration.component.{ts,html}` — `align="navbar"` landing pattern (2026-05-22)
- `mass-events.component.{ts,html}` — `align="grid"` form/table pattern (2026-05-22)

---

## Page with grey toolbar/breadcrumb + content (Mass Events pattern — superseded by PageShell above)

**Files:** `src/app/features/administration/mass-events/mass-events.component.{html,scss}`
**Use for:** Any page that needs navbar → grey toolbar (breadcrumb) → content stack

### Pattern — outer wrap is mandatory because of `[nxLayout]` trap (see `RUNTIME_OVERRIDES.md`)

```html
<app-navbar />

<!-- Grey toolbar with breadcrumb -->
<div class="me-toolbar">
  <div nxLayout="grid maxwidth" class="me-toolbar__inner">
    <div nxRow><div nxCol="12">
      <ol nxBreadcrumb>
        <li nxBreadcrumbItem><a routerLink="/parent">Parent</a></li>
        <li nxBreadcrumbItem>Current</li>
      </ol>
    </div></div>
  </div>
</div>

<!-- Page wrapper owns vertical padding; nxLayout owns horizontal -->
<div class="me-page-wrap">
  <div nxLayout="grid maxwidth" class="me-page">
    <div nxRow><div nxCol="12">
      <p class="me-eyebrow">Parent label</p>
      <h1 class="me-title">Current page title</h1>
      <p class="me-caption">Caption text. <nx-icon name="info-circle-o" size="s"></nx-icon></p>
      <!-- form, table, etc. -->
    </div></div>
  </div>
</div>
```

```scss
.me-toolbar          { background: var(--toolbar-background); border-bottom: 1px solid var(--toolbar-border-bottom-color); }
.me-toolbar__inner   { display: flex; align-items: center; min-height: var(--toolbar-height); }

.me-page-wrap        { padding-top: var(--page-content-top); padding-bottom: var(--layout-inset-base); }
.me-page             { display: flex; flex-direction: column; gap: var(--layout-inset-base); }
```

### Why outer wrap

`[nxLayout="grid maxwidth"]` writes `padding: 0 var(--layout-inset-base)` **inline** on its host element, overriding `padding-top` declared on the same class. Outer `.*-wrap` owns vertical padding; nxLayout owns horizontal. See `RUNTIME_OVERRIDES.md`.

**Verified working:** 2026-05-22

---

## Card Body — Form Sections (within-card layout with sub-sections)

**Files:** `src/app/features/claims/claim-overview/claim-overview.component.{html,scss}`
**Lines (HTML):** 224–292 (File restriction body — search block + access list + reason row)
**Lines (SCSS):** 569–724 (`.co-restrict-body` through `.co-restrict-results`)
**Verified working:** 2026-06-22 (user confirmed after nx-formfield replacement)

### Spacing scale applied

| Gap | Value | Use |
|-----|-------|-----|
| Section-to-section (within card body) | `gap: 24px` on `.co-restrict-body` | Between distinct sub-sections (search+list vs. reason) |
| Heading → first item (same group) | `margin: 0 0 4px` on `__heading` | Heading belongs to the list below it |
| Search box → section heading (different groups) | `margin-bottom: 20px` on `.co-restrict-search` | Large gap signals boundary between groups |
| Entry padding | `padding: 8px 0` on `.co-restrict-entry` | Row breathing room inside list |
| Empty-state → bottom | `margin: 0 0 12px` on `__empty` | Space before next element when list is empty |

### Pattern — copy exactly

```html
<!-- Card body: flex column, gap = section-to-section -->
<div class="co-restrict-body">

  <!-- Sub-section 1: search + access list (primary — most frequent) -->
  <div class="co-restrict-access">

    <!-- Search ABOVE the list heading (Gestalt: search adds to list → proximity) -->
    <div class="co-restrict-search">
      <div class="co-restrict-search__input-wrap">
        <input class="co-restrict-search__input" type="text"
               [formControl]="someSearchControl"
               placeholder="Search to add item" />
        <nx-icon name="search" class="co-restrict-search__icon"></nx-icon>
      </div>
      @if (searchResults().length > 0) {
        <div class="co-restrict-results">
          @for (item of searchResults(); track item.id) {
            <button type="button" class="co-restrict-result" (click)="addItem(item)">
              <span class="co-restrict-result__name">{{ item.name }}</span>
              <span class="co-restrict-result__role">{{ item.role }}</span>
            </button>
          }
        </div>
      }
    </div>

    <p class="co-restrict-access__heading">Section heading</p>

    @if (list().length === 0) {
      <p class="co-restrict-access__empty">No items yet.</p>
    }
    @for (entry of list(); track entry.id) {
      <div class="co-restrict-entry">
        <div class="co-restrict-entry__info">
          <span class="co-restrict-entry__name">{{ entry.name }}</span>
          <span class="co-restrict-entry__role">{{ entry.role }}</span>
        </div>
        <button nxIconButton="tertiary small" type="button" (click)="removeItem(entry.id)">
          <nx-icon name="trash-o"></nx-icon>
        </button>
      </div>
    }

  </div>

  <!-- Sub-section 2: metadata / set-once fields (secondary) -->
  <div class="co-restrict-reason-row">
    <nx-formfield label="Field label" class="co-restrict-field">
      <nx-dropdown [formControl]="someControl" placeholder="Select...">
        @for (opt of options; track opt) {
          <nx-dropdown-item [value]="opt">{{ opt }}</nx-dropdown-item>
        }
      </nx-dropdown>
    </nx-formfield>
  </div>

</div>
```

```scss
.xxx-body {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--ui-03);
  display: flex;
  flex-direction: column;
  gap: 24px; // section-to-section gap — MUST be larger than element gaps
}

// Sub-section: search above heading above list
.xxx-access {
  display: flex;
  flex-direction: column;
  gap: 0; // rows separated by padding on entries, not gap

  &__heading {
    font-size: var(--paragraph-03-font-size);
    font-weight: 600;
    color: var(--text-01);
    margin: 0 0 4px; // glued to list below (same group)
  }

  &__empty {
    font-size: var(--paragraph-03-font-size);
    color: var(--text-muted);
    margin: 0 0 12px;
  }
}

// Search — ABOVE the heading; large bottom margin pushes heading close to list
.xxx-search {
  margin-top: 0;
  margin-bottom: 20px; // >> 4px heading margin → signals heading belongs to list
  position: relative;
  width: 100%;
  max-width: 360px;

  &__input-wrap {
    display: flex;
    align-items: center;
    border: 1px solid var(--ui-04);
    border-radius: 4px;
    padding: 0 12px;
    height: 40px;
    background: var(--ui-01);

    &:focus-within {
      border-color: var(--interactive-primary);
      outline: 2px solid var(--interactive-primary);
      outline-offset: 0;
    }
  }

  &__input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: var(--paragraph-03-font-size);
    color: var(--text-01);
    &::placeholder { color: var(--text-muted); }
  }

  &__icon { color: var(--text-muted); font-size: 16px; flex-shrink: 0; }
}

// Dropdown results list (position: absolute — parent must be position: relative)
.xxx-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--ui-01);
  border: 1px solid var(--ui-04);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  z-index: 100;
  overflow: hidden;
}

.xxx-result {
  display: flex;
  flex-direction: column;
  gap: 1px;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  &:hover { background: var(--hover-secondary); }
  &__name { font-size: var(--paragraph-03-font-size); color: var(--text-01); font-weight: 500; }
  &__role { font-size: var(--paragraph-03-font-size); color: var(--text-muted); }
}

.xxx-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--ui-03);

  &__info { display: flex; flex-direction: column; gap: 2px; }
  &__name { font-size: var(--paragraph-03-font-size); color: var(--text-01); font-weight: 500; }
  &__role { font-size: var(--paragraph-03-font-size); color: var(--text-muted); }
}

// Secondary sub-section: metadata fields
.xxx-reason-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-start;
}

.xxx-field {
  flex: 1;
  min-width: 160px;
  max-width: 280px;
}
```

### Why this order (search → heading → list → metadata)

UX journey determines hierarchy: user comes to (1) add a colleague [frequent], then (2) remove a colleague [occasional], then (3) set restriction reason [set-once]. Operational actions first, metadata last. Search belongs to the list it feeds — not a standalone section.

### Why NOT nx-formfield for the search input

`nx-formfield` reserves ~20px top (label placeholder) + ~20px bottom (error placeholder) even when `[floatLabel]="never"` and no error is shown. On dense layouts this creates gaps that look like broken spacing. Replace with a custom `div.__input-wrap` + bare `input` + `nx-icon`. See `.claude/skills/nx-formfield-spacing-trap/SKILL.md`.

### Proximity rule (Gestalt)

- **Same group:** gap ≤ 8px (heading to its first list item: 4px)
- **Different groups:** gap ≥ 16px (search block to heading: 20px; section to section: 24px)
- Violation symptom: label appears to "float" equidistant between two elements it doesn't belong to

---

## How to use this file

When the task involves any pattern listed above:

1. Open the reference file
2. Copy the working pattern exactly
3. Adjust only: field names, form control bindings, labels, route paths
4. Do NOT add attributes the reference doesn't have
5. Do NOT remove attributes the reference does have

When the pattern is NOT in this list:
1. State which pattern is needed
2. Confirm no reference exists
3. Ask user before improvising
4. After user verifies it works → add the new file here
