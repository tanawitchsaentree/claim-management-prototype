---
project: claim-management-prototype
domain: insurance-claims
modules: [Claims, FNOL]
schema-version: v2.2
deployed: https://tanawitchsaentree.github.io/claim-management-prototype/

ticket-schema:
  required: [ticketId, module, title, targetClaim, pages, walkthroughSteps, acceptanceCriteria]
  optional: [epicId]
  file-location: public/tickets/<lowercase-ticket-id>.json
  registry: public/tickets/index.json

ac-schema:
  required: [id, statement, page, buildStatus, setup, expectedUI, howToTest]
  optional: [plainStatement, expectedOutcome]
  buildStatus-values: [done, partial, todo]

mutations:
  primitive: ScenarioOverrides
  defined-in: src/app/core/mock/state/mock-state.service.ts:9
  entities:
    - taskStatuses
    - sectionStatuses
    - overviewPatch
    - claimsAppend
    - fnolStateOverride
    - cwbLocationsAppend

pages:
  enum: [overview, sections, fnol-search, fnol-loss-info, fnol-entities-damages, fnol-skeleton, fnol-summary, any]
  defined-in: src/app/features/claims/dev-banner/claim-dev-helper.service.ts:12

deviation-marker: "[accepted-deviation]"
---

# PROJECT.md — Claim Management Prototype

> **Read this file FIRST** in any AI session that touches tickets, the dev banner, ACs, mock data, or the audit pipeline. It is the single source of truth for ticket schema, mutation entities, and conversion process. Cross-references are file:line accurate as of `schema-version: v2.2`.

---

## Overview

This is a **demo prototype** for an Allianz claims-handling app. It is not in production. Its primary use is stakeholder demos, sales, and internal feedback walkthroughs.

The codebase has two intertwined concerns:

1. **Application code** — Angular 21 + `@allianz/ng-aquila` (NDBX), real components for FNOL wizard and Claim Overview/Sections.
2. **Dev banner & ticket runner** — a tooling layer that lets viewers pick a Jira-style ticket from a dropdown, apply pre-canned mock state, and walk through Acceptance Criteria. Files live under `src/app/features/claims/dev-banner/` and `public/tickets/`.

The two layers ship together. The dev banner is **always visible** (gated by `access-gate`, not `isDevMode()` — see "Why isDevMode() is not used" below) so prod and local behave identically.

**Mock-only data layer.** Every service the app talks to is in `src/app/core/mock/services/`. `claims.json`, `tasks.json`, `sections.json`, etc. are the source of truth at runtime, hydrated through `MockStateService`. There is no real backend.

---

## Ticket Conversion Pipeline

When converting a Jira/verbal brief into a runnable ticket, follow these 7 steps in order:

1. **Audit feature build status.** For each AC, verify the affordance exists in code. Read the relevant component(s). Find the smoking-gun comment, the visible UI, or the missing branch. Record `buildStatus` per heuristics below.
2. **Identify mutation entities needed.** Match each AC's setup to the entity menu. If a needed entity is not in the schema, propose a v-bump (`v2.1 → v2.2`) before authoring — do not silently add ad-hoc keys.
3. **Decide route + page enum.** Use existing `PreconditionPage` values where possible. New page = update `pageRoute()` mapping + audit script + this file's enum.
4. **Author `<ticket-id>.json`.** Lowercase filename. Place in `public/tickets/`. Use `closure.json` (claim-side), `bmpcc-216.json` (FNOL with claims injection), or `bmpcc-219.json` (FNOL with CWB external lookup) as the closest reference.
5. **Register in `index.json`.** Add the entry — order doesn't matter, but keep stable for diff readability.
6. **Mirror in `audit-ac-logic.mjs`** if the schema gained new mutation entities or assertion keys. If not, the script auto-loads the new ticket file.
7. **Verify.** Run `npm run audit:ac-logic` — must show all ACs passing. Run `npm run build` — must be 0 errors. Optionally `npm run deploy`.

