# Ticket Conversions

Append-only log of ticket → JSON conversions. Newest at top. Each entry should be terse — link to ticket file + capture decisions that aren't visible from `git diff` alone.

---

## 2026-08-20 — Tracker data scope fix + ticket-to-prototype link (Isabelle's design work found, JQL rewritten, prototype_route added, filter UI)

- **Source:** `/goal` autonomous execution — fix tracker data scope (123 tickets, 118 dev/QA noise) and finish the ticket-to-prototype link
- **Module:** Jira sync scope, tracker schema, tracker table/detail-panel UI
- **Stage 1 — Isabelle investigation:** found via direct Jira query — `assignee = "ruby-isabelle.costigan@allianz.de"` returns 11 tickets project-wide, 6 in PI 2026.3 CM, titled `UI/UX - Design for...` (Story-type) — a different naming convention than the user's own `Figma Design -` (Sub-Task-type) tickets. She was invisible before because the old JQL only matched `assignee = currentUser() OR labels = "team#NINJA"`, neither of which ever matched her. **Correction to the task's own proposed JQL**: `labels = "CX/UX_CommercialClaims"` is NOT a design signal — tested live at PI scope, it's on 115 of 185 issues (a Commercial-Claims-domain tag, not discipline). Also dropped `summary ~ "design"` — matches 40+ `[QA] Test case design` Sub-Tasks. Both confirmed via live Jira queries before writing the new JQL, not assumed.
- **Stage 2 — New JQL applied as `JIRA_JQL` secret:** `project = BMPCC AND fixVersion = "PI 2026.3 CM" AND (assignee = currentUser() OR assignee = "ruby-isabelle.costigan@allianz.de" OR summary ~ "Figma" OR summary ~ "UI/UX" OR summary ~ "UX")`. Re-ran sync: 123 → 52 active tickets (2 epics + 52 tickets, down from 7 epics + 123 tickets). Sample of the 52 includes many other design-team members' work too (Unnikrishnan Nair Anurag, Parameswaran Janaki, Mukund Saraf Akanksha) — an accepted false-positive per the task's own "prefer false positives" rule; narrowable further via Stage 5's assignee filter.
- **Stage 3 — Archived stale tickets:** 116 tickets marked `archived = true` (no deletes — used the sync's own `started_at` as a cutoff: any `ticket.updated_at` older than the new sync's start was, by definition, not in its result set). Verified: active count dropped from 168 (123 old + 45 new-to-DB, e.g. Isabelle's) to exactly 52, matching the sync's own `ticketCount`.
- **Stage 4 — `prototype_route`:** reported before acting — `ticket_state.prototype_route` did **not** exist in the live schema (task assumed it did; confirmed via `information_schema.columns`). Added via migration `0003_tracker_prototype_route.sql` (additive, nullable text). Detail panel gets an editable "Prototype route" input (save-on-blur, same pattern as the existing blocked-note field) + an "Open in prototype" link using `[routerLink]` (same-origin, no `window.open`), hidden when no route is set. Populated 20 of the 52 active tickets with verified routes (checked `app.routes.ts`/`fnol.routes.ts` directly rather than guessing path segments) — e.g. `BMPCC-16104` (Claim Re-Open) → `/claims/CLM-2024-001/overview`, `BMPCC-7133` (Policy Limits/Deductibles design) → `/claims/CLM-2024-001/limits`. Left 32 blank — no confident single-route match (e.g. tickets naming AOMS/TMR/AVA/Fraud modules that aren't part of this Angular app's routes at all, or spanning 2+ candidate routes with no way to pick one, or generic titles like "UI/UX design" with zero context). Skipped the tour-on-arrival bonus — tracker tickets (Jira-synced) and dev-banner tickets (`public/tickets/*.json`) are separate ID spaces with no existing mapping between them; building one wasn't asked for and would have complicated basic navigation.
- **Stage 5 — Filter UI:** status (multi-select, real values via `NxMultiSelectComponent`), epic (dropdown, derived from loaded tickets' joined epic), assignee (dropdown of real distinct values, replacing the old free-text `ilike` input), blocked reason (unchanged), has-prototype-route (any/yes/no), show-archived (checkbox, off by default). Filter state moved from component-local `FormControl`s into a new `TrackerService.filters` signal + `setFilters()` — `TrackerTableComponent` is destroyed and recreated by Angular when navigating between the `''` and `'ticket/:key'` route configs (different route objects, same component class, no custom `RouteReuseStrategy`), so filters would not have survived otherwise.
- **Schema changes:** `ticket_state.prototype_route text` (migration 0003, reported before running). No other schema change.
- **Files touched:** `supabase/migrations/0003_tracker_prototype_route.sql`, `tracker.model.ts`, `tracker.service.ts`, `ticket-detail-panel.component.{ts,html,scss}`, `tracker-table.component.{ts,html,scss}`. Plus: the entire tracker feature (Phase 1 build — guards/models/services/all tracker components/migrations 0001-0002/Edge Function) was built across earlier turns this session but never `git`-committed until now; committed together with this task's work since there was nothing to separate it from.
- **Notes:**
  - Two Supabase secrets were set (`JIRA_JQL`) and never committed — confirmed via `git diff --cached | grep` before every commit in this task, zero matches.
  - `.gitignore` gained `supabase/.temp/` — the Supabase CLI's own local cache directory, generated by every `npx supabase` call, accidentally staged once and removed before committing.

---

## 2026-08-20 — Tour system + prototype version separation (stages 1–6)

- **Source:** Tour-system audit (this session, same day) → `/goal` autonomous execution of the audit's sequencing plan
- **Module:** Deploy config, dev banner, tour engine, `claim-overview`, ticket schema
- **Stage 1 — Fix `deploy:exploration`:** `angular.json`'s `exploration` config and `build:exploration`'s `--base-href` both changed from sharing prod's base-href to `/claim-management-prototype/exploration/`. Added `deploy:exploration` (never executed) pushing to a `exploration` subfolder of the same `gh-pages` branch via `--dest`. Verified by inspecting the emitted `<base href>` in each build's `dist/`, not by deploying.
- **Stage 2 — `devBannerMode` flag:** Added `'full' | 'reviewer' | 'off'` to `Environment`. All three environments start at `'full'` — no behavior change.
- **Stage 3 — Split the banner:** `claim-dev-banner.component.{ts,html}` and `claim-dev-details-modal.component.{ts,html}` gate their dev-only widgets (Reset, reference-view picker, state inspector) behind `devBannerMode === 'full'`. `app.ts` gates the whole banner behind `!== 'off'` and the FNOL quick-fill banner behind `=== 'full'` only (no reviewer subset — it's pure dev convenience). `applyAC()`/`onGoTo()` untouched — presentation only, verified byte-identical via build + `pre-commit` + `audit:ac-logic`.
- **Stage 4 — Tour engine:** New `core/services/tour.service.ts` (signals, `providedIn: 'root'`, `RightStripService`-shaped) and `shared/components/tour/tour-step-renderer.component.ts` (renders once at app root; locates targets via `document.querySelector('[data-tour-id]')` + `getBoundingClientRect()` since `NxPopoverTriggerDirective` is compile-time bound to its host and can't be wired onto components this task isn't allowed to modify beyond adding `data-tour-id`). New `--tour-overlay-z: 5000` token in `styles.scss`. Hooked into `ScenarioStageService` via a new `'tour.start'` `PostLandHook` kind. **Decision:** FNOL tours are scoped to a single screen (not detection/restart) because `FnolStateService` overrides don't survive a refresh, unlike the sessionStorage-backed general `ScenarioOverrides`.
- **Stage 5 — `data-tour-id` hooks:** Two attributes added to `claim-overview.component.html` (`co-tasks-widget`, `co-close-claim-button`) — no other change to that file. Recorded the `data-tour-id` exception in `PROJECT.md` next to the pre-existing `data-testid` rule it could be confused with (different consumer: highlight positioning, never click-simulation).
- **Stage 6 — First tour + parity check:** `DevTicket.walkthroughSteps` extended from `string[]` to `Array<string | TourStep>` (never rendered anywhere before, so nothing to migrate). `ClaimDevHelperService.runPostLandFor()` synthesizes a `tour.start` hook from a ticket's structured `walkthroughSteps` **only when the matching AC has no `postLand` of its own** — avoids fighting `ready-to-close.json`'s AC-02, which already auto-opens the closure modal. Authored the first tour on `ready-to-close.json` (CHAMP-READY-CLOSE): 2 steps (Tasks widget, Close Claim button). Full parity check written to `/TOUR_PARITY.md` — **zero blockers**: every ticket's `done` ACs remain reachable via the reviewer launcher because the apply/mutation pipeline was never touched, only dev-only widget visibility.
- **Schema changes:** `DevTicket.walkthroughSteps` type widened (backward-compatible — old plain-string tickets need no change). No `ScenarioOverrides` change.
- **Files touched:** ~14 across `angular.json`, `package.json`, `src/environments/`, `src/app/app.ts`, `src/app/core/services/tour.service.ts`, `src/app/core/scenario/`, `src/app/shared/components/tour/`, `src/app/features/claims/dev-banner/`, `src/app/features/claims/claim-overview/claim-overview.component.html`, `PROJECT.md`, `public/tickets/ready-to-close.json`, `TOUR_PARITY.md`.
- **Stage 7 — Flip stable to reviewer mode:** ran, gated on `TOUR_PARITY.md` showing zero blockers. `environment.prod.ts` → `devBannerMode: 'reviewer'`. Verified by inspecting the built bundles directly (not deploying): `npm run build` emits `devBannerMode:"reviewer"`, `npm run build:exploration` emits `devBannerMode:"full"` — confirmed as two distinct, non-conflated outputs.
- **Notes:**
  - Only 1 of 13 tickets has an authored tour (CHAMP-READY-CLOSE) — the other 12 are a backlog item, not a regression, since Apply still works for all of them unchanged. See `TOUR_PARITY.md`'s Backlog section.
  - Could not visually verify the tour's on-screen appearance (highlight ring, popover stacking) — no browser tool available in this session. Verified via build/audit/direct DB-equivalent checks only, same limitation flagged in earlier tracker work this session.

---

## 2026-08-19 — Notes panel collapse toggle: chevron direction reversed (mirrored copy-paste bug)

- **Source:** User screenshot + report — expanding the notes panel left the collapse-arrow pointing the wrong way ("note มัน expand แล้วทำไมลูกศรไม่ชี้กลับไปวะ").
- **Module:** `features/layout/claim-right-strip/claim-right-strip.component.html` (`.crs-toggle` icon binding only — no `.ts`/`.scss` change).
- **Root cause:** the ternary `[name]="collapsed ? 'chevron-right' : 'chevron-left'"` was copy-pasted from `sidebar.html`'s footer toggle, which is correct there because the main nav sidebar is anchored on the LEFT edge (expanded → point left/collapse-toward-edge, collapsed → point right/expand-into-view). `claim-right-strip` is anchored on the RIGHT edge, so the same literal ternary pointed both chevrons backwards relative to their actual collapse/expand direction.
- **Fix:** reversed to `collapsed ? 'chevron-left' : 'chevron-right'` — collapsed now points left (expand-into-view direction), expanded now points right (collapse-toward-own-edge direction), with a code comment explaining the mirroring so it isn't re-copied verbatim again.
- **Checked for other direction-dependent code in the same component:** `.scss` has `right: 4px` (badge position, unrelated) and `border-left: 1px solid var(--ui-04)` (correct as-is — right-anchored panel needs a left border to separate from content). No other fixes needed.
- **Audit:** `npx tsc --noEmit` clean, dev-server log clean, Playwright screenshots confirmed both states visually (`>` when expanded, `<` when collapsed).

---

## 2026-08-18 — Edit Claim Phase 2, Item 5: Event details removal re-verified, no contradiction

- **Source:** Isabelle's Phase 2 build brief flagged an apparent contradiction between two audits: an earlier one (2026-08-16 entry, line ~137 below: "explicitly out of scope") and a later one reporting Events details "fully absent." Re-verified by grepping `edit-loss-information.component.{ts,html}` for `event`/`FormArray` directly.
- **Not a contradiction — a timeline.** The 2026-08-16 entry describes state *before* this removal was done: at that point Events details was deliberately left alone (out of scope for that session's causeDetails cleanup). The 2026-08-18 entry earlier in this file ("Edit Loss Information: Events details card removed") is where it was actually removed, *within this same session*, per Ruby's Miro decision. The later "fully absent" audit is correct because the removal already happened; the earlier "untouched" note was also correct for its own point in time. Both audits were right when they were written.
- **Verification now:** no `events` FormArray, no Events details card markup, no orphaned helper methods in either file — confirmed clean (this was already the state after the same-session removal; nothing new to delete).
- **One leftover found and fixed:** `eli-section-desc` copy under "Loss information" still read "Cause of loss determines the events listed below" — a stale reference to the removed card. Removed the line (`edit-loss-information.component.html`).
- **FNOL confirmed untouched:** `step-loss-information.component.ts/html` still has its own, separate `eventsArray` (via `FnolStateService.getLossEventsArray()`) and "Events details" card, fully intact — FNOL still captures events at notification, per the original consolidation decision that this removal is edit-screen-only.
- **Model fields (`LossInformation.events`, `.typeOfDamage`) intentionally NOT removed** — FNOL still writes them, so they are not orphaned at the model/service level, only unused by the edit screen's UI.

---

## 2026-08-18 — Edit Claim Phase 2, Item 3: real Provider Management page; Instruct provider/Make payment wired away from modals

- **Source:** Isabelle's confirmed Phase 2 decisions.
- **Module:** new `features/claims/provider-management/*`, `app.routes.ts`, `sections.ts`, `status-chip.component.ts`, `provider-assignment.model.ts` + fixture.

1. **`MockProviderService`/`ProviderAssignment` already existed** (per the brief's own hint to check first) — backing `hasActiveProvider` closure-blocker logic (`claim-closure.service.ts`), but with no display page anywhere. Built `ProviderManagementComponent` on top of it rather than a new service: `claims/:id/providers` now `loadComponent`s a real page instead of `redirectTo: overview`. Follows the Litigation/Financial page conventions exactly — `route.snapshot.paramMap.get('id')` with `.parent` fallback (matching `financial-overview.component.ts:90-91`, not Litigation's `.parent`-only read, which looked likely-broken on inspection — see flag below), `NxTableModule`/`nxCell` (not Sections' `nxTableCell`), `PageHeaderComponent`, `EmptyStateComponent`, `StatusChipComponent`.
2. **Columns:** Provider name, Type, Status (chip), Assigned date, Contact. `contact` didn't exist on the model — added as an optional field, backfilled on the 2 existing `CLM-2024-001` fixture records only (no new records, no status changes — `getActiveAssignmentsForClaim` feeds `hasActiveProvider`, and CLM-2024-001's closure ACs depend on that being false today; adding an 'Active' record would have risked the 49/49 `audit:ac-logic` requirement, so deliberately not done).
3. **New `provider-assignment` StatusChipComponent domain** (Active/Completed/Cancelled), reusing existing color tokens (`claim-status-bound`/`-closed`/`-declined`) rather than inventing new ones — same borrow-don't-invent pattern as the existing `policy` domain.
4. **`onInstructProvider`/`onMakePayment` in `sections.ts` now navigate instead of opening modals.** Instruct provider → `/claims/:id/providers?sectionId=<id>` (the new page reads this query param and highlights the matching row — built fresh, so no gap here). Make payment → `/claims/:id/financial?view=payments` (Financial Overview's existing `view` query param, confirmed already consumed at `financial-overview.component.ts:48-49`). **Gap noted, not fixed:** Financial's `sectionId` signal (`financial-overview.component.ts:47`) is only ever set internally from loaded data — it does not read a query param — so Make Payment cannot pre-filter to the clicked section today. Fixing that is a change to Financial Overview, out of scope here.
5. **`MakePaymentModalComponent`/`InstructProviderModalComponent` deleted** — confirmed via grep that `sections.ts` was their only caller before removing the imports and the files.
- **⚠ FLAGGED — pre-existing possible bug noticed, not touched.** `LitigationComponent` reads claim id via `this.route.parent?.snapshot.paramMap.get('id')` only (no fallback to its own route). Since `claims/:id/litigation` declares `:id` directly on its own route (not a parent), and the Shell wrapper route (`path: ''`) has no `:id`, this read looks like it should return `undefined`/empty. Not fixed — out of scope for Phase 2, flagging for whoever owns that page next.
- **Audit:** `npm run build` 0 errors, `npm run pre-commit` 17/18 (same pre-existing `audit:ndbx-wrapper` failure), `npm run audit:ac-logic` 49/49 confirmed unaffected. Verified in-browser: Provider management page renders both fixture rows with contact info; "Instruct provider" navigates and highlights the correct row via `sectionId`; "Make payment" lands directly on the real Payments tab.

---

## 2026-08-18 — Edit Claim Phase 2, Item 4: cause-of-loss/location redirect signed off

- **Source:** Isabelle's confirmed Phase 2 decisions ("BUILD — Edit Claim Phase 2").
- The existing `onSaveChanges()` behavior in `edit-loss-information.component.ts` (cause-of-loss or location change → warning toast + redirect to Sections; otherwise → success toast + redirect to Overview) is now the **confirmed, signed-off** behavior — no logic change. Removed the "conservative placeholder, not signed off, flag before treating as final" language from the code comment (lines around 247-256) since that caveat no longer applies; kept the factual explanation (no structured section↔cause/location link exists, so any change is conservatively treated as sections-impacting).
- No files besides the comment touched. No new tests needed — behavior unchanged.

---

## 2026-08-18 — Edit Claim Phase 2, Item 2: Add entity → damage-type multi-select with grouped entity checklists

- **Source:** Isabelle's confirmed Phase 2 decisions, referencing her Miro sketch (grouped lists per damage type).
- **Module:** `add-section-entity-modal.component.{ts,html,scss}`, `sections.ts` (`onAddEntity`).

1. **Removed the free-text "Entity name" input entirely.** No typed name path remains.
2. **Damage type is now `nx-multi-select`**, not a single dropdown — matches the exact `[options]/selectValue/selectLabel` pattern already used for FNOL's Cause of loss / Type of damage multi-selects (`step-loss-information.component.html:60-76`), not invented fresh.
3. **One independent checkbox group per selected damage type**, titled with the damage type name, entities listed as `nx-checkbox` rows. Selections are tracked per damage type (a `Record<string, Set<string>>` signal), not a shared reactive-forms array — simpler for a dynamic number of independent groups.
4. **Single "Add entity" submits all selections across all groups at once** — one `AddSectionEntityModalResult` with `entities: { name, damage }[]`, plus one shared `sectionId`/`instructionStatus` for the whole batch (Section and Instruction status dropdowns unchanged, as specified).
5. **⚠ FLAGGED — entity list source invented.** No damage-type → entity mapping existed anywhere in mock data (confirmed by grep, per the brief's own point 7). Added `DAMAGE_TYPE_ENTITIES` inline in the modal component — generic, demo-plausible names per damage type (e.g. Material damage → Warehouse Racking, Loading Dock Doors...), not tied to any real claim's fixtures. **If Isabelle has a real candidate-entity list, this mapping needs to be replaced, not just extended.**
6. **Bug found and fixed while wiring the multi-entity submit:** `MockSectionService.addEntity()` mutates the shared `ClaimSection` object in place (the service never clones — `list()`/`respond()` pass the same references straight through). `sections.ts`'s `onAddEntity()` was *also* manually appending a client-fabricated entity to the `sections` signal after calling the service — double-adding every entity (visually: the same name/damage appeared twice per submission). This bug pre-dates this session (the original single-entity code had the identical pattern, just less visible with only one entity at a time). Fixed by letting the service's in-place mutation stand and just refreshing the outer array reference (`this.sections.update(list => [...list])`) to trigger re-render, instead of appending a second time.
- **Audit:** `npm run build` 0 errors, `npm run pre-commit` 17/18 (same pre-existing `audit:ndbx-wrapper` failure), `npm run audit:ac-logic` 49/49. Verified in-browser: selecting 2 damage types renders 2 independent checkbox groups; checking one entity in each and submitting adds exactly 2 entities (confirmed no duplication after the fix) with the correct damage type per entity.

---

## 2026-08-19 — Edit Loss Information: safety-review redesign (mode visibility, read-first fields, change ledger, leave-guards)

- **Source:** Full-rigor UX/UI safety review (human-factors framing: Torrey Canyon/mode visibility, Three Mile Island/real-state feedback, Rental Car/muscle-memory, Therac-25/irreversible-action, Bhopal/alarm signal-to-noise). Executed items 1-5 of the delivery order under four explicit constraints.
- **Module:** `edit-loss-information.component.{ts,html,scss}`, new `edit-loss-information.guard.ts`, new `edit-loss-information.component.spec.ts`, `app.routes.ts`.

**Constraint 1 — §3.5 high-impact set left as-is (cause of loss, loss location only).** Date of loss was NOT added to `IMPACT_LABELS` — that's an open product question, not a resolved one (only cause-of-loss and location have ever been signed off as sections-impacting, both on 2026-08-18). **Flagging for product:** should a date-of-loss change also redirect to Sections for review? Not decided.

**Constraint 2 — §3.6 (version/concurrency check) dropped from scope, not built.** This is a mock-data prototype with no real backend — simulating optimistic-concurrency-control against a mock service would be theater (no second real user to conflict with). **BACKLOG, trigger: "before go-live on a real backend."**

**Constraint 3 — commit-control geometry break (#4) shipped together with read-first fields (#2), not after.** Both landed in the same change; the footer's Save button was never left sitting at FNOL's trained "Next" coordinates while the rest of the redesign rolled out.

**Constraint 4 — Gate Proof performed for real on the 3 named acceptance criteria**, in `edit-loss-information.component.spec.ts` (26 tests total, all passing). For each of the 3: planted a violation in the real component code → ran `npm test` → confirmed the specific test went RED → reverted → confirmed GREEN again:
  1. "Save unreachable while ledger empty" — violated `pendingChanges` to always return a non-empty diff → 3 tests failed red → reverted → green.
  2. "Leaving with pending changes intercepted" — violated `confirmLeaveIfDirty` to always return `true` → the blocking-behavior test failed red → reverted → green.
  3. "Modal doesn't fire for low-impact-only" — violated `hasHighImpactChange` to treat every change as high-impact → both the logic test and the behavioral "modal not opened" test failed red → reverted → green.
  - **Real bug found and fixed by this same test-writing process** (not a planted violation — a genuine pre-existing gap this work introduced and caught before shipping): `pendingChanges()` compares live form values against `original()`/`originalClaimDescription()` snapshots taken at load, independently of `form.dirty` — after a successful save, those snapshots were never updated, so the ledger (and therefore the canDeactivate guard) still saw the just-saved values as "pending," firing the leave-confirmation modal on the save flow's own post-save `router.navigate()`. Fixed by updating both snapshots right after a successful save, before navigating.
  - **Testing infra note:** `NxDialogService` cannot be overridden via a TestBed-root provider for this component — `NxModalModule`, imported directly into this standalone component, appears to re-provide it at the component's own injector level, shadowing a root-level override. Had to use `TestBed.overrideComponent(..., { add: { providers: [...] } })` instead. Worth knowing for any other component test that opens NDBX modals.

**Build details (items 1, 2, 5):**
- **Header (§3.1):** built entirely from `PageHeaderComponent`'s existing API — `showBack`/`backLabel`/`(back)` for the breadcrumb, `subtitle` for client name, `eyebrow` for claim ID, and the existing `actions` projection slot for a new `StatusChipComponent` + change counter. No new header component, no fork of the shared one.
- **Read-first fields (§3.2):** Claim description, Cause of loss (already done 2026-08-18), the combined date-of-loss group ("When did the loss occur?" — occurrence + notification date/time as one editable unit, a deliberate simplification of "6 fields" into their existing sub-heading grouping), and Loss description all converted to read/edit/changed states. **Loss location was NOT converted** — `LocationPickerComponent` already renders as a table of current locations with a per-row Edit action, which is already read-first by construction; only added a "was/Revert" line above it for ledger consistency. Single-field-open-at-a-time via one unified `editingField` signal (replacing the old standalone `causeEditMode`) — the spec's own stated default, not a resolved multi-open-fields question.
- **Change ledger (§3.3):** `pendingChanges` is a `computed()` wrapping the existing (now-reactive) `computeDiffs()` — the confirm modal, the ledger, the header counter, and the Save-button gate all read the same signal instead of four separate checks.
- **Commit control (§3.4):** Save disabled while `pendingChanges().length === 0`; footer is `justify-content: space-between` with Save on the LEFT and Discard on the RIGHT — the reverse of FNOL's footer, and the reverse of where a trained "primary button, bottom-right" reflex would land. **Kept the same button size as Discard** (`primary small`, not a distinct size) — a first attempt used a larger, unsized `primary` button as a second differentiation axis, but that tripped `audit:button-size`'s "no mixed sizes among siblings" rule; position + icon + dynamic label ("Save 3 changes") are the differentiators that survived. Discard states its cost ("Discard 3 changes"). Route-level `canDeactivate` guard (new `edit-loss-information.guard.ts`) + a `beforeunload` host listener cover in-app navigation and tab-close/refresh respectively — both share `confirmLeaveIfDirty()`, which also backs the Discard button's own click handler.
- **Structural (§3.7):** new `shared/styles/_form-section.scss` holds `card`/`section-heading`/`sub-heading`/`divider`/`two-col-grid` mixins, extracted verbatim from what `step-loss-information.component.scss` and `edit-loss-information.component.scss` had each hand-copied independently (confirmed identical values via the earlier audit) — both files now `@include` the shared mixins instead of redeclaring. `.eli-page` is now `max-width: 720px; margin: 0 auto` per `DESIGN_PRINCIPLES.md`'s own Form-page pattern (was 960px, FNOL's wizard width). `futureDateValidator`/`dateOrderValidator` moved to new `shared/validators/date.validators.ts`; `FnolStateService` keeps its static methods as thin delegates (as methods, not field assignments — a field initializer referencing a same-class static field declared later breaks on evaluation order, caught by the dev server's incremental compiler, not `tsc --noEmit`) so no other FNOL call site needed to change.
- **Audit:** `npm run build` 0 errors, `npx tsc --noEmit` clean, `npm run pre-commit` 17/18 (same pre-existing `audit:ndbx-wrapper` failure; a first pass introduced a NEW `audit:button-size` violation, caught and fixed before this entry), `npm run audit:ac-logic` 49/49, `npm test` 26/26 (including the 3 Gate Proof suites). Verified in-browser end-to-end: header/ledger/revert/footer render correctly; low-impact-only save skips the modal and navigates to Overview; high-impact save shows the modal and navigates to Sections; leaving with pending changes via the back-link triggers the discard modal; `beforeunload` correctly calls `preventDefault()` with pending changes.

---

## 2026-08-18 — Edit Claim Phase 2, Item 1: comment icon removed, panel redesigned, entry point moved to section-level

- **Source:** Isabelle's confirmed Phase 2 decisions. **Supersedes the entry below** ("Sections comment icon: scoped notes panel for 5+ notes") — that entry's per-line icon trigger was never signed off; this entry is the resolution.
- **Module:** `sections.{ts,html,scss}`, `right-strip.service.ts`, `claim-right-strip.component.{ts,html}`, `claim-notes-panel.component.{ts,html,scss}`.

1. **Removed:** the per-entity-row comment icon + count badge (`sec-comment-icon-btn`, `sec-comment-count`) and its whole "Comments" table column (header + cells + colspan math across loading/error/empty/section-header rows). `notesCountFor`/`hasNoteFor`/`viewEntityComments` and the `allNotes`/`claimIdSig` live-sync signals that only existed to feed them are gone too — dead once the trigger was gone.
2. **⚠ FLAGGED INTERPRETATION — new entry point.** Isabelle's brief named two options ("Claim Overview action area" or "a Sections-level 'View notes' button") without picking one. Built: a **"View notes" item in the section-level kebab menu**, next to the existing "Add note" item (`sections.html`, section context menu). Chosen over a Claim Overview action because it's the more surgical change (same menu, same interaction pattern as "Add note" which already existed there) and because per-entity notes still needed a way to surface once grouped — see point 3. **If Isabelle wanted the Claim Overview entry point instead, this is a small relocation, not a rebuild** — the panel and scope mechanism are entry-point-agnostic.
3. **Scope widened from "one entity" to "a section and its entities."** `RightStripService.openScoped(panel, label, names)` now takes a match list, not a single name — `onViewNotes(section)` passes `[section.name, ...section.entities.map(e => e.name)]`. Necessary because existing notes are attached at the entity level (`attachedTo: "Forklift"`), never at the section level — a literal section-name-only match would have shown zero notes for every real fixture. Not explicitly specified in the brief; flagging as the only way the feature could work with real data.
4. **Panel redesigned per spec — single flat list, minimal card.** Removed the PINNED/ACTIVITY split into one pinned-first-then-newest list (still respects the `pinned` flag, just no separate section header for it). Note card now shows exactly author, timestamp, body text, and one pin-toggle icon button — **removed the avatar, the category chip, and the per-note kebab menu** (edit/delete were unimplemented `/* phase 2 */` stubs already, so removing that menu costs nothing functional; pin/unpin was preserved as a single icon button since the "Pinned" filter needs a way to be populated). **⚠ FLAGGED:** "no per-note visual bloat" was read literally as "exactly these 3 things" — if avatar/chip/edit/delete were meant to stay and only the entry point + grouping needed to change, that's a partial revert, not a rebuild.
5. **Filter dropdown (All/Pinned/Recovery/Litigation/General) kept** — not mentioned for removal, and narrowing by category is a real aid at 20+ notes, which is the scale this redesign targets. Disabled in scoped view (filtering "this section's notes by category" wasn't asked for and the list is already small by definition).
6. Existing 5-per-page "Load more" pagination is unchanged and handles the "5+ notes" scale case — no virtual scroll needed at this data size.
- **Audit:** `npm run build` 0 errors, `npm run pre-commit` 17/18 (unchanged pre-existing `audit:ndbx-wrapper` failure, unrelated), `npm run audit:ac-logic` 49/49. Verified in-browser: Comments column gone, "View notes" opens scoped panel aggregating section + entity notes correctly (6 for Property Damage — Warehouse & Forklift), "All notes" flat list shows pinned-first ordering, minimal card renders with no avatar/chip/menu.

---

## 2026-08-18 — Sections comment icon: scoped notes panel for 5+ notes (proposal, not signed off) — SUPERSEDED, see entry above

- **Source:** Ruby's ask on the Sections review — "share a design on how the side-panel could look if there are 5 or more notes against a section." Built as a pilot to show her, per explicit instruction that anything built today for unclear/unconfirmed points is a proposal, not a finalized decision.
- **Module:** `note.model.ts`, `mock-notes.service.ts`, `right-strip.service.ts`, `claim-right-strip.component.ts/html`, `claim-notes-panel.component.{ts,html,scss}`, `sections.{ts,html,scss}`.

**Two real bugs found and fixed along the way (not just the design ask):**
1. **Notes were never actually linked to an entity.** The quick-add form collected an `attachTo` (CLAIM/SECTION/PARTY) value but `submitAddNote()` silently dropped it — `Note` had no field to hold it. `hasNoteFor()` in `sections.ts` was doing a fuzzy substring search (entity name inside `body`/`title`) and `.find()`-ing the *first* match only, so an entity with 5 notes only ever surfaced 1. Added `Note.attachedTo?: string | null`, persisted it for quick-add (where the entity name is known exactly), and switched the Sections lookup to an exact match + real count (`notesCountFor`).
2. **Comment counts went stale across components.** `sections.ts` loaded notes once into its own snapshot signal; the notes panel mutated a separate copy on add/pin. Adding a note via the panel didn't move the table's badge until a full reload. Rebuilt `MockNotesService`'s per-claim cache as a `WritableSignal<Note[]>` store (`notesSignal(claimId)`), and made `sections.ts`'s `allNotes` a `computed()` off that store instead of a one-time snapshot — verified live in-browser (badge went 5 → 6 immediately after adding a note from the panel, no reload).

**The design itself — reuses the existing right-strip Comments panel, no new UI surface:**
- Comment icon per entity row now shows a count badge (`sec-comment-count`) instead of just enabled/disabled.
- Clicking it opens the *same* `ClaimNotesPanelComponent` used everywhere else, but scoped: `RightStripService.openScoped('comments', entityName)` → panel shows a "← All notes" back link, a "Notes for '{entity}' (N)" header, and a flat chronological list using the exact same note-card template (avatar, pin/edit/delete menu, etc.) — no new card design. Existing 5-per-page "Load more" pagination handles the "5+" case without any new logic.
- "Add note" inside the scoped view pre-attaches to the entity being viewed (reuses the existing quick-add flow).
- Seeded 3 extra Forklift notes in `notes.json` (now 5) specifically so this could be demoed against Ruby's literal "5 or more" scenario, not just described.
- **Not addressed (flagged, not fixed):** the full add-note form's "Attach to" dropdown (CLAIM/SECTION/PARTY) still has no picker for *which* section/entity — only quick-add reliably sets `attachedTo`. Notes added via the full form stay claim-level. Separate gap, not touched.
- **Audit:** `npm run audit:all` 12/12, `tsc --noEmit` clean. Verified in-browser: badge counts correct per entity, scoped panel shows all of Forklift's notes with a working back-link, adding a note from the scoped view updates both the panel and the table badge live.

---

## 2026-08-18 — Edit Loss Information: Loss location joins the Sections redirect; Cause of loss becomes static value + Change

- **Source:** built from the flow-simulation proposals in the previous conversation turn — NOT signed off by Ruby, flagging both explicitly below.
- **Module:** `edit-loss-information.component.{ts,html,scss}`.

1. **Loss location added to the sections-impact redirect** (⚠ not confirmed — see caveat). Generalized the `causeChanged` check into `impactLabels = ['Cause of loss', 'Loss location']`; the toast message now names whichever changed ("Cause of loss changed" / "Loss location changed" / "Cause of loss and Loss location changed"), still redirects to Sections. **Caveat:** Ruby's own Miro doc marks the location→sections flow as "pending a user-flow" — she hasn't drawn this one herself yet. This reuses the cause-of-loss shape as a placeholder, not her design. Treat as a draft to run past her, not a shipped decision.
2. **Cause of loss is now a static value + "Change" link** instead of an always-open multi-select (⚠ new interaction pattern, not blessed, not requested by name — my own proposal from the flow-simulation discussion). Default state shows `causeOfLossDisplay` (mapped labels, joined) with an `nx-link` "Change" — copied verbatim from the `.co-field`/`.co-label`/`.co-value` + Reassign-link pattern on `claim-overview.component.html:26-40`. Clicking "Change" reveals the existing multi-select + a "Done" link to collapse back. Starts open only when the claim has no cause of loss on record yet (`causeEditMode.set(!li.causeOfLoss?.length)` in `prefillForm`). No change to the save/diff/redirect flow — same `causeOfLoss` FormControl underneath.
- **Audit:** `npm run audit:all` 12/12, `tsc --noEmit` clean. Verified in-browser: default load shows "Fire" + Change; clicking Change reveals the multi-select pre-checked; clicking Done with no edit collapses back to the same display cleanly.

---

## 2026-08-18 — Edit Loss Information: cause-of-loss change now redirects to Sections

- **Source:** Ruby's Miro flow ("Edit claim flow" diagram) — cause of loss change → "Triggers changes to existing sections" → user notified + redirected to Sections to review. Discussed as part of the broader "reduce the FNOL feel" push (see entry above).
- **Module:** `edit-loss-information.component.ts`, `onSaveChanges()`.
- On save, if `computeDiffs()` contains a `'Cause of loss'` entry, skip the normal success path and instead show a warning toast ("Cause of loss changed — Existing sections may no longer match — review them on the Sections page") and navigate to `/claims/:id/sections` instead of `/overview`. No cause change → unchanged behavior (success toast, navigate to overview).
- **Known limitation, called out rather than hidden:** `ClaimSection`/`SectionEntity` carry no structured field linking a section back to a cause-of-loss key — `name`/`damage` are both free text. There is no reliable way to compute *which* sections a given cause change affects, so this treats any cause-of-loss diff as sections-impacting and lets the user review manually, the same conservative call the old per-event-damage redirect made (removed above) before events existed. Precise matching would need a data-model change — not attempted.
- **Explicitly not built (per Ruby's own doc, not an oversight):** the equivalent redirect for **Location** changes — her Miro notes flag location as also sections-impacting but marks that flow "pending a user-flow," i.e. not designed yet.
- **Audit:** `npm run audit:all` 12/12, `tsc --noEmit` clean. Verified in-browser: adding a second cause of loss → confirm-diff modal shows the diff → save → warning toast + lands on Sections; editing only loss description → save → normal success toast + lands on Overview.

---

## 2026-08-18 — Edit Loss Information: Events details card removed

- **Source:** Ruby's Miro decision doc (Approach 1, chosen) — "Removal of event details" was called out explicitly under "To reduce the flow feeling like FNOL again," alongside a sticky note that the broader "how we capture event details" question still needs alignment. Previously left alone on purpose (see 2026-08-16 entry below: "explicitly out of scope").
- **Module:** `features/claims/edit-loss-information/*`.
- Removed Card 4 ("Events details" — per-cause "Caused by"/"Damages" checkboxes) from the template, and everything that only existed to feed it: the `events` FormArray + `eventsArray` getter, `onCauseOfLossChange` (rebuilt the array on cause selection — nothing else used it, so the `(selectionChange)` binding on the Cause of loss multi-select is gone too), the per-event diff block in `computeDiffs()`, the `typeOfDamage` FormControl + `selectedDamages` getter (only fed `onCauseOfLossChange`, no template binding of its own), and the 8 now-orphaned helper methods (`getEventGroup`, `getEventKey`, `getEventCauseOptions`, `getEventDamageOptions`, `isEventCauseSelected`, `toggleEventCause`, `isEventDamageSelected`, `toggleEventDamage`).
- **Also removed:** the `onSaveChanges()` branch that redirected to Sections with a "Damage types changed" warning toast when a per-event damage diff existed — that diff type no longer exists once events are gone, so the branch was permanently dead, not just unused.
- **Not touched:** `LossInformation.events`/`.typeOfDamage` on the model, `MockLossInformationService`, or mock fixtures — confirmed no other consumer reads them (grepped for `LossEvent`/`.typeOfDamage` outside FNOL and this component), so the data stays in place; only this screen's editing UI for it is gone. If "how we capture event details" gets resolved later, that's a fresh build against a clean model, not a revert.
- **Audit:** `npm run audit:all` 12/12, `tsc --noEmit` clean, visually confirmed on a Fire-cause claim (previously showed "Caused by"/"Damages" checkboxes) that the page now goes straight from "Locations of loss" to the footer.

---

## 2026-08-18 — Sections table: Status column, Reopen visibility, coverage-review color revert

- **Source:** Ruby (Isabelle) design feedback on the Sections page, relayed live.
- **Module:** Sections (`features/sections/sections.html`, `.scss`, `shared/components/status-chip`).

1. **Status column split out.** Section Open/Closed chip was inline with the section name in a merged `colspan="4"` cell; moved to its own "Status" header column, matching the Status-column pattern already used on `claims-list`. Widened `.col-comments` (56px → 80px) to stop the new column truncating the "Comments"/"Action" headers. First pass shrank `.col-coverage` to 180px to make room, which cut it below the ~234px the longest chip ("Additional information required") actually needs (measured, incl. padding) — that chip bled into the Comments icon. Restored `.col-coverage` to 240px and took the space from `.col-entity` (22%→18%) and `.col-damage` (26%→24%) instead, plus trimmed `.col-status` to 90px.
2. **"Reopen section" now hidden (not disabled) when the section is Open** — only rendered in the context menu when `section.status === 'Closed'`. Previously always rendered, just `[disabled]`. The other menu items (Make payment, Instruct provider, Close section) keep the existing disabled-when-closed pattern; only Reopen changed, per explicit ask.
3. **Coverage-review chip color mapping reverted to neutral.** The 2026-08-15 entry below (Row 8) flagged that `coverage-review`'s 3-color mapping (green/amber/red) was "an unconfirmed borrow, not a sign-off." Confirmed today: not signed off, revert requested. All 3 statuses (`standard-review`, `enhanced-review-required`, `additional-information-required`) now point to `claim-status-quoted` (the existing `#e8e8e8`/`#404040` neutral token, already used elsewhere for "no dedicated chip color yet") instead of `claim-status-bound`/`task-status-in-progress`/`claim-status-declined`. Only the `StatusChipComponent` TOKEN_MAP changed — no template changes, so `entity-detail-panel.component.html`'s coverage-review chip picks up the same neutral color automatically.
4. **Also touched, then reverted:** briefly removed `priority`/`lineOfBusiness` from `ClaimOverview` thinking they were unused (per an incomplete investigation that only checked `claim-overview.component.html`) — `ng serve` caught the break immediately (`tsc --noEmit` doesn't type-check templates, so this only surfaces at dev-server build time, same trap as the 2026-08-14 fire-details incident below). `claim-reference-panel.component.html` genuinely renders both fields. Restored; no net model change.
5. **Stray "…" mark under the toggle chevron, pre-existing.** `td[nxTableCell]`'s global `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` was tripping into a visible truncation mark on `.col-toggle`, even though that cell only ever holds an icon-button — the whitespace text nodes Angular preserves around the button (template indentation) were enough to read as overflowing content. Invisible at normal zoom, only showed up on a high-DPI crop. Not caused by today's column changes — this cell's markup wasn't touched — just never noticed before. Fixed by resetting `overflow/text-overflow/white-space` on `.col-toggle` only (`!important`, matching the existing override convention on `.col-comments`/`.col-actions` in the same block); other columns' ellipsis behavior is untouched.
- **Audit:** `npm run audit:all` 12/12. Dev server compiles clean.

---

## 2026-08-15 — PI 2026.3 UI/UX Alignment: bullet-level re-audit, 2 bug fixes, 3 new builds

- **Source:** Confluence "Claims Management- PI 2026.3 - UI/UX Alignment Open Points" — a second, bullet-by-bullet pass over all 14 rows (the 2026-08-12 entry below only checked row-level status). No Jira MCP access this session (`jmp.allianz.net` requires SSO login WebFetch can't pass) — ticket numbers referenced are from the Confluence text only, not read directly.
- **Module:** Claim Overview (Recovery Potential, Reassignment), Dashboard, Sections (Entity Detail Panel), Claims List
- **Explicit instruction this pass:** leave anything already built/changed alone; build anything not-yet-started; fix bugs found along the way and log them.

### Bug fixes
1. **Recovery Potential rejection note was validated then discarded.** `recovery-potential-modal` requires a note when the user picks "No," but `claim-overview.component.ts:openRecoveryPotentialModal` only ever read `result.value` — `result.note` had nowhere to go; `ClaimOverview` had no field for it. Added `recoveryPotentialNote?: string` to the model, persisted it, shown as a muted caption under the "No" chip, and folded into the activity-log `valueNew`.
2. **Dashboard scope filter silently showed the wrong claims.** `displayedClaims` (`dashboard.ts`) fell back to the unfiltered top-5 claims whenever the `mine`/`group` scope produced zero rows — a Claim Handler with nothing assigned would see other people's claims with no indication the filter didn't apply. Removed the fallback; an empty filtered result now renders as empty (see empty-state below).

### New builds
3. **Row 2 (Dashboard) points 1–3 + 5, still genuinely open:** no default date range ever existed for the Claim Board or count widgets, and the KPI/portfolio table had no way to include Closed claims or show an empty state. Resolution notes never actually specified a literal date value (only a status default), so I didn't invent one — added a status filter instead (`claimsStatusFilter`: `open` (default) / `closed` / `all`, persisted to `localStorage` like `claimsScope` already was) plus `<app-empty-state>` on the claims tab, matching the pattern the loss-events tab already had.
4. **Row 8 (Coverage Status color), second half.** The 2026-08-12 entry below only fixed Sections; the Confluence ask named the E&D page too. `entity-detail-panel.component.html` (features/sections) still rendered `coverageReview` as a bare `<span>`. Swapped it for `<app-status-chip domain="coverage-review">` — the token map already existed, so this was a one-line template change, no new tokens.
5. **Row 7 (Manual claim reassignment, single + multiple) — built from zero.** Confluence's own note says this is blocked on "CTR availability"; built anyway per explicit instruction. New shared `ReassignClaimModalComponent` (`shared/components/reassign-claim-modal/`) — picks a new handler from `MockUserDirectoryService.getClaimHandlers()` (new method, filters `user-directory.json` by role), optional reason. Wired in two places: a "Reassign" link next to "Assigned Claim handler" on Claim Overview (single), and a checkbox column + bulk action bar on `claims-list` (`/claims` — select N rows → "Reassign N claims", updates each via `MockClaimService.update`). One checkbox selected = the "single" case; the same flow covers both without a second component.

### Left alone (already built/changed, or a real business decision, not a UI/UX call)
- **Row 5, Fire details on Edit Loss Information — do not touch.** Built 2026-08-12 (see below), then deliberately deleted again on 2026-08-13 (`68a7492`, "per Isabelle's design review... this is a requirement change, not a cleanup"). Confluence (last updated 2026-08-11) doesn't know about either commit and still shows this row as "Open, ETA 12 Aug, debugging." This needs a product decision, not another code change — see the existing warning at the top of `edit-loss-information.component.ts`.
- **Row 6, Section Overview Action-menu scope creep.** Section-row menu now has 6 items and entity-row menu has 5, against a 2026-07-09 resolution that asked for exactly 2 (Close Section, Edit). Likely legitimate later tickets landed in the same menu, but nobody has confirmed the expanded set with NAT — flagging, not trimming it.
- **Row 10, Close Claim checklist wording.** The reverted checklist doesn't literally list "retention date" or "limits" as checklist rows (retention is a separate form step); read as intentional restructuring, not a gap, so left as-is.
- **Rows 1, 9 (core flow), 11, 12, 13, 14 — confirmed already fully built in code**, even though Confluence's own log still shows several of them as "awaiting design" (row 1 mass-event: shipped and refined twice since; row 9 recovery-potential: full flow already existed before this session, only the note-persistence bug above was new; row 12 file-restriction: code has already picked "direct toggle," Confluence never recorded that decision). Not re-touched — Confluence is the stale side here, not the code.
- **Row 8 color choices — still an unconfirmed borrow, not a sign-off.** `coverage-review` domain reuses `claim-status-bound`/`task-status-in-progress`/`claim-status-declined` tokens rather than bespoke colors; Confluence's own row 8 has no resolution text at all (just a bare date), so no one has actually signed off on these 3 colors either time they were applied.
- **BLESSED.md modal SCSS pattern was stale and actively causing bugs** — its documented header/body/footer padding shorthand doubles the horizontal inset `NxModalContainer` already applies (the exact defect `audit-modal-padding.mjs` describes fixing in `recovery-potential-modal`/`add-litigation-party-modal`/`start-investigation-modal` on 2026-08-14). Corrected the doc to the vertical-only pattern those three files now actually use, so the new `reassign-claim-modal` didn't copy the same mistake a fourth time.
- **Files touched:** `core/models/claim-overview.model.ts`, `features/claims/claim-overview/claim-overview.component.{ts,html,scss}`, `features/dashboard/dashboard.{ts,html}`, `features/sections/entity-detail-panel/entity-detail-panel.component.{ts,html}`, `core/mock/services/mock-user-directory.service.ts`, `features/claims/claims-list/claims-list.component.{ts,html,scss}`, new `shared/components/reassign-claim-modal/reassign-claim-modal.component.{ts,html,scss}`, `.claude/BLESSED.md`.
- **Audit result:** `npm run build` 0 errors. `npm run pre-commit` 17/18 — the 1 failure (`audit:ndbx-wrapper`, navbar + restriction-search bare inputs) is pre-existing and untouched by this pass (confirmed via `git diff --stat`, zero changes to either file's search-input lines).

---

## 2026-08-13 — Mass Event popover: action labels, role gating, detail level

- **Source:** design review, 3 observations on the Mass Event prototype (no ticket JSON — the mass event work has never had one, and BMPCC-10510's override design lives only in a code comment, which is why the terminology was arguable in the first place)
- **Module:** Claim Overview — mass event popover
- **Root cause of observations 1 and 2:** every link action sat behind `auth.isKcm()` (`html:123`). The default persona is Mara Mustermann (`claims-handler`), so a reviewer who does not switch persona sees exactly one action, the override. "Change mass event" and "Unlink" both existed and both worked; they were invisible.
- **Fix — 1:** `Change mass event` → **`Link mass event`**, open to any handler. One term for one concept, matching the empty-state `+ Link mass event` that was already there. `onChangeMassEvent` keeps its name and its "Replace linked mass event?" confirm step.
- **Fix — 2:** `Unlink` → **`Unlink mass event`** (link label and confirm button both), open to any handler. The override stays as a distinct operation and is now **`Not associated with this claim`** with a hint line under it ("Keeps `ME-…` on the claim as a record and stops automatic checks. Unlink removes it instead."). Its confirm dialog spells out the same distinction. `Confirm link` stays KCM-only, because signing off an automated allocation is governance rather than a correction.
- **Fix — 3, reverses a recorded decision:** `View full details` opened `MassEventEditModalComponent` in `mode: 'view'` — the 194-line admin create/edit form, ~15 fields. That was decided on 2026-06-09 and recorded in this file (see the BMPCC-ME-POPOVER entry). The link is now KCM-only. Handlers instead get a `Cause` row added to the popover summary, which is the field they were reaching into the admin form for. All 10 fixtures carry `lossCause`, so it renders on both demo claims.
- **Also changed:** the empty-state role split is gone. PI 2026.3 item 3 (the field renders rather than vanishing when there is no mass event) still holds, but its dash-for-handlers branch is removed, because the stated reason — "a handler has no real next step here" — stopped being true once handlers could link. Footer reordered most-used first; `View full details` no longer sits on top.
- **Not touched:** `MockMassEventService` and all link/unlink/override service methods, the search modal, the admin Mass Events page, the popover's Type/Code/Period/Location rows.
- **Known and left:** `claim-overview.component.{html,ts,scss}` are 511/629/804 lines against the 200/300/250 limits. Pre-existing, and splitting a 500-line overview template is its own piece of work.
- **Audit result:** build 0 errors, `pre-commit` 16/17 (the 2 documented `VIOLATIONS.md` `audit:ndbx-wrapper` exemptions), `audit:ac-logic` 53 ACs, 49 ✅ / 0 ❌ / 4 skipped.

---

## 2026-08-13 — Consolidate edit screens (delete Edit Claim, re-home Claim description, remove cause details)

- **Source:** Isabelle's design review, 2026-08-13 — one edit path per claim instead of two, and the cause-specific detail fields go. No ticket JSON; verbal/design brief only.
- **Module:** Claims — `/claims/:id/overview`, `/claims/:id/loss-information/edit`; FNOL — loss-information + skeleton-create steps
- **Screen deleted:** `features/claims/edit-claim/` (7 files, 537 lines) plus the `claims/:id/edit` route. Edit Claim was created in commit `405222b` with no ticket and no requirement behind it, and it never got a CONVERSIONS entry — this deletion closes a gap that should not have opened. Confirmed zero external references before deleting. The old URL falls through to the existing `**` → `dashboard` redirect, so no dead end.
- **⚠ Requirement change, not cleanup — fire details:** the Fire details block was live UI (reactive `toSignal` on `causeOfLoss.includes('fire')`, never a hardcoded `false`), backed by populated fixtures on 4 of 7 mock records, and it rendered on both demo claims. Removing it drops capture capability that BMPCC-415 shipped on purpose. If those fields come back, this needs a product decision, not a revert.
- **Dead code — water/theft details:** model types, FormGroups and fixture data all existed, but no template ever rendered them. Removed as part of the same cut.
- **Claim description re-homed:** moved from Edit Claim to `edit-loss-information`. It lives on `ClaimOverview`, so it saves through `MockClaimOverviewService.updateGeneralInfo` and logs against a `Claim` objectType, while every other field on the screen saves through `MockLossInformationService`. Three things this forced: control named `claimDescription` and destructured out of the payload before save (that service spreads whatever it receives onto the stored loss-info record); its diff computed *before* the `LossInformation` guard in `computeDiffs()`, because a claim can arrive with no loss-info record and a description edit must still register; `syncOverviewFromLossInfo` gained a `description` patch key.
- **Two-description UX:** each description got its own card and its own hint. `Claim description` sits alone in a "Claim details" card ("Applies to the claim as a whole, not to a single loss event"; hint "General claim summary — shown on the claim overview"). `Loss description` stays in the card now titled "Loss information" (was "General information"), hint "What happened during the loss event". Page header retitled "Edit claim details"; overview now shows one edit link with that same label.
- **Deviation from brief:** `claimDescription` did *not* inherit Edit Claim's `Validators.required`, only `maxLength(500)`. A skeleton claim synthesizes its description from `lossDescription` and can arrive empty; requiring it would block an unrelated governed loss-info save.
- **Model fields removed:** `FireDetails` / `WaterDamageDetails` / `TheftDetails` / `CauseDetails` interfaces; `causeDetails` from `LossInformation` + `LossInformationFormValue`; `waterSources` / `showFireDetails` / `showWaterDetails` / `showTheftDetails` / `showCauseDetailsSection` from `LossInformationVM`. Lookup methods `getPriorities()` / `getLinesOfBusiness()` / `getWaterSources()` deleted from `MockLookupService`.
- **Model fields retained deliberately:** `priority` (claims-list filter + `PriorityDotComponent`), `lineOfBusiness` (claims-list filter), `assignedHandler` (actor identity in the closure/reopen audit trail), `client`, `broker`, `clientContact` (overview still displays it). Only the *edit controls* went with the screen. `updateGeneralInfo` survives — Edit Loss Info calls it.
- **Two consumers the audit map missed:** `step-skeleton-create.component.ts` called `getCauseDetailsGroup()` and carried its own dead `show*Section` getters plus `fireDeptCalled` accessors, making it a third consumer nobody had counted. And `claims.json` held 3 `causeDetails` blocks nested inside `lossInformation` objects that no TypeScript reads (`Claim` never declared that key). Both cleaned — leaving keys no interface models is exactly the silent-staleness failure RULE -1 exists to prevent.
- **Fixtures:** `loss-information.json` — all 7 `causeDetails` keys removed (5 populated + 2 empty `{}`; the brief said 5). `claims.json` — 3 nested blocks removed. Deletion-only diffs, `events` and `lossDescription` untouched on every record.
- **Not touched:** Events details card and the `events` FormArray (only post-notification edit path for event data — explicitly out of scope). `lookups.json` still carries `priorities` / `linesOfBusiness` / `waterSources` arrays, now unreachable, left in place under the "no mock data changes except the causeDetails strip" constraint.
- **Tech debt:** TD-003 (cause-details sub-field diffing) resolved as moot, struck through in `TECH_DEBT.md` with today's date. No other TECH_DEBT item referenced Edit Claim.
- **Audit result:** `audit:ac-logic` 53 ACs, 49 ✅ / 0 ❌ / 4 skipped — identical before and after the fixture change. `pre-commit` 16/17 at every one of the 9 checkpoints; the single FAIL is `audit:ndbx-wrapper` on the 2 pre-existing `VIOLATIONS.md` exemptions (`navbar.html:21`, `claim-overview.component.html:313`). Build 0 errors throughout.
- **Commits (one per step, each independently revertable):** `572f1c5` → `1421175` → `b299e61` → `3236fbc` → `59cf579` → `68a7492` → `3993dae` → `c4892a6`

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
