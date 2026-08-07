# Audit Baseline — Live Violations Report

> Regenerated 2026-08-07 from actual audit output after the full cleanup pass
> (commits 9b4c44a..39503ff). Not hand-maintained.
> **Regenerate this file whenever counts change materially: `npm run audit:all` (or, for the full 17-check + fix-forward picture used to build this file, `node scripts/run-audits.mjs <all check names>` plus `npm run audit:spacing` / `npm run audit:font-size`).**
> New code must not add to this list. Existing violations are fixed in dedicated cleanup PRs, not inline with feature work.

---

## Summary — all 17 blocking checks (`npm run pre-commit`)

| Check | Status | Violations |
|---|---|---|
| `audit:colors` | ✅ PASS | 0 |
| `audit:radio-size` | ✅ PASS | 0 |
| `audit:formfield-error` | ✅ PASS | 0 |
| `audit:imports` | ✅ PASS | 0 |
| `audit:any` | ✅ PASS | 0 |
| `audit:subscribe` | ✅ PASS | 0 |
| `audit:hardcoded-data` | ✅ PASS | 0 |
| `audit:status-colors` | ✅ PASS | 0 |
| `audit:date-format` | ✅ PASS | 0 |
| `audit:button-size` | ✅ PASS | 0 |
| `audit:table-empty` | ✅ PASS | 0 |
| `audit:ac-logic` | ✅ PASS | 0 (49/53 ACs; 4 skipped — no `expectedOutcome`) |
| `audit:ac-route-overrides` | ✅ PASS | 0 |
| `audit:stage-pattern` | ✅ PASS | 0 |
| `audit:appearance` | ✅ PASS | 0 |
| `audit:ndbx-wrapper` | ❌ FAIL | 2 lines (documented exemptions, see below) |
| `audit:wizard-footer` | ✅ PASS | 0 |

**16/17 pass.** The 2 `audit:ndbx-wrapper` lines are deliberate, documented exemptions (dense-layout search boxes with no label, no validation) — not unaddressed debt. See "Governance-audit exemptions" below for the pattern each one follows.

## Fix-forward checks (excluded from `pre-commit`/`audit:all` — run manually)

| Check | Status | Violations |
|---|---|---|
| `audit:spacing` | ❌ FAIL | 38 lines (documented exemptions, see below) |
| `audit:font-size` | ✅ PASS | 0 |

These are excluded from the blocking gate because they're manual spot-checks, not because violations are expected to remain — `audit:font-size` is now clean, and the 38 remaining `audit:spacing` lines are a documented exemption class (badge/pill/chip padding), not unaddressed debt.

---

## `audit:ndbx-wrapper` — 2 lines (documented exemptions)

Bare `<input>` outside `nxInput`/NDBX wrapper (scope: `src/app/features` only — the script does not walk `src/app/shared`).

| File | Line | Reason |
|---|---|---|
| `src/app/features/layout/navbar/navbar.html` | 21 | Top-chrome search-as-you-type box, no visible `<label>`, fully inert (no binding). Wrapped in `.app-header__search-input-wrap` matching the `co-restrict-search` exemplar pattern below. |
| `src/app/features/claims/claim-overview/claim-overview.component.html` | 275 | File-restriction user-search input. No label, dense layout, uses the canonical `.co-restrict-search__input-wrap` pattern — the reference implementation the navbar fix above was matched against. |

Both follow the `nx-formfield-spacing-trap` skill's documented exception: no label, no inline validation, dense layout where `nx-formfield`'s reserved label/error zone would create visible gaps. Every OTHER bare `<input>` found in this codebase (approvals filter bar ×3, claim-notes-panel Title field) had a visible `<label>` and was properly wrapped in `nx-formfield` instead — see commit `548edcb`.

## `audit:spacing` — 38 lines (documented exemption: pill/badge/chip padding)