A finished ticket adds a row to `CONVERSIONS.md`.

---

## Schema Reference

### Ticket file

```ts
interface DevTicket {
  ticketId: string;          // e.g. "BMPCC-219"
  epicId?: string;           // parent Jira epic ID — ONLY set when confirmed (e.g. from a
                             // Jira tracker screenshot/export); never guess. Surfaced in the
                             // dev-banner dropdown and details modal as "Epic: <epicId>" so a
                             // reader can tell which repo tickets share the same Jira epic.
  module: string;            // e.g. "FNOL" | "Claims"
  title: string;
  targetClaim: string;       // a claimId; used for state-inspector header even on FNOL tickets
  pages: PreconditionPage[]; // routes the user will visit
  walkthroughSteps: string[];
  acceptanceCriteria: AC[];
}
```

### AC

```ts
interface AC {
  id: string;                                  // "AC-01", "AC-02", ...
  statement: string;                           // plain English
  plainStatement?: string;                     // markdown — preferred for UI rendering
  page: PreconditionPage;
  buildStatus: 'done' | 'partial' | 'todo';
  setup: {
    description: string;
    preconditions: PreconditionItem[];         // strings allowed for legacy
    stateOverrides: ScenarioOverrides;
  };
  expectedUI: { description: string; visualCues: string[] };
  expectedOutcome?: ExpectedOutcome;           // machine-checkable; see audit-ac-logic.mjs
  howToTest: { route: string; trigger: string; expectedResult: string };
}

interface PreconditionItem {
  text: string;
  page: PreconditionPage;
  role: 'tested-visible' | 'setup' | 'metadata';
  hint?: string;
}
```

### ScenarioOverrides (mutation primitive)

Authoritative source: `src/app/core/mock/state/mock-state.service.ts:9-20`.

```ts
interface ScenarioOverrides {
  taskStatuses?:       Record<string, TaskStatus>;
  sectionStatuses?:    Record<string, SectionStatus>;
  overviewPatch?:      { claimId: string; patch: Partial<ClaimOverview> };
  claimsAppend?:       Claim[];                         // dedupe by claimId
  fnolStateOverride?:  {
    selectedPolicy?:        { policyId: string; policyNumber: string };
    selectedClient?:        { clientId: string; clientName: string };
    path?:                  'standard' | 'orphan' | null;
    convertFromSkeletonId?: string;   // BMPCC-11006: prefill loss-info from a skeleton
  };
  cwbLocationsAppend?: CwbLocation[];                   // dedupe by cwbReference
}
```

> **When extending:** add the field, update `loadStatePreset` (`mock-state.service.ts:119`), mirror in `audit-ac-logic.mjs:31` simulator, update this section, bump schema-version in YAML front matter.

---

## Mutation Entity Menu

| Entity | Type | Match key | Used by | Notes |
|---|---|---|---|---|
| `taskStatuses` | `Record<taskId, TaskStatus>` | `task.taskId` | closure | Status enum: `'open' \| 'in-progress' \| 'done'` |
| `sectionStatuses` | `Record<sectionId, SectionStatus>` | `section.id` | closure | Status enum: `'Open' \| 'Closed'` |
| `overviewPatch` | `{ claimId, patch }` | `overviews[claimId]` | closure | Partial merge into existing overview |
| `claimsAppend` | `Claim[]` | dedupe by `claimId` | bmpcc-216 | New rows appended to `state.claims` |
| `fnolStateOverride.selectedPolicy` | `{ policyId, policyNumber }` | sets `FnolStateService.selectedPolicy` | bmpcc-216, bmpcc-219 | Avoids redirect-to-search on FNOL routes |
| `fnolStateOverride.selectedClient` | `{ clientId, clientName }` | sets `FnolStateService.selectedClient` | (none yet) | Mutually exclusive with selectedPolicy at service level |
| `fnolStateOverride.path` | `'standard' \| 'orphan' \| null` | sets `FnolStateService.path` | bmpcc-241 | Drives stepper variant (orphan → 2-step Loss/Summary) |
| `fnolStateOverride.convertFromSkeletonId` | `string` | resolves via `MockSkeletonClaimService` then calls `prefillFullFromSkeleton` | bmpcc-11006 | Demo prefill — populates the **search**, **loss-info**, and downstream forms; user still navigates each step themselves |
| `fnolStateOverride.convertSuggestedPolicyNumber` | `string` | passed as `opts.policyNumber` to `prefillFullFromSkeleton` | bmpcc-11006 | Hints the policy to drop into the search form so the user only needs one click to find the right row |
| `cwbLocationsAppend` | `CwbLocation[]` | dedupe by `cwbReference` | bmpcc-219 | Pushed into `MockCwbService` runtime cache; cleared on `MockStateService.reset()` |

