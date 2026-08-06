# Audit Baseline — Live Violations Report

> Generated 2026-08-06 from actual audit output — not hand-maintained.
> **Regenerate this file whenever counts change materially: `npm run audit:all` (or, for the full 17-check + fix-forward picture used to build this file, `node scripts/run-audits.mjs <all check names>` plus `npm run audit:spacing` / `npm run audit:font-size`).**
> New code must not add to this list. Existing violations are fixed in dedicated cleanup PRs, not inline with feature work.

---

## Summary — all 17 blocking checks (`npm run pre-commit`)

| Check | Status | Violations |
|---|---|---|
| `audit:colors` | ❌ FAIL | 15 lines |
| `audit:radio-size` | ✅ PASS | 0 |
| `audit:formfield-error` | ❌ FAIL | 2 lines |
| `audit:imports` | ✅ PASS | 0 |
| `audit:any` | ✅ PASS | 0 |
| `audit:subscribe` | ❌ FAIL | 14 lines |
| `audit:hardcoded-data` | ✅ PASS | 0 |
| `audit:status-colors` | ✅ PASS | 0 |
| `audit:date-format` | ✅ PASS | 0 |
| `audit:button-size` | ✅ PASS | 0 |
| `audit:table-empty` | ✅ PASS | 0 |
| `audit:ac-logic` | ✅ PASS | 0 (49/53 ACs; 4 skipped — no `expectedOutcome`) |
| `audit:ac-route-overrides` | ✅ PASS | 0 |
| `audit:stage-pattern` | ✅ PASS | 0 |
| `audit:appearance` | ✅ PASS | 0 |
| `audit:ndbx-wrapper` | ❌ FAIL | 6 lines |
| `audit:wizard-footer` | ✅ PASS | 0 |

**13/17 pass.** 4 real, current violations remain: `audit:colors` (15), `audit:formfield-error` (2), `audit:subscribe` (14), `audit:ndbx-wrapper` (6).

## Fix-forward checks (excluded from `pre-commit`/`audit:all` — run manually)

| Check | Status | Violations |
|---|---|---|
| `audit:spacing` | ❌ FAIL | 282 lines |
| `audit:font-size` | ❌ FAIL | 176 lines |

These are excluded from the blocking gate because the counts are too large to fix inline with feature work — see "Known-violations policy" below.

---

## `audit:colors` — 15 lines

Hardcoded hex/rgb outside `var(--...)`.

| File | Line | Violation |
|---|---|---|
| `src/app/features/sections/sections.scss` | 48 | `background: #e8f0fb !important;` |
| `src/app/features/sections/sections.scss` | 71 | `background: #e8f0fb !important;` |
| `src/app/features/layout/navbar/navbar.html` | 5 | `fill="#003781"` in inline SVG `<path>` |
| `src/app/features/layout/navbar/navbar.scss` | 207 | `box-shadow: -4px 4px 16px rgba(0,0,0,0.12);` |
| `src/app/features/layout/claim-right-strip/claim-right-strip.component.scss` | 39 | `color: #fff;` |
| `src/app/features/fnol/fnol-shell/fnol-shell.component.html` | 5 | `fill="#003781"` in inline SVG `<path>` |
| `src/app/features/fnol/steps/step-summary/step-summary.component.scss` | 229 | `box-shadow: 0 4px 12px rgba(0,0,0,0.08);` |
| `src/app/features/claims/claim-overview/components/manage-access-modal/manage-access-modal.component.scss` | 113 | `box-shadow: 0 4px 12px rgba(0,0,0,0.08);` |
| `src/app/features/claims/claim-overview/claim-overview.component.scss` | 707 | `box-shadow: 0 4px 12px rgba(0,0,0,0.08);` |
| `src/app/features/claims/claim-reference-tabs/claim-reference-tabs.component.scss` | 153 | `box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);` |
| `src/app/features/claims/claim-reference-panel/claim-reference-panel.component.scss` | 145 | `box-shadow: 0 4px 16px rgba(0,0,0,0.14);` |
| `src/app/features/claims/risk-analysis/risk-analysis.component.scss` | 114 | `border: 1px solid #b3d4f0;` |
| `src/app/features/claims/risk-analysis/risk-analysis.component.scss` | 118 | `background: #eaf4fb;` |
| `src/app/features/claims/risk-analysis/risk-analysis.component.scss` | 146 | `border: 1px solid #f5c6cb;` |
| `src/app/features/claims/risk-analysis/risk-analysis.component.scss` | 150 | `background: #fdecea;` |

