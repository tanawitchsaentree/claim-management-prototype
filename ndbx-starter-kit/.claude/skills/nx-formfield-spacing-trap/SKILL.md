---
name: nx-formfield-spacing-trap
description: >
  Use when adding inputs to dense layouts with @allianz/ng-aquila (NDBX) and
  spacing looks wrong — oversized gaps above/below inputs not explained by any
  CSS margin or padding. The cause is nx-formfield's internal label/error zone
  reservation. Do NOT trigger for normal form fields that legitimately need
  floating labels or inline validation messages.
---

> **Applies to:** `@allianz/ng-aquila ^21.x` (NDBX)
> **Last verified:** @allianz/ng-aquila 21.8.0, 2026-07
> **Re-audit trigger:** upgrading to a new major version of `@allianz/ng-aquila`

---

## STEP 0 — Version probe (do this first, every time)

Read `package.json` before anything else:

```bash
grep "ng-aquila" package.json
```

| Result | Action |
|--------|--------|
| `^21.x` or lower | Proceed — bug confirmed in this range |
| `^22.x` or higher | **Verify first** — run Step 1 symptom check. If symptom is absent, use `nx-formfield` normally. Only proceed to Step 3 if symptom is still present. Update the Variant Registry below with findings. |
| Not found | This is not an NDBX project — see [Non-NDBX frameworks](#non-ndbx-frameworks) |

---

## STEP 1 — Symptom check (confirm this is actually the trap)

Before touching any code, verify the symptom matches. Open DevTools → inspect the input:

**Confirm ALL of:**
- [ ] An empty `.nx-formfield__label-area` block is present in the DOM
- [ ] That block has non-zero height (inspect computed styles)
- [ ] Removing it in DevTools closes the gap

**If any check fails:** this is NOT the spacing trap. Stop. The gap has a different cause — check parent padding, grid row gaps, or margin collapsing instead. Do not apply this pattern.

**If all checks pass:** proceed to Step 2.

---

## STEP 2 — Project convention detection

```bash
# Check for existing bare-input wrapper pattern
grep -r "input-wrap\|__input\b\|bare-input\|search-wrap" src/ --include="*.scss" -l

# Check for a hard no-bare-input rule in project docs
# (adjust path to wherever your project keeps its coding rules/conventions)
grep -r "nx-formfield\|bare.*input\|raw.*input" .claude/ CLAUDE.md docs/ --include="*.md" -l 2>/dev/null
```

> **Note:** If your project doesn't use Claude Code conventions (no `.claude/` directory), skip the second grep and check your project's coding-standards doc manually.

| Detected state | Branch |
|----------------|--------|
| **Existing wrapper pattern found** | Match that exact pattern — use its class names, height, border style. Do NOT introduce a new wrapper convention. Skip to Step 3b. |
| **No existing pattern + no rule** | Introduce wrapper using Step 3a template |
| **Hard no-bare-input rule exists** | Flag to user: "Project rule conflicts with this pattern. Confirm exception before proceeding." Do not apply silently. If user confirms: whitelist this component in the project's rule doc, then proceed to Step 3a. |
| **Rule exists but already has exceptions** | Check if this component qualifies under existing exception conditions. If yes, proceed to Step 3a. |

---

## STEP 3a — Apply: introduce new wrapper

Only reach here if Step 2 found no existing pattern.

```html
<!-- ❌ Before -->
<nx-formfield>
  <input nxInput [formControl]="searchControl" placeholder="Search…" />
  <nx-icon nxFormfieldSuffix name="search"></nx-icon>
</nx-formfield>

<!-- ✅ After — replace BEM prefix with your component's own prefix -->
<div class="[prefix]-wrap">
  <div class="[prefix]-wrap__input">
    <input
      class="[prefix]-wrap__field"
      type="text"
      [formControl]="searchControl"
      placeholder="Search…" />
    <nx-icon name="search" class="[prefix]-wrap__icon"></nx-icon>
  </div>
</div>
```

```scss
/* Replace [prefix] with your component's BEM prefix.
   Replace token values (var(--...)) with your project's design tokens,
   CSS custom properties, or hard-coded values as appropriate. */
.[prefix]-wrap {
  position: relative;
  width: 100%;

  &__input {
    display: flex;
    align-items: center;
    border: 1px solid var(--border-color, #c8c8c8);   /* your border token */
    border-radius: 4px;
    padding: 0 12px;
    height: 40px;
    background: var(--input-bg, #ffffff);              /* your input background token */

    &:focus-within {
      border-color: var(--focus-color, #007aff);       /* your focus/brand token */
      outline: 2px solid var(--focus-color, #007aff);
      outline-offset: 0;
    }
  }

  &__field {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 14px;                                   /* or your body font-size token */
    color: var(--text-primary, #333333);               /* your primary text token */
    &::placeholder { color: var(--text-muted, #767676); }
  }

  &__icon {
    color: var(--text-muted, #767676);                 /* your muted/secondary text token */
    flex-shrink: 0;
  }
}
```

---

## STEP 3b — Apply: match existing wrapper

Use the class names, height, border, and focus-ring style from the existing pattern found in Step 2. Do not copy the template above — it would create a second convention.

---

## STEP 4 — Post-apply verification (run without waiting for user)

After applying, verify in DevTools before reporting done:

- [ ] `.nx-formfield__label-area` is no longer in the DOM for this input
- [ ] Gap above/below input matches the intended layout spacing
- [ ] Focus ring appears on the wrapper `div`, not the raw `input`
- [ ] No console errors about missing `nxInput` directive or similar
- [ ] Other inputs in the same form are unaffected

**If any check fails:** go to Step 5.

---

## STEP 5 — Failure recovery

If the gap persists after applying, answer these diagnostic questions before trying anything else:

| Question | If yes → |
|----------|----------|
| Is the input inside another `nx-formfield` further up the DOM? | Fix the outer formfield first — nested formfields stack reserved zones |
| Is the gap coming from a `gap` on the parent flex/grid container? | Adjust parent `gap`, not the input wrapper |
| Does an ancestor element have inline `padding` written by a layout directive (not a CSS class)? | Inspect the ancestor's `style` attribute in DevTools — remove or override that inline padding |
| Does the project use an expert/dense theme module that overrides component sizing globally? | Check if a theme class on `<body>` or a root module is setting `--formfield-*` custom properties — those affect reserved zone height |
| Is the remaining gap exactly equal to a sibling's `margin-bottom`? | Margin collapsing between siblings — not a formfield issue, adjust sibling margins |

If none of these explain it: escalate to user with a DevTools screenshot showing computed styles on the gap element. Do not guess further.

---

## When to use / When NOT to use

**Use this pattern when ALL of:**
- Input has no label
- Input has no inline validation error message
- Input is in a dense layout where reserved space causes visible gaps
- Input is not part of a validated form

**Do NOT use when ANY of:**
- A label is needed — keep `nx-formfield`, the spacing is correct
- Inline error messages are needed — keep `nx-formfield`
- The project's design system audit tool will flag bare inputs as a violation
- You are unsure — keep `nx-formfield` and accept the spacing

---

## Relationship to the 'no bare input' rule

This pattern is a **narrow exception** to the common NDBX rule "native `<input>` must always be in `nx-formfield`."

Exception protocol:
1. All four "when to use" conditions must be met
2. Whitelist this specific component in the project's rule doc with a comment explaining why
3. Never apply silently if a hard rule exists
4. One exception per component — do not cascade the exception to other inputs in the same file

---

## Non-NDBX frameworks

Same root cause exists in other component libraries. Detection differs:

| Library | Internal reserved zone | Detection |
|---------|----------------------|-----------|
| Angular Material | `mat-form-field` — `mat-form-field-subscript-wrapper` | Inspect for empty subscript wrapper |
| PrimeNG | `p-field` wrapper | Inspect for empty `.p-field` padding |
| Any custom design system | Look for always-rendered label/hint/error slots | Inspect computed height of empty siblings |

If confirmed: same fix applies — replace the wrapper with a plain `div`. Adapt class names to the project's convention.

---

## Variant Registry

**Living table — update this when a new case is encountered in any project.**

When to write back: after applying in a project where the symptom, fix, or detection differed from the base pattern above — add a row and note what was different.

| Date | Project | ng-aquila version | Variant | Outcome |
|------|---------|-------------------|---------|---------|
| _(add row when you apply this in a project)_ | — | — | — | — |

---

## Eval status

- **First confirmed in:** `@allianz/ng-aquila` 21.8.0 (2026-07) — search input in card body, no label, dense layout
- **Tested cross-project:** NOT YET
- Before relying on this in a new project: run Step 1 symptom check, verify the symptom is present, add a row to the Variant Registry with the result