Reset semantics: `MockStateService.resetAsync()` (called before every `applyAC`) wipes session-storage state, restores mock data defaults, and clears the section + CWB caches via lazy injection (`mock-state.service.ts:103-110`).

---

## BuildStatus Heuristics

Decide buildStatus per AC, not per ticket.

| Status | Meaning | Apply behavior |
|---|---|---|
| `done` | Affordance exists in code AND matches the AC literally OR with a documented `[accepted-deviation]` | Click AC row → `apply + navigate` (1-step) |
| `partial` | Affordance partially exists OR uses a deviation NOT yet sign-off'd | Select-only (highlight); apply blocked |
| `todo` | Affordance does not exist | Row disabled; cannot select |

**Rules:**
- A `partial` AC blocks Apply because the deviation is unconfirmed by product. After sign-off, flip to `done` and prepend `[accepted-deviation]` note in `plainStatement`.
- Never mark `done` without verifying the code path. Use `grep` / read components — do not guess.
- `done` ≠ "the AC is also test-verified." Apply works; visual verification is human.

**Where the gating lives:** `claim-dev-details-modal.component.ts:46-50` (`canApply`), `:96` (`selectAc`), `:139` (`onApply` re-check).

---

## Audit Mirror Requirement

`scripts/audit-ac-logic.mjs` is a Node-side simulator that:
1. Loads every ticket in `public/tickets/*.json` (skips `index.json`).
2. Applies `setup.stateOverrides` against bundled mock JSON.
3. Asserts `expectedOutcome` keys.
4. Exits non-zero on mismatch.

**Mirror obligations** when extending the schema:

| Change | Mirror file:line |
|---|---|
| New mutation entity | `simulateState()` at `audit-ac-logic.mjs:31` |
| New assertion key | `assertOutcome()` at `audit-ac-logic.mjs:88` |
| New entity type that is runtime-only (e.g. `fnolStateOverride`) | Add a comment "skipped here" — cannot simulate UI behavior in Node |

**Supported assertion keys (v2.1):**
- Counts: `pendingTasks`, `doneTasks`, `openSections`, `closedSections`
- Status: `overviewStatus`, `canClose`, `buttonVisible`, `buttonEnabled`
- Text: `tooltipContains`
- Spot checks: `taskStatuses`, `sectionStatuses`
- Closure: `closedByName`, `closureReason`
- Duplicate-claim: `duplicateClaimsCount`, `claimExists`
- CWB: `cwbLocationExists`, `cwbLocationsCount`

`tooltipContains` re-implements the tooltip-formatting logic (`audit-ac-logic.mjs:152-159`). When closure tooltip logic changes in the component, **update the mirror or the audit lies.**

---

## Deviation Notation

When implementation diverges from the literal AC, do not mark `partial` automatically. Use this pattern:

