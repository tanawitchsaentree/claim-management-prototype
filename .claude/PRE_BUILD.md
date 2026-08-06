# Pre-Build — Before Writing Code

## Rule 0: /pre-build is MANDATORY

For **any** task involving UI, layout, components, or SCSS — answer Q1–Q5 below first.

**Triggers (no exceptions):**
- "fix layout" / "ตำแหน่ง" / "ชิดซ้าย/ขวา" / "align" / screenshot of broken UI
- "add component" / "เพิ่มปุ่ม" / "เพิ่ม element" / "สร้าง component"
- "change SCSS" / "เปลี่ยนสี" / "ระยะห่าง" / "ขนาด"
- Task description contains: button, toolbar, modal, table, form, panel, header, footer, grid, flex

**The process:**
1. Answer Q1–Q5 below in your response — including which blessed file the pattern comes from
2. Wait for "proceed" / "go" / "ได้เลย"
3. THEN write code

**Why:** Self-diagnosis identified failure modes where I skip reading existing patterns and invent from memory. The toolbar incident (3 rounds to fix one alignment), and the `[nxLayout]` padding trap (4+ rounds tweaking values that never applied) — both caused by skipping this. Token waste.

**User shortcuts (act immediately, no questions):**
- `/pre-build first` → stop and run the checklist before any code
- `blessed?` → cite exactly which blessed file + line I'm copying from
- `stop, what pattern?` → pause and identify the pattern source before continuing

---

## Pre-Build Checklist (output this before any code)

```
PRE-BUILD CHECKLIST:
1. Pattern: [blessed file + line] or "no match"
2. Size: ~X lines HTML, ~Y lines TS — under limit / will split into [components]
3. NDBX: NxFormfieldModule, NxInputModule, ... (list all)
4. Constraints: ✓ no appearance="outline", ✓ no floatLabel="always", ✓ default underline, ✓ wrapper if [nxLayout]
5. Data: from [ServiceName.method()] or "mock inline for testing only"
```

### MANDATORY for any layout reorder / add / remove (Q0 — answer FIRST)

Before touching element order, adding sections, or removing blocks — answer these 3 questions in the response:

```
UX JOURNEY CHECK (answer before any layout change):
Q0a. What is the USER'S most frequent action here?
     → [describe: e.g. "Add a colleague to the access list"]
Q0b. What is the user's least frequent / set-once action?
     → [describe: e.g. "Set restriction reason"]
Q0c. Does the CURRENT order put frequent-first, set-once-last?
     → YES → keep order / NO → reorder so frequent action is topmost
```

**Gestalt proximity check (same pass):**
- Does the label sit closer to the content it describes than to adjacent elements?
- If a heading floats equidistant between two groups → it belongs to the group below (reduce gap above heading, increase gap above search/input)

**Why this step exists:** The file-restriction UI was re-ordered 3 times because the search box was placed as a standalone section below the user list. The UX journey analysis (add colleague = frequent, set reason = set-once) immediately reveals: search + user list = primary group at top; reason fields = secondary group below. Six screenshot debug rounds and nx-formfield replacement were needed before this question was asked. Now ask it first.

**Trigger:** ANY task that contains: "add section", "move element", "reorder", "add block", "remove block", "ย้าย", "จัด layout", "เพิ่ม section", "ลำดับ"

### Q1: Is there a blessed file (BLESSED.md) for this pattern?

- **YES** → open it, copy the pattern, adjust bindings only. Cite the file:line.
- **NO** → go to Q2

```bash
# Quick check
grep -i "<keyword>" .claude/BLESSED.md
```

### Q2: Is there any working file in this project doing something similar?

- **YES** → use it as reference. State which file:line.
- **NO** → go to Q3

```bash
# Find similar by selector
grep -rn "<nx-component-name" src/app/features/
```

### Q3: Does NDBX have a documented component for this?

- Check `docs/NDBX_RECIPES.md` first, then `node_modules/@allianz/ng-aquila/<component>/index.d.ts`
- **YES** → use NDBX recipe exactly
- **NO** → stop and ask the user before proceeding

### Q4: Will this trigger a runtime override trap?

Check `RUNTIME_OVERRIDES.md` for directives that write inline styles:
- `[nxLayout]` (any variant) — wrap before `padding-top`/`padding-bottom`
- `<nx-formfield>` — reserves ~20px bottom; ~32px when stacked
- `NxExpertModule` — re-asserted tokens in `styles.scss`

If **YES** → state the override + the workaround in your checklist.

### Q5: Does the change introduce a new token, gap, or pattern?