**Notes:**
- `box-shadow: ... rgba(...)` accounts for 6 of 15 lines — no NDBX token exists for semi-transparent overlay shadows. Treat as exception candidates or add a project token (e.g. `--claim-overlay-shadow` already exists for a similar case — consider extending its use here).
- `risk-analysis.component.scss` (4 lines) — light blue/red accent backgrounds for AI-reasoning info cards, no equivalent status token.
- SVG `fill="#003781"` (2 lines, navbar + fnol-shell) — same brand-blue logo mark in two files; cannot use `var(--token)` directly on SVG `fill`, needs `currentColor` + parent `color`.

## `audit:formfield-error` — 2 lines

Every `<nx-error>` inside `<nx-formfield>` must have `nxFormfieldError`.

| File | Line | Violation |
|---|---|---|
| `src/app/features/sections/edit-entity-damage-modal/edit-entity-damage-modal.component.html` | 19 | `<nx-error>Please select a damage type</nx-error>` |
| `src/app/features/sections/edit-entity-damage-modal/edit-entity-damage-modal.component.html` | 30 | `<nx-error>Please select an instruction status</nx-error>` |

Both in the same file — likely fixable in one small PR.

## `audit:subscribe` — 14 lines

No `.subscribe()` in component `.ts` — use the `async` pipe.

| File | Line |
|---|---|
| `src/app/features/fnol/steps/step-summary/step-summary.component.ts` | 146 |
| `src/app/features/fnol/steps/step-1-search/step-1-search.component.ts` | 120 |
| `src/app/features/fnol/steps/step-1-search/step-1-search.component.ts` | 143 |
| `src/app/features/fnol/steps/step-skeleton-summary/step-skeleton-summary.component.ts` | 66 |
| `src/app/features/fnol/steps/step-skeleton-summary/step-skeleton-summary.component.ts` | 67 |
| `src/app/features/fnol/steps/step-skeleton-summary/step-skeleton-summary.component.ts` | 68 |
| `src/app/features/claims/claim-overview/claim-overview.component.ts` | 172 |
| `src/app/features/claims/claim-overview/claim-overview.component.ts` | 569 |
| `src/app/features/claims/claim-overview/components/manage-access-modal/manage-access-modal.component.ts` | 51 |
| `src/app/features/claims/claim-reference-tabs/claim-reference-tabs.component.ts` | 76 |
| `src/app/features/claims/litigation/components/add-litigation-party-modal/add-litigation-party-modal.component.ts` | 90 |
| `src/app/features/claims/litigation/litigation-detail/litigation-detail.component.ts` | 116 |
| `src/app/features/claims/claim-reference-panel/claim-reference-panel.component.ts` | 129 |
| `src/app/features/claims/risk-analysis/risk-analysis.component.ts` | 121 |

Most of these are `dialogSvc.open(...).afterClosed().subscribe(...)` (modal-result handling) or `.subscribe()` inside a search-debounce chain — converting to `async` pipe requires restructuring the component to expose an observable/signal for the template rather than side-effecting in the subscription. Not a 1-line fix per site.

## `audit:ndbx-wrapper` — 6 lines

Bare `<input>` outside `nxInput`/NDBX wrapper (scope: `src/app/features` only — the script does not walk `src/app/shared`).

| File | Line | Notes |
|---|---|---|
| `src/app/features/layout/navbar/navbar.html` | 20 | Top-chrome search-as-you-type box, no visible `<label>` |
| `src/app/features/approvals/approvals.component.html` | 10 | Filter bar text input, has a sibling `<label>` |
| `src/app/features/approvals/approvals.component.html` | 14 | Filter bar text input, has a sibling `<label>` |
| `src/app/features/approvals/approvals.component.html` | 18 | Filter bar `type="date"` input |
| `src/app/features/claims/claim-notes-panel/claim-notes-panel.component.html` | 47 | Has a sibling `<label>` |
| `src/app/features/claims/claim-overview/claim-overview.component.html` | 275 | File-restriction user-search input — **documented exception** in `.claude/BLESSED.md` (nx-formfield-spacing-trap: reserves ~20px even with `[floatLabel]="never"`), the other 5 are undocumented, silent violations of the "no bare input" rule. |