1. `buildStatus: "done"` — apply works, can be tested
2. Inside `plainStatement` add `**NOTE [accepted-deviation]:**` followed by:
   - What the literal AC said
   - What the implementation does instead
   - The reason (link to a `DESIGN DECISION` comment in the source code)
   - Closing line: `Treated as \`done\` — pending product sign-off.`

**Example** (`bmpcc-216.json` AC-02):
> The duplicate check *fires automatically* when **cause of loss** or **date of occurrence** changes, with a `1s debounce`. **NOTE [accepted-deviation]:** literal AC-02 said *date-only* trigger; implementation uses *cause+date* per DESIGN DECISION FNOL-DUP-4 (cause-aware narrowing avoids false positives). Treated as `done` — pending product sign-off.

This keeps the ticket testable while documenting the gap. Search for `[accepted-deviation]` to inventory all open product decisions.

---

## Page Enum & Routing

`PreconditionPage` (defined: `src/app/features/claims/dev-banner/claim-dev-helper.service.ts:12`):

| Page | Route | Notes |
|---|---|---|
| `overview` | `/claims/:claimId/overview` | Closure ticket landing |
| `sections` | `/claims/:claimId/sections` | Closure cross-page setup |
| `fnol-search` | `/fnol/search` | BMPCC-11006 landing (Convert orphan banner) |
| `fnol-loss-info` | `/fnol/loss-information` | BMPCC-216 / 219 / 11006 |
| `fnol-entities-damages` | `/fnol/entities-damages` | CHAMP-NO-LOSS-LOC |
| `fnol-skeleton` | `/fnol/skeleton-create` | BMPCC-241 (orphan create) |
| `fnol-skeleton-parties` | `/fnol/skeleton-parties` | BMPCC-241 (orphan parties — no policy, starts empty) |
| `fnol-skeleton-location` | `/fnol/skeleton-location` | BMPCC-241 (orphan location — manual entry, no contract-location option) |
| `fnol-summary` | `/fnol/summary` | Wizard summary (step-summary) |
| `any` | (empty string) | Metadata-only preconditions; no link rendered |

`pageRoute(page, claimId)` mapping: `claim-dev-helper.service.ts:273-277`. Adding a page = update mapping + add row above + update `isFeatureRoute` regex if it lives outside `/claims/:id/...` and `/fnol/...`.

---

## Examples

### `closure.json` — claim-side ticket
- 7 ACs, all `done`
- Uses `taskStatuses`, `sectionStatuses`, `overviewPatch`
- Targets `CLM-2024-001`
- AC-01..03 disable Close button; AC-04..05 walk closure modal; AC-06..07 verify Closed state persists

**Key learning:** `expectedOutcome` is rich (counts + status + tooltip + per-id spot-checks). Audit script verifies all of it Node-side.

### `bmpcc-216.json` — FNOL with claims injection
- 6 ACs, all `done` (originally 4 done + 2 partial; flipped after `[accepted-deviation]` notes)
- Uses `claimsAppend` + `fnolStateOverride.selectedPolicy`
- Targets `CLM-2024-001` (header inspector only — actual flow is FNOL-side)
- Demonstrates: cross-feature ticket on `/fnol/loss-information` requiring claims-array seeding

**Key learning:** Use `claimsAppend` to inject duplicate-target claims (`POL-2024-001` + `2024-06-01` + cause `fire`). Banner debounce is 1s — preconditions warn the user.

### `bmpcc-219.json` — FNOL with CWB MFE
- 5 ACs, all `done`
- Uses `cwbLocationsAppend` + `fnolStateOverride.selectedPolicy`
- Demonstrates: external-system simulation as a modal styled with "External system" badge — no real iframe / MFE / module-federation
- Modal: `src/app/shared/components/cwb-location-search-modal/`
- Mock service: `MockCwbService`; data: `cwb-locations.json` (10 rows, 5 countries)

**Key learning:** Read-only fields (`policyNumber`, `locationRuleNumber`) are derived from `selectedPolicy` and **cannot be edited from the dev banner setup** — only seedable via `fnolStateOverride`.