- **YES + token already exists in NDBX** → use it, cite ndbx.css:line
- **YES + project token exists in `styles.scss`** → use it
- **YES + nothing exists** → stop and ask user. Do not invent.

If you cannot answer any question → **STOP and ask user before proceeding.**

---

## Workflow: Creating a New Page or Component

1. Check if a similar component exists in `shared/` or `features/` — reuse first
2. Check if ng-aquila has it — use ng-aquila over custom (Q3 above)
3. Read 2–3 existing components in this project to match code style
4. Define data model in `core/models/` first
5. Create or extend service in `core/services/` or `core/mock/services/`
6. Build component using ViewModel pattern (`vm$ | async`) or signals
7. Verify in browser before reporting done (see `POST_BUILD.md`)

### Component scaffold (standalone)

```ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
// + NDBX modules per Q3

@Component({
  selector: 'app-feature-name',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, /* NDBX */],
  templateUrl: './feature-name.component.html',
  styleUrl: './feature-name.component.scss',
})
export class FeatureNameComponent {
  // data via inject(Service), signals or vm$ pattern
}
```

### File structure

```
features/<feature>/<component>/
├── <component>.component.ts
├── <component>.component.html
├── <component>.component.scss
└── <component>.component.spec.ts (skeleton ok)
```

### Common scaffolding mistakes

- Forgetting `standalone: true`
- Importing modules at NgModule level instead of component `imports: []`
- Adding component to `app.module.ts` (this project has no NgModule — use `app.config.ts` providers + standalone routes)
- Using `templateUrl` with relative path `'./'` but file in different folder

---

## Implementing from Figma

### Step 1: Get the design

- **Figma Desktop Bridge plugin running?** → use `mcp__figma-console__figma_execute` to scan node tree + tokens
- **Bridge closed?** → ask user to open: Figma desktop → Plugins → Development → Figma Desktop Bridge → Run
- **Static screenshot?** → state which elements are visible vs ambiguous; ask before guessing

### Step 2: Map every element to NDBX

| Figma element | NDBX equivalent | Watch for |
|---------------|-----------------|-----------|
| Text field / input box | `nx-formfield` + `input[nxInput]` | Label always floats (NxExpertModule sets this globally) |
| Dropdown | `nx-dropdown` + `nx-dropdown-item` | No native `<select>` |
| Multi-select / tag select | `nx-multi-select` | Different import than dropdown — same path |
| Date field | `input[nxDatefield][nxInput]` + `nx-datepicker` | Two directives required on input |
| Time field | `nx-timefield` | No formfield wrapper — self-contained |
| Checkbox group | `nx-checkbox` + `(checkedChange)` | Not `(change)` |
| Radio group | `nx-radio` `labelSize="small"` + `[checked]` + `(valueChange)` | Manual checked binding; `labelSize` mandatory |
| Status badge | `app-status-chip` (project custom) | Use token colors, not hardcoded |
| Modal / dialog | `NxDialogService.open()` | `firstValueFrom(ref.afterClosed())` |
| Table | `nxTable` + `nxTableRow` + `nxCell` | Must use NDBX directives |
| Kebab / action menu | `nxContextMenuTriggerFor` + `nx-context-menu` | Per-row pattern |
| Toast / alert banner | `nx-message` with context | Not custom div |
| Spinner / loader | `nx-spinner` | size: small/medium/large |
| Toolbar / context bar | `nx-toolbar` (or div with `--toolbar-background` + `--toolbar-border-bottom-color`) | bg `--ui-02`, height 48px |
| Breadcrumb | `<ol nxBreadcrumb><li nxBreadcrumbItem>` | Auto bold last; color `--text-01` not grey |

### Step 3: Map colors to tokens

| Figma intent | Project token |
|-------------|---------------|
| Primary blue | `var(--interactive-primary)` |
| Text / body | `var(--text-01)` |
| Secondary / muted text | `var(--text-muted)` |
| Border | `var(--ui-04)` |
| Background white | `var(--ui-01)` |
| Background grey (toolbar/secondary) | `var(--ui-02)` |
| Hover overlay | `var(--claim-overlay-hover)` |
| Status: open / in-progress (claim) | `--claim-status-open-bg/color` |
| Status: in-progress (task, amber) | `--task-status-in-progress-bg/color` |
| Priority high | `--claim-priority-high` |

**Never implement Figma hex colors directly.** Map to project tokens. If no token exists → ask.

### Step 4: Spacing

No hardcoded `px` values. Token-first:

```bash
grep -- '--button-\|--spacing-\|--size-\|--layout-' node_modules/@allianz/ngx-brand-kit/css/themes/ndbx.css | head -30
```

