# Ticket Conversions

Append-only log of ticket → JSON conversions. Newest at top. Each entry should be terse — link to ticket file + capture decisions that aren't visible from `git diff` alone.

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
