# Post-Build — Verification Before "Done"

**Source code reading is NOT verification — CSS cascade lies. "Should work" ≠ Done.**

You MUST complete ALL these checks and include evidence in your response before claiming done.

---

## Required commands (in this order)

```bash
# 1. Compile check — must pass with 0 errors
npm run build

# 2. Full pre-commit suite (= audit:all + audit:appearance + audit:ndbx-wrapper)
npm run pre-commit

# 3. File size report
npm run audit:file-size
```

`pre-commit` includes:
- `audit:stage-pattern` — catches stage register-late regressions (FNOL)
- `audit:ac-logic` — Node-side simulator for AC `expectedOutcome`
- `audit:all` — colors / radio-size / imports / any / subscribe / hardcoded-data / formfield-error / wizard-footer

---

## All audit scripts

```bash
# ── Blocking (in pre-commit) ─────────────────────────────────────────────────
npm run pre-commit             # audit:all + audit:appearance + audit:ndbx-wrapper
npm run audit:all              # colors + radio-size + imports + any + subscribe + hardcoded-data + formfield-error + wizard-footer
npm run audit:colors           # no hardcoded hex/rgb in component scss
npm run audit:radio-size       # every <nx-radio> has labelSize attribute
npm run audit:imports          # no cross-feature imports
npm run audit:any              # no TypeScript :any
npm run audit:subscribe        # no .subscribe() in component ts
npm run audit:hardcoded-data   # no inline data arrays in features
npm run audit:appearance       # no appearance="outline" on nx-formfield
npm run audit:ndbx-wrapper     # no bare <input> outside nxInput
npm run audit:formfield-error  # every <nx-error> in <nx-formfield> has nxFormfieldError
npm run audit:wizard-footer    # FNOL steps use <app-wizard-footer> not inline buttons

# ── Fix-forward (NOT in audit:all or pre-commit — pre-existing violations) ───
npm run audit:spacing          # no hardcoded px in padding/margin (~80 pre-existing)
npm run audit:font-size        # no hardcoded px in font-size (~71 pre-existing)

# ── Report-only (no exit 1) ──────────────────────────────────────────────────
npm run audit:file-size        # component file line count vs limits
```

> **Fix-forward rules** (`audit:spacing`, `audit:font-size`): scripts exist for manual use but excluded from `audit:all` and `pre-commit` due to pre-existing violations in legacy files. New code must comply; existing violations are tracked in `CONTEXT.md` Known Violations.

---

## How to interpret results

| Output | Meaning |
|--------|---------|
| Command exits 0, no output | PASS |
| Lines printed | FAIL — each line is a violation with file:line |
| `OVER LIMIT file.html: 213 lines` | File exceeds limit — split before adding more code |

### Existing baseline violations (pre-2026-05-07 — do NOT fix inline with feature work)

These files fail `audit:colors` by design — they predate the token enforcement rule:
- `sections/sections.scss` — 30+ hardcoded hex
- `layout/sidebar/sidebar.scss` — 8
- `layout/navbar/navbar.scss` — 8
- `dashboard/dashboard.scss` — 20+
- `claims/claim-form/claim-form.scss` — 2
- `claims/claim-list/claim-list.scss` — 2
- `claims/claim-detail/claim-detail.scss` — 4
- `app/app.scss` — 1

**When pre-commit fails:** check if the violation is in new code you wrote vs the baseline above. New code violations MUST be fixed. Baseline violations may be ignored for now.

---

## Browser checks (cannot skip)

```bash
npm start   # open http://localhost:4200 at the modified page
```

1. **Console** — DevTools → Console → must show 0 errors, 0 warnings
   - `"Can't bind to 'X'"` = NDBX module missing from component `imports`
2. **DOM** — Right-click a form field → Inspect → verify `<nx-formfield>` wrapper present with underline style
3. **Interactions** — test every interactive element on the page:
   - Dropdowns: open → select → value updates → closes
   - Date pickers: click → calendar opens → pick date → ISO string in form
   - Text inputs: type → form value binds
   - Checkboxes / radios: toggle correctly
   - Buttons: click → correct action fires
   - Validation: submit empty → errors appear
   - Navigation: Back / Next / Cancel all route correctly
4. **DevTools Computed** — for any layout fix, confirm the property you set actually applies (catches `[nxLayout]` inline override trap — see `RUNTIME_OVERRIDES.md`)

---

## Required evidence in response

```
VERIFICATION:
  ✅ build — 0 errors
  ✅ pre-commit — all audits pass (baseline violations only)
  ✅ file-size — [file].html Xlines / .ts Y / .scss Z ✓
  ✅ console — 0 errors
  ✅ interactions — [list what was tested]
  ✅ computed CSS — [the property you fixed = expected value]
```

**If you cannot provide this evidence → state what's blocking you and wait.**

---

## Definition of Done

Done = code written + terminal checks pass + browser evidence + **user confirms visually**.

- "Code looks correct" ≠ Done
- "Theoretically correct" ≠ Done
- Build passes + audits pass — still ≠ Done until user confirms
- Only user confirmation = Done

---

## NDBX compliance checklist (before declaring done)