If no token exists → ask the user before using a hardcoded value.

### Known Figma bugs in this project

- **Copy-paste title errors:** Figma modal titles sometimes reflect original component, not current usage. Trust the user's description over the Figma title text.
- **Arrow/connector errors:** In FigJam, arrows pointing to wrong elements are common. Confirm target verbally.
- **Inconsistent labels:** Same UI element named differently across screens. Check the most recent screen.
- **Missing states:** Figma may show only the happy path. Ask about error, loading, and empty states.

### Common Figma → code mistakes

- Implementing Figma title text verbatim when it's a copy-paste error
- Adding `appearance="outline"` because Figma shows outlined inputs (this project uses underline)
- Using hardcoded hex from Figma's color panel → map to tokens
- Building custom checkbox/radio when NDBX versions exist

---

## FNOL Step (Wizard) — Required Reading Before Building

**Skill applies when** task contains: "build new FNOL step", "add step to wizard", "implement step-N".

**Read these in order:**
1. `src/app/features/fnol/fnol-shell/fnol-shell.component.html` — wizard shell, sidebar stepper, router-outlet
2. `src/app/features/fnol/steps/step-1-search/step-1-search.component.html` — blessed pattern (header + form)
3. `src/app/features/fnol/_wizard-layout.scss` — shared mixins (`step-page`, `step-header`, `step-footer`, `btn-icons`)
4. `src/app/shared/components/wizard-footer/wizard-footer.component.ts` — mandatory footer

### WizardFooterComponent (MANDATORY)

**Selector:** `<app-wizard-footer>`
**Inputs:** `nextLabel`, `nextDisabled`, `showBack`, `showCancel`
**Outputs:** `(cancel)`, `(back)`, `(next)`

```html
<app-wizard-footer
  (cancel)="onCancel()"
  (back)="onBack()"
  (next)="onNext()">
</app-wizard-footer>

<!-- Submit variant -->
<app-wizard-footer
  nextLabel="Submit claim"
  (cancel)="onCancel()"
  (back)="onBack()"
  (next)="onSubmit()">
</app-wizard-footer>
```

**Hard rule:** Every FNOL wizard step that has Cancel/Back/Next buttons MUST use `<app-wizard-footer>`. Never write inline `nxButton="secondary small"` Back or `nxButton="primary small"` Next in step templates. `audit:wizard-footer` enforces this in `pre-commit`.

**Exceptions** (do NOT use WizardFooterComponent):
- `step-1-search` — has tooltip-wrapped dynamic buttons with conditional state
- `step-skeleton-create` — has spinner inside submit button

### `_wizard-layout.scss` partial

`.step-footer` and `.step-footer-actions` CSS lives inside `WizardFooterComponent`'s own scss (which `@use`s this partial). **Step component scss files must NOT redefine these classes.**

### FNOL-specific common mistakes

- Using `selectedPolicy` only for the guard — client path is also valid
- Adding new step route but forgetting to add to stepper sidebar label list
- Forgetting to register the stage with `FnolStateService` (causes "stage register-late" audit failure)
- Reading FormControl in `computed()` directly — use `toSignal(statusChanges)` (see `CONTEXT.md` Token Traps)

---

## Mock Data — Required Reading Before Adding

**Skill applies when** task contains: "mock data", "new service", "JSON data".

**Read in order:**
1. `src/app/core/mock/services/mock-entities-damages.service.ts` — blessed pattern
2. `src/app/core/mock/README-mock.md` — mock layer architecture

### JSON file rules

- **Location:** `src/app/core/mock/data/` only — never in `features/`
- **Format:** valid JSON, top-level array of typed objects
- **Cross-references:** if a record references an ID in another file, that ID must exist (run `/verify-data` if unsure — see `POST_BUILD.md`)

### Mock service pattern (extends MockBaseService)

```ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import data from '../data/<name>.json';
import type { <Model> } from '../../models';

@Injectable({ providedIn: 'root' })
export class Mock<Name>Service extends MockBaseService {
  list(): Observable<<Model>[]> {
    return this.respond(structuredClone(data as <Model>[]));
  }

  getById(id: string): Observable<<Model> | null> {
    const item = (data as <Model>[]).find(x => x.id === id) ?? null;
    return this.respond(item ? structuredClone(item) : null);
  }
}
```

`structuredClone()` is mandatory — without it, mutations to the returned data leak into the imported JSON, polluting subsequent calls.

### Forbidden in mock

- Hardcoded data arrays in component `.ts` files (use service)
- `console.log` outside `mock-base.service.ts`
- `: any` — define interface in `core/models/`