---

## Do's and Don'ts

### Do
- Author tickets in `public/tickets/<lowercase>.json` and register in `index.json`
- Verify each `buildStatus` against actual code paths (grep, read components)
- Use `[accepted-deviation]` notation for known gaps — never silent-ignore
- Mirror schema additions in `audit-ac-logic.mjs` immediately
- Include `expectedOutcome` for ACs that mutate countable state — gives Node-side verification
- Use `fnolStateOverride.selectedPolicy` to avoid `step-loss-information` redirecting to `/fnol/search` (`step-loss-information.component.ts:112-115`)
- Test apply flow on **both** `/dashboard` (cold start) and the target route (already-loaded state)
- Keep ticket files self-contained — preconditions describe context, walkthroughSteps describe action

### Don't
- Don't add new `ScenarioOverrides` fields without bumping schema-version + updating this file
- Don't gate dev banner with `isDevMode()` — production build inlines it to `false`. Use `enabled = true` and rely on the access-gate for security
- Don't write `mutations` in DOM-runner v3 shape (`{entity, where, set, count}`) — that schema was deferred. Stick with v2.1 hardcoded entity keys
- Don't introduce data-testid for runner purposes — the DOM runner is deferred
  - **`data-tour-id` is a different, approved exception (2026-08-20, tour-system audit).** It is NOT a reversal of the rule above — `data-testid` was scoped to a deferred click-simulation DOM runner; `data-tour-id` has a different consumer entirely (`TourStepRendererComponent`, `shared/components/tour/`) that locates elements at runtime purely to position a non-blocking highlight/popover, never to simulate clicks. Add it only to elements a tour actually targets — no codebase-wide sweep. See `src/app/core/services/tour.service.ts` and `claim-overview.component.html`'s `co-tasks-widget` / `co-close-claim-button` for the first real usage.
- Don't change `claims.json` / `tasks.json` / `sections.json` to make a ticket pass — use mutations instead
- Don't author a ticket where every AC is `todo` — adds clutter without testing value
- Don't bypass `MockStateService` — use `loadStatePreset` so `audit-ac-logic.mjs` can simulate the same logic
- Don't introduce hardcoded routes for `pageRoute()` — extend the enum properly

---

## Blessed Patterns (do not deviate)

These patterns exist because past mistakes broke production. Audit scripts in
`pre-commit` catch the most common regressions — see "Audit Mirror Requirement"
above for the schema audit, and the patterns below for component-level rules.

### Pattern: ScenarioStage component registration

**Rule:** any component implementing `OverviewStage` / `FnolLossInfoStage` /
similar `ScenarioStage*` interface MUST register with the stage service as
the **first line of `ngOnInit`**, before any early-return / redirect / async
subscription.

```ts
// ✅ Correct — register first
ngOnInit(): void {
  this.deregisterStage = this.stageSvc.register(this);
  if (!this.fnolState.selectedPolicy) {
    this.router.navigate(['/fnol/search']);   // safe — already registered
    return;
  }
  // ... rest of init
}

// ❌ Wrong — register after subscription resolves
ngOnInit(): void {
  this.someApi.load().subscribe(/* ... */);
  this.deregisterStage = this.stageSvc.register(this);   // too late
}
```

**Why:** `ScenarioRunnerService` fires `postLand` hooks ~50ms after the router
navigation completes. If the component subscription chain is still resolving
when the runner calls `waitForStage(...)`, the stage isn't registered yet, the
runner times out (`STAGE_READY_TIMEOUT_MS = 4000`), and the hook **fails
silently** (only `console.warn`). Symptom: "Apply AC → navigates fine → modal
never opens."

**Pair this with `waitFor*` helpers** in stage methods that depend on async
data (vm$.value etc.) being populated:

```ts
private async waitForClaim(timeoutMs = 4000): Promise<ClaimOverview | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const c = this.vm$.value.claim;
    if (c) return c;
    await new Promise(r => setTimeout(r, 50));
  }
  return null;
}

async openClosureModalAuto(): Promise<void> {
  const claim = await this.waitForClaim();
  if (!claim) return;
  await this.openClosureModal(claim);
}
```

**Audit:** `scripts/audit-stage-pattern.mjs` (in `pre-commit`) checks every
implementer of a stage interface and ensures `stageSvc.register(this)` is the
first executable statement of `ngOnInit`. If it ever fires after a redirect
guard or subscription, CI blocks the commit.

**Verification:** apply any AC whose `postLand` opens a modal/picker. Modal
should render within ~250ms of navigation. If not, check (a) registration
order, (b) async data wait helpers.

### Pattern: Reactivity bridge (signal → component re-derivation)

When a component re-derives state on `route.paramMap`, it MUST also re-derive
on signal changes from `MockStateService.state`. Otherwise dev-banner Apply
mutates state but the component never re-evaluates.

```ts
// ✅ Correct — combineLatest paramMap + state signal
ngOnInit(): void {
  combineLatest([
    this.route.paramMap,
    toObservable(this.stateSvc.state),
  ]).pipe(switchMap(([params]) => /* ... */)).subscribe(/* ... */);
}

// ❌ Wrong — only paramMap
ngOnInit(): void {
  this.route.paramMap.pipe(switchMap(/* ... */)).subscribe(/* ... */);
  // Apply AC mutates state.claims but this component never re-runs.
}
```

See `claim-overview.component.ts:94-130` for the canonical example.

### Pattern: Cross-ticket AC ID collision

ACs across tickets share IDs (e.g. every ticket has `AC-01`, `AC-02`). When
resolving an `acId`, the helper service MUST scope the lookup to
`selectedTicket()` first, then fall back to all tickets. Otherwise
`applyAC('AC-02')` may pick up the wrong ticket's setup and mutate the wrong
claim.

See `claim-dev-helper.service.ts:applyAC` and `runPostLandFor` for the
canonical lookup order.

---

## Why isDevMode() is not used

Production build (`optimization: true`) tree-shakes `isDevMode()` to `false`. Any banner / service that gates with `if (!this.enabled) return` becomes inert — `loadTickets()` skips, `applyAC()` no-ops, dropdown stays empty. **Live deploy was broken once for this reason.**

Fix: hardcoded `enabled = true` (and its kin in `dev-helper-banner.component.ts`, `fnol-dev-helper.service.ts`, `claim-dev-banner.component.ts`). The prototype intentionally exposes the dev banner in prod for stakeholder demos. Access-gate (`features/access-gate/`) handles the security side.

---

## Builder Onboarding

If `CLAUDE.md` is gitignored or absent, the **same rule applies**: any AI session must read this file before touching tickets, the banner, ACs, or mocks. Cross-references are stable; if a `file:line` doesn't match, that's drift — fix it before continuing.

For schema/runner discussions, also read:
- `audit-ac-logic.mjs` (Node-side simulator and assertion keys)
- `mock-state.service.ts` (runtime mutation primitive)
- `claim-dev-helper.service.ts` (banner state, route filter, ticket loader)
- `claim-dev-details-modal.component.ts` (Apply / select gating)

---

## Open Decisions / Deferred Work

- **DOM runner v3** — deferred. Documented options: per-step helper / Playwright / full DOM runner. Decision pending answers to "demo only vs production track" and "ticket cadence."
- **Mutation primitive refactor** — `mutations: [{entity, where, set, upsert}]` would unify the 6 hardcoded entity keys. Worth doing once `cwbLocationsAppend`-style additions hit ~3 more entities.
- **Auto-trigger modal/click after navigate** — declined for now. Tickets stay declarative-state; user clicks through manually.

When picking up these decisions, update this file (and `CONVERSIONS.md`) before code.