## `audit:spacing` — 282 lines (fix-forward, not blocking)

`(padding|margin): Npx` hardcoded instead of a spacing token/scale value. 282 lines across the codebase — too large to list individually here; regenerate with:

```bash
grep -rE '(padding|margin):\s*[0-9]+px' src/app --include='*.scss' --include='*.css'
```

## `audit:font-size` — 176 lines (fix-forward, not blocking)

`font-size: N` hardcoded instead of a `--paragraph-0X-font-size` token (excluding icon/stepper/placeholder/stub contexts already whitelisted by the script). 176 lines — regenerate with:

```bash
grep -rE 'font-size:\s*[0-9]' src/app --include='*.scss' | grep -v 'nx-icon\|stepper\|placeholder\|stub'
```

---

## Known-violations policy

- **Fix-forward (`audit:spacing`, `audit:font-size`):** excluded from `pre-commit`/`audit:all` because the counts (282, 176) are pre-existing legacy debt too large to fix inline with feature work without derailing unrelated PRs. New code must still comply — these scripts exist for manual spot-checks and for the eventual dedicated cleanup pass.
- **`audit:colors`, `audit:formfield-error`, `audit:subscribe`, `audit:ndbx-wrapper`:** these ARE blocking (in `pre-commit`), yet still show violations — meaning a clean checkout of `main` fails `pre-commit` today. A reviewer cannot use "pre-commit passed" as a trust signal until these 37 lines are fixed; in the meantime, compare a PR's violation count against this baseline (regenerate before comparing) rather than expecting zero.

## Governance-audit exemptions (`<!-- audit-exempt: reason -->`)

Sites deliberately exempted from `audit:table-empty` / the empty-state consolidation, each with an inline comment explaining why forcing `<app-empty-state>` would be wrong, not because the check is broken:

| File | Reason |
|---|---|
| `src/app/features/fnol/fnol-shell/fnol-shell.component.html:34` | Single-value info popover, not a list — the canonical empty-state's padding/italic is too much chrome for a one-line popover message. |
| `src/app/features/fnol/steps/step-entities-damages/step-entities-damages.component.html:64` | A damage-group only exists when it has entities; the zero-entities case is already handled one level up by an `nx-message` banner. |
| `src/app/features/fnol/steps/step-skeleton-create/step-skeleton-create.component.html:39` | Renders exactly one confirmed broker's row (gated by an `@if` above) — never zero, not a list. |
| `src/app/features/fnol/steps/step-loss-information/step-loss-information.component.html:198` | This modal only opens via "Show all N duplicates," itself only shown when duplicates already exist — the table can never render empty. |
| `src/app/features/fnol/steps/step-1-search/step-1-search.component.html:412` | Same empty-state CTA as `app-empty-state`'s `[action]` slot elsewhere in the file — full-size by the empty-state exemption, not a missed `small`. |
| `src/app/features/claims/claim-reference-tabs/claim-reference-tabs.component.html:60` | Tiny inline popover hint sharing a class with the "Searching…" state — 24px padding is too much chrome for a compact autocomplete dropdown row. |
| `src/app/features/claims/claim-reference-panel/claim-reference-panel.component.html:56` | Same as above (sibling component, same UI pattern). |
| `src/app/shared/components/location-picker/location-picker.component.html:3` | An inline form prompt ("Where did the loss occur?" + CTA), left-aligned and bold — not a passive "no data" message; forcing the canonical shape would misread as a data-absence state. |

No CWB-modal button-size exemption exists in the codebase — `audit:button-size` passes with 0 violations and all 5 buttons in `cwb-location-search-modal.component.html` are already `small`. (An earlier draft of this file referenced one; it did not correspond to anything in the actual repo and has been removed rather than fabricated.)
