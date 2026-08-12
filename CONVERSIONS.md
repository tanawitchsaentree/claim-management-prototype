# Ticket Conversions

Append-only log of ticket → JSON conversions. Newest at top. Each entry should be terse — link to ticket file + capture decisions that aren't visible from `git diff` alone.

---

## 2026-08-06 — Fix stale `closedSections` fixtures in closure.json / ready-to-close.json

- **Source:** collaboration-readiness audit flagged 9 `audit:ac-logic` failures, all `closedSections` count mismatches
- **Root cause:** commit `26c6c56` ("remove duplicate sections from mock data") cut `CLM-2024-001`'s section count in `sections.json` from 6 to 4 (removed SEC-004, SEC-005 as duplicates). `closure.json` and `ready-to-close.json` were never updated to match — their `expectedOutcome.closedSections` values, and two `ready-to-close.json` UI-text strings ("all 6 sections", "6/6 Closed"), still assumed 6 total sections.
- **Fix:** `closure.json` — AC-01/04/05/06/07 (`SEC-001: Closed` override, 3 of 4 sections default-closed + 1 flipped = 4 closed) `closedSections` 6→4; AC-02/03 (3 sections forced Open, 1 remains closed) `closedSections` 3→1. `ready-to-close.json` — AC-01/02 (all 4 sections forced closed) `closedSections` 6→4, plus the two literal "6 sections"/"6/6 Closed" text strings → "4 sections"/"4/4 Closed".
- **Not touched:** everything else in both tickets (openSections, canClose, buttonEnabled, tooltipContains, closedByName, closureReason) was already correct — only the closedSections arithmetic was stale.
- **Audit result:** `audit:ac-logic` 53 ACs, 49 ✅ / 0 ❌ / 4 skipped (was 40 ✅ / 9 ❌ / 4 skipped).

---

## 2026-07-24 — BMPCC-241 update (Notifier — remove Internal; add Parties + Location steps)

