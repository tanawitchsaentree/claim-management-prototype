# New Page Prompt Template

Copy this template when asking Claude to build a new page or feature. Fill in the `[...]` placeholders.

---

## Task: Build [Page Name] page

### What I want

[One paragraph describing what the page does — its purpose, who uses it, what actions they take.]

### Route

`[/feature/route-path]`

### Data model

The component needs these data types (already defined in `core/models/` — read them before starting):

- `[InterfaceName]` in `src/app/core/models/[file].ts`
- [add more as needed]

If any interface is missing, create it in `core/models/` first.

### Service

Use `[ServiceName]` from `src/app/core/services/[service].ts`.
- Method to call: `[methodName()]` returning `Observable<[Type]>`
- If the service method doesn't exist yet, add it (and the mock implementation in `core/mock/services/`).

### Layout

[Describe the layout: single column, two-column, sections, cards, table, etc. Reference Figma if available.]

### Form fields needed

| Field | NDBX component | Required? | Options source |
|-------|----------------|-----------|----------------|
| [field name] | [e.g. `input nxInput`] | [yes/no] | [hardcoded / from service] |
| [field name] | [e.g. `nx-dropdown`] | [yes/no] | [lookupSvc.getX()] |

### Validation rules

- [field]: [rule, e.g. "required", "max 500 chars", "must not be future date"]
- [field]: [rule]

### Actions

| Button | Behavior |
|--------|----------|
| Cancel | Navigate to `[/route]` |
| Back | Navigate to `[/route]` |
| Next / Submit | Validate → navigate to `[/route]` or call `service.save()` |

### Files to create

```
src/app/features/[feature]/[component]/
  [component].component.ts
  [component].component.html
  [component].component.scss
```

If any shared component needs to be extracted: `src/app/shared/components/[name]/`

---

## Mandatory steps Claude must follow (do not skip)

1. **Check NDBX first** for every form field — run `ls node_modules/@allianz/ng-aquila/` and confirm component exists before writing HTML.
2. **Read `docs/NDBX_RECIPES.md`** for verified working patterns in this project.
3. **No `appearance="outline"`** — `expert.css` is not loaded. Use default underline appearance.
4. **No hardcoded hex/rgb/px** — use `var(--token)`. Grep `ndbx.css` to verify token names.
5. **ViewModel pattern** — `vm$ | async` in template, `combineLatest` in `ngOnInit`.
6. **Standalone component** — `standalone: true`, no NgModule.
7. **Reactive forms only** — no `ngModel`.
8. **Run `npm run audit:all`** before reporting done.
9. **Open browser** and verify rendering before reporting done.

---

## Reference files (read these before writing any code)

```bash
# Verified working patterns
docs/NDBX_RECIPES.md

# Existing working page to match code style
src/app/features/fnol/steps/step-1-search/step-1-search.component.ts
src/app/features/fnol/steps/step-1-search/step-1-search.component.html

# Loss-information page (datepicker, multi-select, checkbox, switcher examples)
src/app/features/fnol/steps/step-loss-information/step-loss-information.component.ts
src/app/features/fnol/steps/step-loss-information/step-loss-information.component.html

# Model definitions
src/app/core/models/

# Mock lookup data
src/app/core/mock/services/mock-lookup.service.ts
src/app/core/mock/data/lookups.json
```