- [ ] No `appearance="outline"` on any `nx-formfield`
- [ ] No native `<select>`, `<input type="date">`, raw `<input>` outside `nx-formfield`
- [ ] All colors via CSS tokens (`var(--token)`) — no hardcoded hex/rgb in `.scss`
- [ ] No hardcoded px — use NDBX or project tokens (Token Traps in `CONTEXT.md`)
- [ ] Every `<nx-radio>` has `labelSize="small"`
- [ ] Every `<nx-error>` in `<nx-formfield>` has `nxFormfieldError`
- [ ] FNOL step uses `<app-wizard-footer>` (unless on the exception list)
- [ ] Component is `standalone: true`
- [ ] No `subscribe()` in `.ts`
- [ ] No `: any`
- [ ] File sizes within limits: `.ts` ≤ 300 / `.html` ≤ 200 / `.scss` ≤ 250

---

## Accessibility checklist (WCAG 2 Level AA — full rules in `CONTEXT.md`)

### Manual checks (cannot skip)

- [ ] **Keyboard tab through page** — every interactive element reachable, focus indicator visible at each stop
- [ ] **Tab order matches reading order** — no surprise jumps
- [ ] **Icon-only buttons** have `aria-label` (kebab, close ✕, sort toggles, etc.)
- [ ] **Modal traps focus** — open modal, Tab cycles inside it; Esc closes; focus returns to trigger
- [ ] **Toast/banner success messages** wired to `LiveAnnouncer.announce()` — verify NVDA/VoiceOver announces them
- [ ] **Scroll containers** have `tabindex="0"` on the scroll element
- [ ] **No color-only info** — status/priority must also use icon, label, or shape

### Automated checks (recommended)

```bash
# Run axe in browser DevTools or as Playwright/Jasmine integration
# (project does not yet have axe wired — add for new feature work)
```

**Axe Jasmine snippet** (add to component spec when ready):
```ts
import * as axe from 'axe-core';

it('passes a11y checks', async () => {
  const results = await axe.run(fixture.nativeElement);
  expect(results.violations).toEqual([]);
});
```

### High-contrast check (Edge / Windows)

Open page in MS Edge → Windows Settings → Vision → High Contrast → toggle on. Verify:
- [ ] All text remains readable
- [ ] Custom SVGs have visible fill (use `currentColor` or `@media (-ms-high-contrast: active) { fill: windowText }`)
- [ ] Borders + focus indicators stay visible

### Screen reader smoke test

- **macOS:** Cmd+F5 (VoiceOver) → tab through the page → must announce every label, status, and toast
- **Windows (NVDA):** install NVDA → tab through → confirm dynamic content (toasts, banners) is announced

---

---

## /verify-data — Mock Data Integrity Audit

Run when: adding new mock data, changing references between JSON files, or as part of `/post-build` for any data-layer change.

### Commands

```bash
# List all policy IDs
grep -h '"policyNumber"' src/app/core/mock/data/*.json | sort -u

# List all client IDs
grep -h '"clientId"' src/app/core/mock/data/*.json | sort -u

# List all claim IDs
grep -h '"claimId"\|"CLM-"' src/app/core/mock/data/*.json | sort -u

# Check damageTypeKey values
grep -rh '"damageTypeKey"' src/app/core/mock/data/ | sort -u

# Find any non-standard damageTypeKey values
grep -rh '"damageTypeKey"' src/app/core/mock/data/ \
  | grep -v 'material-damage\|financial-loss\|bodily-injury\|liability'
```

### Cross-reference rules

For each JSON file that references IDs from another file:
- `entities-damages.json` keys must match policy numbers in `policies.json`
- `searchable-entities.json` keys must match policy numbers in `policies.json`
- Any `clientId` references must exist in `clients.json`

### Valid `damageTypeKey` values (only these four)

- `material-damage` → buildings, vehicles, marine, equipment, contents
- `financial-loss` → business interruption, revenue, financial instruments
- `bodily-injury` → employees, customers, third parties
- `liability` → third-party liability claims

Cause/event names (Theft, Storm, Fire, Flood) are **NOT** damage categories — they go in `coveredForEvents[]`.

### Report format

```
DATA INTEGRITY REPORT:
  Policy IDs:    [list]
  Client IDs:    [list]
  Claim IDs:     [list]
  damageTypeKey values: [list — flag any not in: material-damage, financial-loss, bodily-injury, liability]

  Cross-references:
    entities-damages.json → policies.json: ✅ all match / ❌ orphans: [list]
    searchable-entities.json → policies.json: ✅ all match / ❌ orphans: [list]

  Issues found: [count] — [list each]
```

---

## When the user confirms a feature works

Immediately ask:
> "Should I add `[file path]` to BLESSED.md as a verified reference implementation?"

A file qualifies as blessed when ALL are true:
- ✅ Renders correctly in browser (confirmed by user)
- ✅ DevTools console shows zero errors
- ✅ All interactions work
- ✅ Passes `npm run audit:all`

**Working code in this repo beats everything else** — not training data, not NDBX docs, not theories about what should work. If it runs without errors in this project, it is the truth.
