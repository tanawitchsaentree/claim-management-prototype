# Modal Width Rule

**Read before opening any dialog with `NxDialogService.open()`.**
Canonical width scale. Pick the tier by modal *content type* — never invent a number.

---

## 4-Tier Scale

| Tier | Width | Use for | Examples |
|------|-------|---------|----------|
| **XS** | `440px` | Confirmation / single-action / one short input | ConfirmDialog, discard warning, VerifierName |
| **SM** | `600px` | Compact form, diff/summary list, short field set | LossInfoConfirm (diff), StartInvestigation |
| **MD** | `800px` | Standard multi-field form, moderate table | MassEventEdit, EditRole, single-section forms |
| **LG** | `960px` | Search + results table, multi-column data, anything with a wide table | BrokerSearch, AddParty, AddLitigationParty, ConvertSkeleton, duplicates |

Always pair width with `maxWidth: '92vw'` so it never exceeds the viewport on small screens.

```ts
// XS
this.dialogSvc.open(ConfirmDialogComponent, { data, width: '440px', maxWidth: '92vw' });
// SM
this.dialogSvc.open(LossInfoConfirmModalComponent, { data, width: '600px', maxWidth: '92vw' });
// MD
this.dialogSvc.open(MassEventEditModalComponent, { data, width: '800px', maxWidth: '92vw' });
// LG — anything with a search + results table
this.dialogSvc.open(BrokerSearchModalComponent, { data, width: '960px', maxWidth: '92vw' });
```

---

## How to choose

1. **Does it have a results/data table?** → **LG (960)**. Tables need horizontal room; squeezing them causes the "bีบ" cramped look. If columns still crowd at 960, let the table scroll horizontally inside the modal (`overflow-x: auto` wrapper) — do NOT widen past 960.
2. **Is it a form with several fields (multi-column grid)?** → **MD (800)**.
3. **Is it a short form, a diff list, or a summary?** → **SM (600)**.
4. **Is it a yes/no confirmation or a single input?** → **XS (440)**.

---

## What NOT to do

- Never use an off-scale width (no 720, 900, 1040). Round to the nearest tier.
- Never omit `maxWidth: '92vw'`.
- Never widen a modal past 960 to fit a table — scroll the table instead.
- Never set width in component SCSS via `:host` — set it at the `open()` call so it's visible and consistent.

---

## Height — ALWAYS handled, never overflow the viewport

Two valid height strategies. Pick ONE per modal and use it everywhere that modal opens:

### A. Standard centered modal (default)
Component `:host` uses `@include modal.shell` which sets `max-height: calc(100vh - 112px)`.
The body (`@include modal.body`) is `flex: 1; overflow-y: auto` so it scrolls internally;
header + footer stay sticky. **This fits a 14" notebook (~800px) automatically.**
→ Open with just `{ data, width: '<tier>', maxWidth: '92vw' }`.

### B. Bottom-sheet (tall forms with many fields)
For long forms (e.g. MassEventEdit) use the `me-edit-modal-panel` panelClass — full-height
slide-up sheet anchored to the bottom, defined in `styles.scss`.
→ Open with `{ data, panelClass: 'me-edit-modal-panel' }` — **no width/maxWidth** (the panel controls size).

**CRITICAL:** a component's SCSS is written for ONE strategy. If the component's styles assume
`height: 100%` (bottom-sheet), you MUST open it with `panelClass: 'me-edit-modal-panel'` everywhere.
Opening the same component with a plain `width` (strategy A) breaks its height → overflow.
This was the MassEventEdit bug: admin used panelClass, claim-overview used `width: 800px` → overflow.

---

## Popover → modal: close the popover first

If a "View details" link inside an `nx-popover` opens a modal, **close the popover in the same click**
or it stays open behind/over the modal:
```html
<a (click)="myTrigger.close(); openTheModal()">View full details →</a>
```
Bind a trigger ref `#myTrigger="nxPopoverTrigger"` on the trigger button, and keep the trigger +
`<nx-popover>` inside the SAME `@if` block so the ref is in scope.

---

## Current inventory (post-standardisation)

| Modal | Tier | Width |
|-------|------|-------|
| BrokerSearchModal | LG | 960 |
| AddPartyModal | LG | 960 |
| AddLitigationPartyModal | LG | 960 |
| ConvertSkeletonModal | LG | 960 |
| duplicatesModal | LG | 960 |
| MassEventEditModal | MD | 800 |
| LossInfoConfirmModal | SM | 600 |
| StartInvestigationModal | SM | 600 |
| EditRoleDialog | SM | 600 |
| ConfirmDialog | XS | 440 |
| LossInfoDiscardModal | XS | 440 |
| VerifierNameModal | XS | 440 |
