# Ticket Conversions

Append-only log of ticket → JSON conversions. Newest at top. Each entry should be terse — link to ticket file + capture decisions that aren't visible from `git diff` alone.

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