- **Source:** verbal brief (UI/UX description, Marlene's scenario) — orphan claim flow gaps: internal staff should never appear as notifier; Parties and Location were missing entirely, only Loss→Summary existed
- **Module:** FNOL — orphan/skeleton claim path (`/fnol/skeleton-*`)
- **Changes:**
  1. **Notifier — removed "Internal":** `step-skeleton-create.component.{ts,html}` — `NotifierType` now `'broker' | 'insured'` only; removed the Internal radio, its free-text field, restore-from-existing branch, and payload field. Cascaded removal of `internalNotifier` from `SkeletonFormValue` (`fnol-form.model.ts`), `CreateSkeletonData` (`skeleton-claim.model.ts`), and the Notifier review card in `step-skeleton-summary.component.{ts,html}`.
  2. **New step — Parties:** `step-skeleton-parties/` (new component, flat party list — no claim/section tree since there's no policy to hang a hierarchy off). Starts empty; on `ngOnInit` seeds the broker selected on the notifier screen as the first party (once, dedup by name). "Add party" reuses `AddPartyModalComponent` unmodified (its `policyNumber`/`targetClaimId` fields are already just pass-through, never read internally — confirmed before reusing). Not mandatory — `onNext()` has no gating. Added `getOrphanParties/addOrphanParty/removeOrphanParty/updateOrphanParty/resetOrphanParties` to `MockPartiesService` (flat array, keyed `claimId: 'ORPHAN'`, separate from the policy-keyed cache used by the happy path).
  3. **New step — Location:** `step-skeleton-location/` (new component) — extracted the "Locations of loss" card that already lived inside `step-skeleton-create` into its own stepper step. Reuses `LocationPickerComponent` with `[policyNumber]="null"`, which was already routing straight to manual entry (no contract-location search) — no component changes needed, just relocation.
  4. **Stepper + routing:** `SKELETON_PATH_STEPS` in `fnol-state.service.ts` grew from 2 → 4 steps: Loss → Parties → Location → Summary. Added `/fnol/skeleton-parties` and `/fnol/skeleton-location` routes. Rewired every `onNext()`/`onBack()` in the chain accordingly.
  5. **Dev banner:** added `fnol-skeleton-parties` / `fnol-skeleton-location` to `PreconditionPage` + `pageRoute()` mapping so tickets can link directly into the new steps.
- **Ticket sync:** `bmpcc-241.json` — AC-01 (no Internal option), AC-02 (4 steps not 2), AC-03 (Next → Parties, not Summary), AC-04 (Summary shows Parties card too) all rewritten to match; added AC-05 (Parties: empty-start/broker-carryover/add-party/not-mandatory) and AC-06 (Location: manual-only, no contract option). ACs 51→53.
- **Audit result:** `audit:ac-logic` 53 ACs, 40 ✅ / 9 ❌ (pre-existing `closedSections` mismatches in unrelated closure tickets, confirmed present before this change) / 4 skipped. `audit:stage-pattern`, `audit:ac-route-overrides`, `audit:wizard-footer` all pass.

---

## 2026-07-13 — CHAMP-PRECLOSURE-CHECKLIST (Pre-closure Checklist — Always-clickable Close Claim)

- **Source:** verbal brief — replace disabled+tooltip button with always-clickable button opening checklist pop-up consistent with section closure UX
- **Module:** Claims — `/claims/:id/overview`, `ClaimClosureModalComponent`
- **Changes:**
  - `claim-overview.component.html` — 3-branch button (loading/disabled+tooltip/primary) → single primary button, disabled only while `closureCheck() === null`
  - `claim-overview.component.ts` — removed `closureTooltip()` method
  - `claim-closure-modal.component.ts` — Step 1 renamed to "Pre-closure Checklist"; replaced free-text blockers list with 7 derived conditions (`CLOSURE_CONDITIONS`); `ngOnInit` always starts at step 1 (no skip to step 2); added `isConditionCleared()`/`blockerLabelFor()` helpers; removed `checklistItems`/`checklistChecked`/`checklistAllDone`/`toggleChecklistItem`; step flow now 1→2→3 (was 1=blockers, 2=checklist, 3=reason, 4=confirm)
  - `claim-closure-modal.component.html` — Step 1 rewritten as 7-row condition list (check-circle-o / exclamation-triangle-o icons, Clear/Blocked badges); Steps 2/3 absorb old 3/4
  - `claim-closure-modal.component.scss` — replaced blocker/checklist CSS with `.ccm-condition-*` classes; removed stale `.ccm-checklist`/`.ccm-blocker-*` styles
- **Audit result:** 50 ACs, 47/47 ✅ (2 new ACs skipped — runtime-only, expected)

---

## 2026-07-13 — CHAMP-NO-LOSS-LOC (Entities & Damages — Handling No Loss Location Selected)

- **Source:** verbal brief — 1 AC: no crash / no multi-limit list when lossLocation is empty
- **Module:** FNOL — `/fnol/entities-damages`
- **New page enum:** `fnol-entities-damages` → `/fnol/entities-damages` — added to `PreconditionPage`, `pageRoute()`, PROJECT.md
- **Code change:** `hasLossLocation` getter added to `StepEntitiesDamagesComponent` and `EntityDetailPanelComponent`; both gate `entity.limits` display on `lossLocation.locations.length > 0`. `ngOnChanges` currency parse also gated.
- **No new ScenarioOverrides entity:** `fnolStateOverride.selectedPolicy` is sufficient — lossLocation defaults to `{ locations: [] }` on `MockStateService.reset()`, so no explicit empty-location override needed.
- **Audit result:** 47/47 ✅ (AC-01 skipped — runtime-only, expected)

---

## 2026-07-13 — CHAMP-CLOSE-SECTION (Close Section — Pre-condition Validation & Lifecycle)

- **Source:** verbal brief — "Close Section" feature with 7 hard blockers, confirmation modal, closureDate persistence
- **Module:** Claims — `Sections` page, `SectionClosureModalComponent`, `ClaimClosureService`
- **File:** `public/tickets/close-section.json` (new)
- **ACs authored:** 5 (done: 5, partial: 0, todo: 0)
- **Deviations:**
  - **AC button-disabled:** Brief says "button must remain disabled until all blockers are resolved." Implementation: button always opens the modal; modal step 1 shows blockers with only Cancel if any blocker exists. Same guard, modal-based. Consistent with `bmpcc-14434` pattern (sign-off implicit). Marked `done`.
  - **AC checklist step:** Brief says "confirmation modal requiring mandatory Closure Reason." Implementation has an additional pre-closure checklist (step 2 of 3) before the reason dropdown. Matches AC-04 of `bmpcc-14434` which is already signed off.
  - **Bills / Reports blockers:** Brief lists "Bills not yet received" + "Final reports not completed" as hard blockers. These are absent from `SectionBlockers` model — no `hasPendingBills` / `hasIncompleteReports` flags exist. Cannot mark done. Not included in this ticket — require a separate model + service sprint. Track as `todo` follow-up.
- **Schema changes:** none — `sectionBlockers` mutation entity already exists (v2.2)
- **Files touched:** 2 (created `public/tickets/close-section.json`; updated `public/tickets/index.json`)
- **Pre-existing audit fixes also applied in this session:**
  - `closure.json` — fixed `targetClaim` (`CL-2025-001` → `CLM-2024-001`); rewrote stateOverrides for AC-01/03 (base tasks are now all `done` — must explicitly override to pending); corrected `closedSections` counts (CLM-2024-001 has 6 sections, not 3)
  - `bmpcc-14435.json` AC-01 — dropped `canClose`/`buttonEnabled` assertions (litigation deep-check is runtime-only via `MockLitigationService`; not simulatable in Node); replaced with runtime-only keys `claimStatus`/`activityLogged`
  - `bmpcc-14437.json` — fixed `targetClaim` (`CL-2025-001` → `CLM-2024-001`); replaced non-schema `stateOverrides` keys (`claimId`, `sectionId`, `scenario`, `paymentId`) with proper `sectionBlockers` + `paymentStatuses` entities
  - `bmpcc-14434.json` AC-04 — replaced `canClose`/`buttonEnabled` (claim-level metric; misleading for a section-level AC) with `sectionBlockers` + `sectionStatus` (runtime-only) assertions
- **Verification:** `npm run audit:ac-logic` → 47/47 ✅ (was 31/42 before fixes)

---

## 2026-06-16 — BMPCC-14435 Cross-domain closure validations — Litigation & Reserves deep check

- **Source:** BMPCC-14435 audit findings → BUILD task
- **Module:** Claims — `ClaimClosureService`, `claim-closure-modal`
- **Files touched:** 7
  - `src/app/core/services/claim-closure.service.ts`
  - `src/app/core/mock/services/mock-reserves.service.ts`
  - `src/app/core/mock/data/litigations.json`
  - `src/app/features/claims/claim-overview/components/claim-closure-modal/claim-closure-modal.component.ts`
  - `src/app/features/claims/claim-overview/components/claim-closure-modal/claim-closure-modal.component.html`
  - `src/app/features/claims/claim-overview/components/claim-closure-modal/claim-closure-modal.component.scss`
  - `public/tickets/bmpcc-14435.json` (new)
  - `public/tickets/index.json`
- **Changes:**
  1. **Litigation deep check (BMPCC-14435):** `validateBlockers()` now calls `MockLitigationService.search({ claimId, status: 'In progress' })` via `forkJoin`. If results.length > 0 → blocker pushed with real count. Falls back to `hasActiveLitigation` flag only if query returns empty but flag is set.
  2. **Reserves deep check (BMPCC-14435):** `validateBlockers()` calls `MockReservesService.getReservesForPolicy(claim.policyNumber)`. Open reserve lines (amount > 0) → blocker with count + total EUR amount. Falls back to `hasOpenReserves` flag.
  3. **Mock data — litigation:** Added 2 "In progress" litigation entries for `CLM-2024-001` (`CLM-2024-001-LIT-1`, `-LIT-2`) so AC-01 fires without any state override. Existing `123456.1-LIT-1` preserved.
  4. **Mock data — reserves:** Added `POL-2023-010` to `POLICY_SEEDS` in `MockReservesService` so CLM-2024-001's policy generates seeded reserve lines. Reserve total fires from `buildFromSeed()` — no state override needed for demo.
  5. **Blocker labels enriched:** All labels now include count inline (e.g. "2 active litigation case(s) must be resolved"). Removed redundant `b.count` prefix in template — label carries the number.
  6. **Navigation links:** Added `onViewLitigation()` → navigates to `/claims/:id/litigation` (real route). "Go to Reserves" rendered but disabled (muted + cursor:not-allowed + title tooltip) — `/claims/:id/financial` redirects to overview, no dedicated reserves route exists. Remaining 6 flag-only domains show italic "Feature not available" text only.
  7. **Demo ticket `bmpcc-14435.json`:** 3 ACs — AC-01 (litigation only), AC-02 (reserves + provider flag), AC-03 (all three simultaneously). AC-01 and AC-03 need no `overviewPatch` — real data fires.
- **Domain wiring status (as of 2026-06-16):**
  - ✅ **Litigation** — wired to `MockLitigationService.search()`, navigation link live
  - ✅ **Reserves** — wired to `MockReservesService.getReservesForPolicy()`, count + amount shown
  - ⬜ **Payments** — flag-only (`hasOpenPayments`); no `MockPaymentsService` exists yet
  - ⬜ **Recovery** — flag-only (`hasActiveRecovery`); no `MockRecoveryService` exists yet
  - ⬜ **Deductible** — flag-only (`hasOpenDeductible`); no service yet
  - ⬜ **Provider** — flag-only (`hasActiveProvider`); no service yet
  - ⬜ **Bills** — flag-only (`hasUnpaidBills`); no service yet
  - ⬜ **Reports** — flag-only (`hasIncompleteReports`); no service yet
  - Future PI: each ⬜ domain requires model + mock service + mock data + wire into `validateBlockers()` — ~M effort per domain.
- **Verification:** `npm run build` ✓ (0 errors); `npm run audit:all` ✓ (no new violations).

---

## 2026-05-27 — FNOL Summary update (PO requested 4 changes)

- **Source:** verbal brief — 4 PO change requests on `/fnol/summary` (step-summary)
- **Module:** FNOL
- **Files touched:**
  - `src/app/features/fnol/steps/step-summary/step-summary.component.ts`
  - `src/app/features/fnol/steps/step-summary/step-summary.component.html`
  - `src/app/features/loss-events/loss-event-overview/loss-event-overview.component.{ts,html,scss}` (new)
  - `src/app/app.routes.ts` (+ `/loss-events/:id/overview` route)
- **Change 1 — per-section earliest date:** Added `earliestSectionDate` + `earliestSectionTime` to `ClaimGroup`. `deriveEarliestSectionDate()` mocks 3-5 timestamps in a 24h window from `lossInformation.dateOfLoss.dateOfOccurrence` and surfaces the minimum. Rendered as a new row inside each per-claim accordion in the "Claims to be created" card. **PO-OPEN:** should the per-section date live in the loss-information `events` FormArray (so each section captures its own date), or stay derived in summary? Mock implementation chose the latter to avoid touching the form schema until the answer is known.
- **Change 2 — Proof of Claim Report:** Verified zero references in `src/` (`grep -rn "Proof of Claim" src` → no matches). Field is not present in the codebase; no removal needed. Documenting the verification here so the audit isn't repeated next time.
- **Change 3 — conditional Start Claim navigation:** Renamed post-submit "Close" button → "Start Claim" (primary). Added `onStartClaim()` with three-way nav: 1 group → `/claims/:id/overview`, >1 → `/loss-events/:id/overview`, 0 → button disabled with explanatory `title`. Built placeholder `LossEventOverviewComponent` (uses `PageShellComponent` + breadcrumb) listing 3 derived claims that route into each claim overview. Multi-claim demo triggered when `policyNumber` starts with `POL-2024-MC` (3-way `splitGroupForDemo`). **PO-OPEN:** real grouping rule (entity-type vs. coverage vs. damage-type), and final design of the Loss Event Overview screen.
- **Change 4 — General data card cleanup:** Removed "No. of sections" + "Non-covered cases" rows from the General data card. Added "No. of claims" bound to `vm.claimGroups.length`. Removed `sectionCount` + `nonCoveredCases` from `SummaryViewModel` and dropped `buildNonCoveredCases()`. **Kept** the per-claim "No. of sections" row inside the accordion since each derived claim still needs its own section count.
- **Schema changes:** none (no `ScenarioOverrides` extension; demo split is pure VM-side, triggered by policy-number prefix)
- **Mock assumptions to flag:**
  - Multi-claim split is policy-prefix triggered (`POL-2024-MC*`) — not real backend grouping
  - Earliest section dates are deterministic (offset = `(i * 137 + 19) mod 1440` minutes) — not random, not from form data
  - `LossEventOverviewComponent` shows 3 hardcoded derived claims regardless of route id; real screen will hydrate from a service
- **Verification:** `npm run build` ✓; `audit:colors` / `audit:imports` / `audit:subscribe` ✓ (no new violations introduced — pre-existing violations in `sections.scss`, `dashboard.scss`, `step-1-search`, `claim-overview`, etc. unchanged).
- **Notes:** TS file at 299/300 lines — close to the limit. Next change to step-summary should split out `buildClaimGroups` / `deriveEarliestSectionDate` into a sibling helper before adding code.

---

## 2026-05-19 — Stage registration race condition (post-mortem)

- **Source:** apply BMPCC-11360 AC-01 + AC-04 → expected closure modal to auto-open after navigate; modal never opened (silent fail)
- **Symptom:** dev banner Apply works, navigate completes, but `postLand` hooks (`overview.openClosureModal`, `fnol-loss-info.openCwbModal`, etc.) do nothing — only `console.warn '[ScenarioStage] hook failed'`
- **Root cause:** `stageSvc.register(this)` placed at the END of `ngOnInit` (after subscription chains, after early-return guards). `ScenarioRunnerService` fires hooks ~50ms after `router.navigate` resolves; the runner's `waitForStage(page)` times out (4s) because the component hasn't registered yet — its `ngOnInit` is still resolving observables. By the time the registration fires, the runner has given up.
- **Fix:** `stageSvc.register(this)` moved to the **first executable line of `ngOnInit`** in every stage component. Stage methods that depend on async data (e.g. `vm$.value.claim`) added a `waitForClaim()` polling helper.
- **Files touched:** `claim-overview.component.ts`, `step-loss-information.component.ts`
- **Recurrence prevention:**
  - Documented as a "Blessed Pattern" in `PROJECT.md` ("Pattern: ScenarioStage component registration")
  - Added `scripts/audit-stage-pattern.mjs` to `pre-commit` — fails CI if any `implements OverviewStage|FnolLossInfoStage|...` component does not have `stageSvc.register(this)` as the first executable line of `ngOnInit`
- **Why this kept recurring:** AI sessions don't persist memory across runs. Without a docs entry + automated check, the pattern was reinvented each time a new stage component was added. Both safeguards now in place.

---

## 2026-05-15 — BMPCC-219 (Loss Location via CWB MFE)

- **Source:** verbal brief — "T-shirt L: build CWB MFE for loss location"
- **Module:** FNOL
- **File:** `public/tickets/bmpcc-219.json`
- **ACs authored:** 5 (done: 5, partial: 0, todo: 0)
- **Deviations:** none — all 5 ACs match implemented surface
- **Schema changes:** `+cwbLocationsAppend: CwbLocation[]` (entity #6); mirror added to `audit-ac-logic.mjs` (`cwbLocationExists`, `cwbLocationsCount` keys)
- **Files touched:** ~13 (created `MockCwbService`, `cwb-locations.json`, `CwbLocationSearchModalComponent`, `cwb-location.model.ts`; modified `LocationPickerComponent`, `ScenarioOverrides`, audit script, ticket index)
- **Notes:**
  - Originally audited as "feature todo, T-shirt L = 2 days." User flagged that an existing CWB-shaped pattern (`EntitySearchModalComponent` on `/fnol/entities-damages`) covered ~80% of the modal/filter/select shape. Final scope: build a dedicated `CwbLocationSearchModalComponent` mirroring it, wire 3rd radio in `LocationPickerComponent`, seed via `cwbLocationsAppend`. Total real cost ≈ half the original L estimate.
  - `LocationItem.source` enum extended `'policy' | 'manual'` → `'policy' | 'manual' | 'cwb'`.
  - Read-only `policyNumber` + `locationRuleNumber` derived from `selectedPolicy` — must be seeded via `fnolStateOverride`.
  - All 6 mock CWB rows for POL-2024-001 are DE-based (Munich, Hamburg, Berlin, Cologne, Frankfurt, plus Lyon FR) so AC-05 happy-path with Country=DE returns 5 results.

---

## 2026-05-13 — BMPCC-216 (Duplicate Claim Check)

- **Source:** verbal brief — feature already shipped on `/fnol/loss-information`
- **Module:** FNOL
- **File:** `public/tickets/bmpcc-216.json`
- **ACs authored:** 6 (done: 6, partial: 0, todo: 0)
- **Deviations:**
  - **AC-02:** literal "trigger on DoL entry only"; implementation uses cause+date debounced. Marked `[accepted-deviation]` per `DESIGN DECISION FNOL-DUP-4` in `step-loss-information.component.ts:122-125`. Initially `partial`, flipped to `done` after sign-off.
  - **AC-03:** literal lists `claimNumber` + policy number columns; implementation shows 4 fields (claimId, lossDate, clientName, status). Marked `[accepted-deviation]`. Initially `partial`, flipped to `done`.
- **Schema changes:** `+claimsAppend: Claim[]` (entity #4); `+fnolStateOverride: { selectedPolicy?, selectedClient? }` (entity #5); mirror added (`claimExists`, `duplicateClaimsCount` keys); banner-route regex relaxed `^/(claims/[^/]+|fnol)/.+`.
- **Files touched:** ~8 (modified `ScenarioOverrides`, `claim-dev-helper.service.ts`, audit script, ticket index; created `bmpcc-216.json`)
- **Notes:**
  - Triggered the discovery that `claim-dev-banner` was scoped to `/claims/...` only — `isClaimRoute` predicate widened to `isFeatureRoute`.
  - Both banners (claim AC + FNOL helper) coexist on `/fnol/*` after this change. Helper banner moved from `fnol-shell` to app-root in a flex row alongside claim banner (`app.scss` `.dev-banner-row`).
  - Seed includes 4 duplicates for AC-06 ("Show all" modal triggers when `>3`).

---

## 2026-05-08 — CHAMP-CLOSURE-001 (Manual Claim Closure & Section Closure)

- **Source:** original ticket — first one authored, basis for the whole banner system
- **Module:** Claims
- **File:** `public/tickets/closure.json`
- **ACs authored:** 7 (done: 7, partial: 0, todo: 0)
- **Deviations:** none
- **Schema changes:** initial `ScenarioOverrides` shape — `taskStatuses`, `sectionStatuses`, `overviewPatch`. `audit-ac-logic.mjs` introduced as Node-side simulator with rich assertion keys (`pendingTasks`, `canClose`, `tooltipContains`, etc.).
- **Files touched:** initial dev-banner scaffold (`claim-dev-helper.service.ts`, `claim-dev-banner.component.*`, `claim-dev-details-modal.component.*`); created `closure.json`, `index.json`, `audit-ac-logic.mjs`.
- **Notes:**
  - Audit script and component logic both compute `canClose` independently — drift risk acknowledged but accepted because both share `mock-state` source data.
  - State persistence through `sessionStorage` (`MockStateService`) was added so AC-07 ("closed state survives reload") could be authored.
  - First AC ticket established the convention for `expectedOutcome` shape, `preconditions[].role` enum (`tested-visible | setup | metadata`), and `howToTest` block.

---

## 2026-06-09 — BMPCC-415-F2 (Edit Loss Info follow-up: full diff + policyNumber)

- **Source:** gap verification after BMPCC-415 build
- **Files modified:** `edit-loss-information.component.ts` (computeDiffs + policyNumber signal), `edit-loss-information.component.html` ([policyNumber] binding)
- **GAP 2 fixed:** `computeDiffs()` now covers all 16 editable fields: date/time of occurrence, date/time of notification, cause of loss, type of damage, loss description, fire origin, fire dept called, fire dept report number, water source, affected area m², police report number, estimated value stolen, date reported to police, per-event damages
- **GAP 4 fixed:** `policyNumber` signal fetched from `overviewSvc.getOverview(claimId)` on init; bound to `[policyNumber]="policyNumber()"` on LocationPickerComponent
- **DEFERRED — do not implement without explicit instruction:**
  - ⚑ FormGroup duplication: `edit-loss-information` FormGroup is a copy of `FnolStateService`'s lossInformation group. If FNOL form fields change, edit form must be updated manually. Fix: extract shared `buildLossInfoFormGroup()` factory. Deferred until FNOL fields change.
  - ⚑ CanDeactivate guard: browser Back button and nav-link clicks bypass the discard modal. Fix: implement Angular `CanDeactivate` route guard. Deferred — low frequency UX issue.

---

## 2026-06-09 — BMPCC-415 (Edit Loss Information — targeted edit screen)

- **Source:** BMPCC-415 + Drishya discussion 05 Jun
- **Module:** Claims / Edit Loss Information
- **Files created:** `features/claims/edit-loss-information/edit-loss-information.component.*`, `loss-info-confirm-modal.component.*`, `loss-info-discard-modal.component.*`
- **Files modified:** `app.routes.ts` (+1 route), `claim-overview.component.*` (edit entry point + RouterLink), `mock-claim-overview.service.ts` (appendActivities), `mock-state.service.ts` (patchActivities), `fnol-state.service.ts` (prefillFromExistingLossInfo), `loss-information.json` (+CLM-2024-001 record)
- **Deviations / PLACEHOLDER flags:**
  - ⚑ `region: string` (singular) in MassEvent stays deferred — unrelated to this ticket
  - ⚑ Location picker in edit context: LocationPickerComponent is self-contained (no FnolStateService dep) and renders correctly. However, `policyNumber` is passed as `null` in edit mode — policy-location lookup won't work. Location displayed as-is from LossInformation.lossLocation. Full location edit parity requires passing claimId → policyNumber mapping. Noted in template as a comment.
  - ⚑ `prefillFromExistingLossInfo()` added to FnolStateService but edit screen uses its own FormGroup (intentional isolation). The service method is available for future wizard-edit hybrid flows.
  - ⚑ Confirmation modal shows field-level diffs for 7 key fields. Cause details sub-fields (water/theft) are not fully diffed. Extend `computeDiffs()` when needed.
- **Wizard regression:** Edit screen uses completely independent FormGroup — does NOT touch `FnolStateService.fnolForm`. FNOL creation wizard is unchanged. Regression risk = zero.
- **CWB Location verdict:** LocationPickerComponent works outside wizard shell. Policy-location search not available (policyNumber=null) but existing location displays correctly.

---

## 2026-06-09 — BMPCC-ME-POPOVER (Mass Event popover on Claim Overview)

- **Source:** BMPCC Sr.3 open point (verbal)
- **Module:** Claim Overview
- **Files touched:** `mass-event.model.ts`, `claim-overview.model.ts`, `claim.model.ts`, `mass-events.json`, `claim-overview.json`, `mass-event-edit-modal.component.*`, `claim-overview.component.*`
- **Deviations / PLACEHOLDER flags:**
  - ⚑ `MassEvent.region` is `string` (singular) — Confluence spec says Region(s) implying array. Deferred because changing to `string[]` requires admin UI + mock updates. Track as follow-up.
- **catType assignment logic:** Earthquake / Storm / Flood / Wildfire / Landslide → `CAT` (all are natural catastrophes). Colombia Landslide assigned `Non-CAT` as an example of non-CAT event for demo contrast.
- **Mock claim links:** CLM-2024-001 → ME-2025.102, CL-2025-001 → ME-2025.101, CLM-2024-011 (Closed/Liver Tea) → unlinked (demos hidden state)
- **"View full details":** Opens existing `MassEventEditModalComponent` in new `mode: 'view'` — form disabled, Save hidden, Cancel → Close
- **Notes:** Signal-in-async-pipe reactivity issue — mass event data is loaded inside `combineLatest` pipeline and stored in `OverviewVM.massEvent` (not a standalone signal) so `vm$` emits once with all data and template renders correctly in one pass

---

## 2026-06-08 — DASH-P2 (Dashboard Phase 2 — Role-based redesign, all 10 feedback items)

- **Source:** user research brief (verbal)
- **Module:** Dashboard
- **Files touched:** `core/services/auth.ts`, `core/models/dashboard-extended.model.ts`, `core/models/index.ts`, `core/models/claim.model.ts`, `core/mock/data/heads-up.json`, `core/mock/data/news.json`, `core/mock/data/calendar-events.json`, `core/mock/data/provider-expenses.json`, `core/mock/data/claims.json` (+group field), `core/mock/services/mock-dashboard-extended.service.ts`, `features/dashboard/dashboard.ts`, `features/dashboard/dashboard.html`, `features/dashboard/dashboard.scss`, `features/dashboard/widgets/financial-closure-banner.ts`, `features/dashboard/widgets/kpi-row.ts`, `features/dashboard/widgets/heads-up-panel.ts`, `features/dashboard/widgets/calendar-widget.ts`, `features/dashboard/widgets/news-panel.ts`, `features/dashboard/widgets/expense-breakdown.ts`, `features/dashboard/widgets/persona-switcher.ts`, `app.ts`
- **Deviations / PLACEHOLDER flags:**
  - ⚑ `DORMANT_DAYS = 30` — threshold hardcoded; needs business sign-off on per-LOB rules
  - ⚑ `bigReserveMovements: 3` in KPI row — hardcoded placeholder; needs `ReserveMovement` model + real service wired (requires separate data model sprint)
  - ⚑ `€50k` reserve movement threshold in banner copy — placeholder value; confirm with business
  - ⚑ Payments card still shows static "150,000 EUR" — needs real payment aggregation service
  - ⚑ Aviation handler role defined as `dashboardRole: 'aviation-handler'` — not mapped to existing `'admin'|'adjuster'|'claimant'` RBAC system; needs proper role model decision
  - ⚑ Calendar integration is internal mock only — no Microsoft Graph API; decision on Outlook integration deferred
  - "Submitted by me" filter matches by `requester === user.name` (string match) — should use user ID when backend provides it
- **Schema changes:** `User` extended with `dashboardRole: DashboardRole` and `group: string`; `Claim` extended with `group?: string`; new `dashboard-extended.model.ts` (HeadsUpItem, NewsItem, CalendarEvent, ProviderExpense, FinancialClosurePeriod, KpiData)
- **Notes:**
  - `AuthService` now uses `localStorage('dashboard:persona')` for persona persistence across reload — intentional for dev demo, remove before production auth wired
  - KCM KPI row `bigReserveMovements` is the only deliberately fake number in the UI — it has a `title` tooltip flagging it as placeholder so testers aren't misled
  - All new widget components use Angular signals + `toSignal` pattern; zero `.subscribe()` calls introduced
  - `NxMessageModule` was available but not imported — used custom CSS banner to avoid adding another NDBX module for a single component; can swap to `nx-message` later

---

## 2026-06-16 — BMPCC-11681 (Claim Edit — Environment fixes D7/D8 + inaccuracy corrections)

- **Source:** Environment audit review session
- **Module:** `edit-loss-information`, `claim-overview`, `duplicate-check.service`
- **Files touched:** 3
  - `src/app/features/claims/edit-loss-information/edit-loss-information.component.ts`
  - `src/app/features/claims/claim-overview/claim-overview.component.html`
  - `src/app/core/services/duplicate-check.service.ts`
- **Changes:**
  1. **D8 — Save error handling:** Added `catch` block to `onSaveChanges()`. On failure: `toast.error('Failed to save', 'Please try again...')` fires, form stays dirty, user stays on edit screen. Previously `try/finally` silently swallowed save errors with no user feedback.
  2. **D7 — computeDiffs() lossLocation gap:** Added loss location diff using first location's `displayName` as the comparable value. All other fields (causeDetails fire/water/theft, events) were already covered. Loading state (spinner on page-load + save button) was confirmed present — the audit inaccuracy was incorrect.
  3. **D4 — Reopened allows edit:** Changed edit button visibility from `status !== 'Closed' && status !== 'Reopened'` → `status !== 'Closed'`. Reopened = claim is active for further work; blocking edit was incorrect. The "Close Claim" button at line 186 retains the `&& status !== 'Reopened'` guard (correct — can't close a freshly reopened claim). **ASSUMPTION:** Confirm with Product that Reopened claims should be editable. Flag: BMPCC-11681 Q open.
  4. **D2 — Comment clarification:** Updated `duplicate-check.service.ts` TODO comment to clarify it asks about skeleton-create stage only; the service itself is not restricted to FNOL, and edit-loss-information is a separate pending consumer.

---

## 2026-08-12 — PI 2026.3 UI/UX Alignment Open Points (items 3, 5.2, 8)

- **Source:** Confluence "Claims Management- PI 2026.3 - UI/UX Alignment Open Points" (verbal review of 14 open points)
- **Module:** Claim Overview, Edit Loss Information, Sections
- **Files touched:**
  - `src/app/features/claims/claim-overview/claim-overview.component.html`
  - `src/app/features/claims/edit-loss-information/edit-loss-information.component.ts`
  - `src/app/features/claims/edit-loss-information/edit-loss-information.component.html`
  - `src/app/shared/components/status-chip/status-chip.component.ts`
  - `src/app/features/sections/sections.html`
- **Decisions made (author: Tanawitch, since "Nat" and "Tanawitch" resolve to the same person on this project):**
  1. **Item 3 — no-data fields on Claim Overview:** doc recorded two options (hide vs. dash) with no final call ("Saentree, Tanawitch will confirm"). Decided: **dash**, for consistency with every other no-data field already on this page (Broker, Client contact, Closure date, etc.). Mass Event for a non-KCM handler now shows "–" instead of vanishing. Also fixed two fields that had NO no-data handling at all and would have rendered blank/raw-pipe-output: `proximateLossCause` and `dateOfLoss` (both instances, normal row + closure block) now fall back to "–".
  2. **Item 5.2 — Fire detail section on Edit Loss Information:** was not "awaiting design," it was a **live bug** — `showFireDetails` was hardcoded `map(() => false)` while `showWaterDetails`/`showTheftDetails` correctly reacted to `causeOfLoss`. Fixed to react the same way. The section itself (Fire origin, Fire dept. report number, fire-department-called radios) had never been wired into the template at all despite the form model (`causeDetails.fire`) and prefill logic already existing — added it, mirroring the existing `two-col-grid` / `eli-field-group` conventions used elsewhere on the page.
  3. **Item 8 — Coverage Status colors:** `coverage-chip` in Sections rendered plain gray text for every status. Added a `coverage-review` domain to `StatusChipComponent`'s `TOKEN_MAP` (Standard Review → bound/green, Enhanced review required → in-progress/amber, Additional information required → declined/red) and swapped the raw `<span>` for `<app-status-chip>`.
- **Bug found during Item 5.2 fix, unrelated to the original ask:** `[formGroup]="causeDetails.get('fire')"` failed Angular's template type-check (`AbstractControl | null` not assignable to `FormGroup`) — this silently broke the **entire** dev-server incremental build for this component (visible only in the `ng serve` log, not in `tsc --noEmit`, which doesn't type-check templates). Fixed by adding a properly-typed `fireDetails` getter, following the same pattern as the existing `dateOfLoss`/`causeDetails` getters.
- **Items reviewed but NOT touched (need a decision from someone other than me, or from a system I don't control):** items 1, 2 (partially), 7, 9, 11, 12, 14 — all still genuinely "Open," waiting on business/CTR-availability/other-team input, not on a UI/UX call I can make.
- **Items confirmed already done, no action taken:** item 4 (location table: counter removed, no sort, "Number and Street" merged column), item 6 (Section Overview columns match desired set; "Comments" column is a separate, still-open feature thread, not a leftover), item 10 (pre-closure checklist already reverted into `claim-closure-modal`), item 13 (skeleton parties/location steps fully built), item 2's OE/Event-name removal (Loss Events dashboard tab already has neither column).

---

<!--
Template — copy below the most recent entry:

## YYYY-MM-DD — TICKET-ID (Title)

- **Source:** [Jira link or "verbal brief"]
- **Module:**
- **File:** `public/tickets/<file>.json`
- **ACs authored:** N (done: X, partial: Y, todo: Z)
- **Deviations:** list with rationale + DESIGN DECISION refs
- **Schema changes:** any
- **Files touched:** count + key paths
- **Notes:** anything not visible from `git diff` — design rationale, alternatives considered, surprises encountered

-->