`(padding|margin): Npx` hardcoded instead of a spacing token/scale value. All 38 remaining lines share one shape: small vertical padding (1–4px) paired with a `border-radius` on the same rule, sized to fit text inside a pill/badge/chip — not layout spacing. Rounding these to the 4px scale (`--space-xs` = 4px minimum) would visibly enlarge every tag/badge/chip in the app (e.g. `1px 7px` → `4px 8px` roughly doubles a small badge's height). Per user decision during the 2026-08-07 cleanup pass, these are exempted rather than rounded.

Regenerate the full list with:
```bash
grep -rE '(padding|margin):\s*[0-9]+px' src/app --include='*.scss' --include='*.css'
```

Files affected (38 lines across 20 files): `section-closure-modal`, `sections.scss` (×2), `coverage-review-modal`, `entity-detail-panel` (sections, ×2), `dev-helper-banner`, `step-summary`, `step-1-search`, `convert-skeleton-modal`, `dashboard.scss` (×3), `mass-event-edit-modal`, `claim-notes-panel`, `claim-closure-modal` (×2), `claim-overview.component.scss` (×3), `claim-dev-details-modal` (×6), `claim-dev-banner` (×2), `claim-reference-tabs`, `claims-list`, `claim-reference-panel` (×2), `financial-overview`, `status-chip`, `cwb-location-search-modal`.

All genuine layout spacing (card padding, section gaps, row padding — 245 of the original 282 lines) was tokenized to a new `--space-xs` through `--space-5xl` scale in `src/styles.scss` (extends `.claude/SPACING.md`'s 4–32px scale with 40/48/64px, since those values repeat consistently in FNOL wizard footers and empty-states). See commit `79b0afd`.

---

## Known-violations policy

- **`audit:spacing`:** the 38 pill/badge/chip padding lines above are a permanent, documented exemption class — not legacy debt pending cleanup. New pill/badge/chip components may use literal small padding values paired with `border-radius` following this same pattern; new *layout* spacing (card insets, section gaps, row padding) MUST use the `--space-*` token scale in `src/styles.scss`.
- **`audit:font-size`:** clean — 0 violations. Every literal font-size px value maps to a typography or icon-size token (see `9b4c44a`).
- **`audit:ndbx-wrapper`:** the 2 remaining lines are a documented, narrow exception (dense search box, no label, no validation) per the `nx-formfield-spacing-trap` skill — not silently ignored debt.
- **All other blocking checks (`audit:colors`, `audit:radio-size`, `audit:formfield-error`, `audit:imports`, `audit:any`, `audit:subscribe`, `audit:hardcoded-data`, `audit:status-colors`, `audit:date-format`, `audit:button-size`, `audit:table-empty`, `audit:ac-logic`, `audit:ac-route-overrides`, `audit:stage-pattern`, `audit:appearance`, `audit:wizard-footer`):** zero violations, zero exemptions. A clean checkout of `main` now passes `pre-commit` at 16/17 with the only "failure" being the two documented `audit:ndbx-wrapper` exemptions above.

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
| `src/app/shared/components/location-picker/location-picker.component.html:3` | An inline form prompt ("Where did the loss occur?" + CTA), left-aligned and bold — not a passive "no data" message; forcing the canonical shape would misread as a data-absence state. |

No CWB-modal button-size exemption exists in the codebase — `audit:button-size` passes with 0 violations and all 5 buttons in `cwb-location-search-modal.component.html` are already `small`.

---

## Cleanup pass history (2026-08-07)

Full zero-violation cleanup completed across 6 categories, one commit per category, in safest→riskiest order:

| Category | Commit | Count | Result |
|---|---|---|---|
| 1. font-size px | `9b4c44a` | 176 | 0 remaining |
| 2. hardcoded colors | `9adf5f2` | 15 | 0 remaining |
| 3. spacing px | `79b0afd` | 282 | 38 remaining (documented pill/badge exemption) |
| 4. bare `<input>` | `548edcb` | 6 | 2 remaining (documented dense-layout exemption) |
| 5. missing `nxFormfieldError` | `95119b0` | 2 | 0 remaining |
| 6. `.subscribe()` in components | `39503ff` | 14 | 0 remaining |

Live counts at cleanup start differed materially from this file's prior version (font-size 176 vs stated 27, spacing 282 vs stated 156) — the prior baseline had gone stale. Always regenerate from live audit output before trusting a violation count.
