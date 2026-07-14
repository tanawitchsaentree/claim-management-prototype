# Blessed Patterns — Verified Reference Implementations

**Copy from these. Adjust only: field names, bindings, labels, routes.**

A pattern qualifies as blessed when: renders correctly in browser + 0 console errors + all interactions work.

When a feature is confirmed working → add it here.

---

## Page header (eyebrow + title + caption)

```html
<p class="page-eyebrow">Section name</p>
<h1 class="page-title">Page title</h1>
<p class="page-subtitle">
  Caption text.
  <nx-icon name="info-circle-o" size="s" class="subtitle-icon"></nx-icon>
</p>
```

```scss
.page-eyebrow   { font-size: 14px; color: var(--text-muted); margin: 0 0 4px; }
.page-title     { font-size: 28px; font-weight: 400; color: var(--text-01); margin: 0 0 8px; line-height: 1.2; }
.page-subtitle  { display: flex; align-items: center; gap: 6px; font-size: 14px; color: var(--text-muted); margin: 0 0 32px; }
.subtitle-icon  { flex-shrink: 0; color: var(--interactive-text); }
```

---

## Filter form (inputs 80% + action buttons 20%)

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
```

---

## Split toolbar (left info / right action)

```html
<div class="toolbar">
  <div class="toolbar__left"><!-- counter, toggle, filters --></div>
  <div class="toolbar__right"><!-- primary action button --></div>
</div>
```

```scss
.toolbar       { display: flex; align-items: center; width: 100%; }
.toolbar__left { display: flex; align-items: center; gap: 16px; }
.toolbar__right { margin-left: auto; display: flex; align-items: center; }
```

**Never use** `justify-content: space-between` on the toolbar — creates dead space in the middle.

---

## Modal SCSS (copy exactly for every new modal)

```scss
:host {
  display: flex;
  flex-direction: column;
  max-width: 100vw;
  max-height: 80vh;    /* prevents overflow on small screens */
  overflow: hidden;    /* scroll containment */
}

.xxx-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--ui-04);
  flex-shrink: 0;
}

.xxx-body {
  flex: 1;             /* grows between header and footer */
  overflow-y: auto;
  padding: 24px;
}

.xxx-footer {
  padding-top: 16px;   /* NOT padding: 16px 24px — no extra horizontal padding */
  margin-top: 8px;
  border-top: 1px solid var(--ui-04);
}
```

```ts
// Width via open() options — NOT via :host { width }
const ref = this.dialogSvc.open(XxxComponent, { data, width: '480px' });
```

**Modal pre-ship checklist:**
- [ ] `:host` has `max-height: 80vh` and `overflow: hidden`
- [ ] body div has `flex: 1` and `overflow-y: auto`
- [ ] footer padding is `padding-top: 16px; margin-top: 8px` (no horizontal)
- [ ] `width` passed to `dialogSvc.open()`, NOT set on `:host`

---

## Dense card section (search + list + metadata)

Use when: a card body contains a "search to add" input above a list, plus a secondary metadata field below.

```html
<div class="xxx-body">

  <div class="xxx-access">
    <div class="xxx-search">
      <div class="xxx-search__input-wrap">
        <input class="xxx-search__input" type="text"
               [formControl]="searchCtrl" placeholder="Search to add item" />
        <nx-icon name="search" class="xxx-search__icon"></nx-icon>
      </div>
      @if (searchResults().length > 0) {
        <div class="xxx-results">
          @for (item of searchResults(); track item.id) {
            <button type="button" class="xxx-result" (click)="addItem(item)">
              <span class="xxx-result__name">{{ item.name }}</span>
              <span class="xxx-result__meta">{{ item.meta }}</span>
            </button>
          }
        </div>
      }
    </div>

    <p class="xxx-access__heading">Section heading</p>

    @if (list().length === 0) {
      <p class="xxx-access__empty">No items yet.</p>
    }
    @for (entry of list(); track entry.id) {
      <div class="xxx-entry">
        <div class="xxx-entry__info">
          <span class="xxx-entry__name">{{ entry.name }}</span>
          <span class="xxx-entry__meta">{{ entry.meta }}</span>
        </div>
        <button nxIconButton="tertiary small" type="button" (click)="removeItem(entry.id)">
          <nx-icon name="trash-o"></nx-icon>
        </button>
      </div>
    }
  </div>

  <div class="xxx-reason-row">
    <nx-formfield label="Field label" class="xxx-field">
      <nx-dropdown [formControl]="someCtrl" placeholder="Select...">
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
  gap: 24px;
}

.xxx-access {
  display: flex;
  flex-direction: column;
  gap: 0;

  &__heading { font-size: var(--paragraph-03-font-size); font-weight: 600; color: var(--text-01); margin: 0 0 4px; }
  &__empty   { font-size: var(--paragraph-03-font-size); color: var(--text-muted); margin: 0 0 12px; }
}

.xxx-search {
  margin-bottom: 20px;
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
    flex: 1; border: none; outline: none; background: transparent;
    font-size: var(--paragraph-03-font-size); color: var(--text-01);
    &::placeholder { color: var(--text-muted); }
  }

  &__icon { color: var(--text-muted); font-size: 16px; flex-shrink: 0; }
}

.xxx-results {
  position: absolute; top: 100%; left: 0; right: 0;
  background: var(--ui-01); border: 1px solid var(--ui-04);
  border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  z-index: 100; overflow: hidden;
}

.xxx-result {
  display: flex; flex-direction: column; gap: 1px;
  width: 100%; padding: 8px 12px; text-align: left;
  background: none; border: none; cursor: pointer;
  &:hover { background: var(--ui-02); }
  &__name { font-size: var(--paragraph-03-font-size); color: var(--text-01); font-weight: 500; }
  &__meta { font-size: var(--paragraph-03-font-size); color: var(--text-muted); }
}

.xxx-entry {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0; border-bottom: 1px solid var(--ui-03);

  &__info { display: flex; flex-direction: column; gap: 2px; }
  &__name { font-size: var(--paragraph-03-font-size); color: var(--text-01); font-weight: 500; }
  &__meta { font-size: var(--paragraph-03-font-size); color: var(--text-muted); }
}

.xxx-reason-row { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
.xxx-field      { flex: 1; min-width: 160px; max-width: 280px; }
```

**Why bare `<input>` here instead of `nx-formfield`:** `nx-formfield` reserves ~20px top + ~20px bottom even with no label and no error. On dense layouts this creates gaps. See `.claude/skills/nx-formfield-spacing-trap/SKILL.md`.

**Spacing rationale:**
- Same group (heading → first list item): ≤ 8px
- Different groups (search block → heading): ≥ 16px (20px here)
- Section to section: 24px

---

## Tree child rows in a table

```html
<tr nxTableRow class="parent-row">
  <td nxCell class="col-check"><nx-checkbox …></nx-checkbox></td>
  <td nxCell class="col-name">
    <div class="parent-cell">
      <button nxIconButton="tertiary small" (click)="row.expanded = !row.expanded">
        <nx-icon [name]="row.expanded ? 'chevron-down-small' : 'chevron-right-small'"></nx-icon>
      </button>
      <span>{{ row.name }}</span>
    </div>
  </td>
</tr>

@if (row.expanded && row.children?.length) {
  @for (child of row.children; track child.id) {
    <tr nxTableRow class="child-row">
      <td nxCell class="col-check"></td>
      <td nxCell class="col-name">
        <div class="child-cell">
          <nx-checkbox [checked]="child.selected" (checkedChange)="onToggle(row, child, $event)"></nx-checkbox>
          <span class="child-name">{{ child.name }}</span>
        </div>
      </td>
    </tr>
  }
}
```

```scss
.child-row  { background: var(--ui-02); }
.child-cell { display: flex; align-items: center; gap: 8px; padding-left: 32px; }
.child-name { font-size: var(--paragraph-03-font-size); color: var(--text-01); }
```

**Do NOT use `nxExpandableTableRow`** — that expands a single row in-place. It is not for multiple child rows.

---

## Observable mock service pattern

```ts
@Injectable({ providedIn: 'root' })
export class MockXxxService {
  private data: XxxItem[] = structuredClone(XXX_DATA);

  getAll(): Observable<XxxItem[]> {
    return of(structuredClone(this.data)).pipe(delay(300));
  }

  getById(id: string): Observable<XxxItem | null> {
    return of(structuredClone(this.data.find(x => x.id === id) ?? null)).pipe(delay(200));
  }
}
```

---

## How to use this file

1. Find the pattern that matches your task
2. Copy the HTML + SCSS block exactly
3. Rename `xxx-` prefix to your component's BEM prefix
4. Adjust only: field names, bindings, labels, routes
5. Do NOT add or remove attributes vs. the reference
6. After confirming a new pattern works → add it here
