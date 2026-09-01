# Ticket Conversions

Append-only log of ticket → JSON conversions. Newest at top. Each entry should be terse — link to ticket file + capture decisions that aren't visible from `git diff` alone.

---

## 2026-09-01 — Production-repo gap closure, round 2: impacted policies, financial-loss capture

- **Source:** user instruction, verbatim: *"ไป map หน่อย ใน mai จริงมีอะไรแล้วเราไม่มีอะไร ไปสร้างตามซะ"* — re-diff the production repo (`~/Downloads/test figma mcp/claims-management-main`) against this prototype and build what is still missing. Second pass over the same repo as the 2026-08-31 entry, this time across the entities-damages MFE. Neither gap has a Jira ticket: nothing in `.agents/jira-clone/` or the production source references either feature, so both got prototype-local `CHAMP-*` ticket IDs, the same convention as `CHAMP-NO-LOSS-LOC`.

**Three gaps mapped, two built. The third was already built and my map was wrong about it** — see the correction below.

**Gap 1 — impacted policies (`CHAMP-IMPACTED-POLICIES`, 5 ACs).** A handler picks one policy in FNOL, and Entities & damages then only offers that policy's entities. When the damaged thing is insured under a sibling policy of the same risk the entity simply isn't in the list, with nothing on screen saying why. Built as a dismissible `nx-message` above the entity tree → "Possibly impacted policies" modal → merge into the tree.
- **The match basis is authored, not derived, and that is written down in the model.** I first tried to derive matches from `clientName`; querying `policies.json` proved no policy shares a client with POL-2024-001 (nearest is `POL-2023-010`, which has zero entities), so that derivation would have shipped an empty banner and an undemoable feature. `impacted-policies.json` is therefore a hand-written match map — but every *detail* (client, LoB, cover period, status, entity count) is read live from `policies.json` + `entities-damages.json`, so the counts cannot go stale the way the CHAMP-CLOSURE-001 `closedSections` assertions did. The reason no derivation is possible — the entity model carries no site or address field, real matching happens in the policy system upstream of this screen — is parked on `ImpactedPolicy.matchReason` in `core/models/impacted-policy.model.ts` so the next reader doesn't retry it.
- **Origin goes in the existing `coveredBy` column, not a new one.** `addEntitiesFromPolicy()` rewrites only that field to `"<cover> · <source policy>"`. Two reasons: the handler must see the limit sits on a different policy, and that column already asks "covered by what?" — and `step-entities-damages.component.html` was already at 223 lines against a 200 limit and its `.ts` at 307 against 300, so a new column would have meant splitting a blessed file as a side effect of an unrelated feature. All the new logic went into child components instead; the parent gained one template tag and ~20 TS lines.
- **`markAdded` runs only after the entities land.** A failed pull that still hid the policy from the banner would leave the handler with no route back to it.
- **A table, not production's accordion.** Production's `nx-expansion-panel` body holds only "Line of Business" — a click for one field. The table shows client, match reason, cover period, status chip and entity count at zero clicks, and follows the blessed `entity-search-modal` shape.
- **Defects not ported:** no `(window as any).lossInformationUIStore`, no `alert()`, no emoji `console.log`, no `appearance="outline"`, no `@ViewChild('template')` + `NxDialogService.open(templateRef)`, no `.subscribe()` in the class, no `<!-- TODO: Implement impacted policies table -->`, and no `<a href="#">` that swallows its own click. The "See details" affordance is a link-styled `<button>` — it opens a dialog rather than navigating, and `nxLink` is unverified in this repo (`grep -rn "nxLink" src/app --include="*.html"` returns zero hits, so `NxLinkModule` is imported in two components and used in none). Same approach as `widgets/recovery-potential-panel.ts`'s `.rpp-more`.
- **Mock-data alignment found while writing the ACs:** POL-2024-006's and POL-2024-009's entities were named "Müller AG — …" / "Becker Industries — …" while `policies.json` gives those policies to Schäfer & Söhne AG and Rhein Constructions GmbH. Harmless while nothing showed the two together; this feature puts the client name in the modal and the entity names in the tree one click apart. Renamed in `entities-damages.json` (9 entities); no ticket or source file referenced the old names.

**Gap 2 — financial-loss capture (`CHAMP-FINANCIAL-LOSS-ITEM`, 5 ACs).** Every other damage type has a physical thing to describe. A financial loss has none, so the peril behind it and the working of how the figure was reached carry the whole record — and neither was capturable. Added "Financial loss caused by" (cause-of-loss lookup) + "Financial loss details" to both damaged-item modals, revealed only for that damage type.
- **One shared config, because the gate keys off one exact string.** Both modals had their own `DAMAGE_OPTIONS` copy; `features/sections/damaged-item.config.ts` now owns the list and `FINANCIAL_LOSS_DAMAGE`. A drifting copy would have silently stopped revealing the fields in one of the two modals.
- **Pattern copied from `add-section-entity-modal`:** `toSignal(valueChanges)` → `computed()` gate → `@if`, with `required` declared on the control but the required-ness hand-checked in `confirm()`. An always-required validator would block saving a material-damage item whose cause field the handler never saw. On the way out the two keys are **dropped, not merely hidden** — a stale peril on a material-damage item would render as a cause nothing on screen let the handler clear.
- **Readback as sub-lines, not two more columns.** Only financial-loss items ever carry them, so columns would be empty on most rows and would widen a table that has to fit inside the side panel. Stores the lookup *label*, not the key, because `DamagedItem.damage` already holds display strings — keeps the model uniformly display-ready and needs no pipe on the row.
- **AC-04 deliberately targets SEC-002, which is Closed.** The seeded example item lives on SE-003 there, so that AC covers the read-only case as well: sub-lines render while Add / Edit / Delete stay disabled. AC-01/02/03/05 use SEC-001 (Open), since `Add damaged item` is disabled on a closed section and a Closed status would have made them untestable.

**Correction — the third mapped gap did not exist.** I reported production's claim-count widget as missing ("we only have `kpi-row` with different numbers"). It is already built, at `dashboard.html:156-177`, with `dateRangedStats()` + `barWidth()` from `dashboard.ts` — and it is better than production's, which is All-time only. Cause of the bad map: I searched `features/dashboard/widgets/` and missed the inline card in `dashboard.html`. Nothing was built for it. Lesson for the next repo diff: a "we don't have X" claim needs a grep of the page template, not just the widgets folder.

- **`data-tour-id` hooks added** (`ipb-banner`, `ipb-see-details`, `edp-damaged-items`) because a `targetId` with no matching attribute is a silently dead walkthrough step — `tour-step-renderer.component.ts:127` retries for ~2s and then gives up without a word.
- **Raw ISO dates caught in self-QA:** the modal's cover period rendered `policy.effectiveDate` straight, which `audit:date-format` cannot see (it only scans `.ts`). Routed through the `appDate` pipe for dd-MM-yyyy, same as `policy-overview.component.html:34`.
- **`audit:table-empty` exemption, not a fake empty state:** the modal's table cannot be empty — the banner renders only when it has ≥1 impacted policy and hands that same non-empty list over as `NX_MODAL_DATA`. Recorded as an `audit-exempt` comment with that reasoning.
- **Files touched:** new `core/models/impacted-policy.model.ts`, `core/mock/data/impacted-policies.json`, `core/mock/services/mock-impacted-policies.service.ts`, `features/fnol/components/impacted-policies-banner/*`, `features/fnol/components/add-policies-modal/*`, `features/sections/damaged-item.config.ts`, `public/tickets/champ-impacted-policies.json`, `public/tickets/champ-financial-loss-item.json`; modified `mock-entities-damages.service.ts`, `mock-lookup.service.ts`, `core/models/index.ts`, `public/tickets/index.json`, `entities-damages.json`, `step-entities-damages.component.{ts,html}`, `add-/edit-damaged-item-modal.component.{ts,html}`, `entity-detail-panel.component.{ts,html,scss}`.
- **Audit result:** `ng build` 0 errors, `npm run audit:ac-logic` 77 ACs / 54 passed / 0 failed / 23 skipped, `npm run pre-commit` 17/18 — the one failure, `audit:ndbx-wrapper` (3 lines: `add-section-entity-modal`, `navbar`, `file-restriction-card`), predates this task on all 3 lines and none of them is a file this task touched.
- **Commit hygiene note:** the tree carried ~100 uncommitted files from other tasks. `mock-lookup.service.ts` and `entity-detail-panel.component.{ts,html}` were staged as hand-built blobs holding only this task's hunks — their foreign hunks (the CBI case-type work) depend on an untracked `cbi-case-type-label.pipe.ts` and on `Lookups.cbiCaseTypes`, which does not exist in `lookups.json`, so committing them would have broken the build. `step-entities-damages.component.ts` was committed whole: its foreign hunks (a `pendingTimeouts` leak fix and error toasts) are self-contained in that file and `onPoliciesAdded()` depends on `pendingTimeouts` existing.

---

## 2026-08-31 — Production-repo gap closure: Policy overview page, risk-score affordances, specify-other cause

- **Source:** user instruction, verbatim: *"repo main มีอะไรที่เราไม่มี สร้างให้หมด ด้วย style ภายใต ticket ที่ถูกต้องและ design กฎเรา"* — diff the real production repo (`~/Downloads/test figma mcp/claims-management-main`, an Nx monorepo of 10 web-component MFEs, no `.git`) against this prototype and build everything the prototype lacks, in this repo's style. Not a ticket-driven build; RULE -2's gate was already overridden by the user on 2026-08-28.
- **Three gaps found and closed.** Everything else production has that the prototype doesn't is another team's MFE with no claims-management surface to model against (parties, documents, payments) — reported, not built.

**Gap 1 — Policy overview page (BMPCC-16192).** The prototype had no policy surface at all, so the QA defect the ticket describes (Created date / Date of loss missing from the Linked claims table) was not reproducible here. Built at `/claims/:id/policy`, reached from the policy-number link on claim overview: policy header, cover/insured details, and a Linked claims table carrying both disputed columns from the start. Dates go through the project `date` pipe as `dd-MM-yyyy`, not production's raw strings. `build_status` → `done`, `prototype_route` set.

**Gap 2 — dead affordances on the risk-score widget.** Production renders **Refresh risk score** and **Start investigation** as real buttons that do nothing. Extracted `risk-score-field.component.*` and gave both a real outcome (recompute with a spinner + timestamp; navigate to the investigation surface). A button that can't do anything is worse than no button — it costs the user a click to learn it's fake.

**Gap 3 — specify-other free text (adjacent to BMPCC-17072, no ticket of its own).** Added "Specify other cause of loss", revealed only while Cause of loss includes `other-event`, on both capture surfaces (FNOL loss-information step, claims Edit loss information). The typed text is folded into every readback — FNOL summary, edit-page read view, and the `was:` original-value display — as `Other Event — <text>`; a summary showing a bare "Other" tells the reader nothing. `required` + `maxLength(100)` are attached at **runtime** (`syncSpecifyOther()`), not declared in `FnolStateService`, because the requirement depends on a sibling control's value; reconciled in `ngOnInit` and in `prefillForm()` since neither prefill path fires `selectionChange`. On hide the value is cleared, or a hidden control keeps failing validation with nothing on screen to fix.
- **Deliberate deviation from production, and the mistake that produced it:** production also has `specifyOtherTypeOfDamage`. I built it, then backed it out — adding it required restoring `other-damage` to `lookups.json`'s `typeOfDamage`, which **reverses the 2026-08-21 decision recorded in this very file**: *"Dropped 'loss' (too vague to be a real coverage type) and 'other-damage' (a catch-all that undermines one-section-per-real-type)."* `ClaimSection.damageType` derives from those values. Shipping the qualifier without an option that can reveal it would have been exactly the dead affordance Gap 2 exists to fix. Reasoning parked in `core/models/lookup.model.ts` beside `OTHER_CAUSE_KEY` so the next reader doesn't re-add it.
- **Where the shared key lives:** `OTHER_CAUSE_KEY` is in `core/models/lookup.model.ts` (barrel-exported), not in `features/fnol/config/` where I first put it — FNOL and the claims edit page both need it and a cross-feature import is forbidden. Precedent: `RESTRICTION_REASONS` in `core/models/claim-overview.model.ts`.
- **Files touched:** `app.routes.ts`; new `features/claims/policy-overview/policy-overview.component.*`, `core/models/policy-overview.model.ts`, `risk-score-field.component.*`; `core/models/lookup.model.ts`, `core/models/loss-information.model.ts`; `fnol-state.service.ts`; `step-loss-information.component.{ts,html,scss}`; `step-summary.component.ts`; `edit-loss-information.component.{ts,html}`.
- **Audit result:** `ng build` 0 errors, `npm run audit:ac-logic` 49/49 (62 ACs, 13 skipped), `npm run pre-commit` 17/18 — the one failure, `audit:ndbx-wrapper` (3 lines), predates this task on all 3 lines; verified by `git stash -u` + re-run, and the third line is in `features/sections/`, uncommitted work belonging to another task.
- **Pre-existing violations left alone, not silently refactored:** `step-loss-information.component.ts` (541 lines) and `step-summary.component.ts` (520+) both exceed the 300-line `.ts` limit, and both did so before this task. Splitting a blessed file as a side effect of an unrelated feature is a worse trade than the overage.

---

## 2026-08-21 — Part B: one canonical modal spacing shape, rewritten audit-modal-padding.mjs

- **Source:** `/goal` autonomous execution, following the same-day audit that found 3 disagreeing modal-spacing groups, an audit blind to 57% of modals (mixin-based), and one modal invisible to tooling entirely.
- **Decision:** `_modal-layout.scss`'s mixin is canonical, not `.claude/BLESSED.md`'s own previously hand-copied CSS — 20 of 28 modals already used it, and unlike hand-copied CSS it can't drift modal-to-modal. Recorded in BLESSED.md with reasoning, not just the new pattern.
- **Migrated to the mixin (15 files):** 8 hand-rolled "BLESSED pattern" modals + 5 hand-rolled modals missing `:host`'s max-height/overflow pairing. `manage-access-modal`'s outliers (32px body/footer values against the 16-24px norm) resolved as a consequence of the migration, not a separate patch.
- **`loss-info-discard-modal`:** had an inline `styles: [...]` array with 24px horizontal padding — the exact 2026-08-14 bug, never caught because it had no `.scss` for the old audit to open. Given a real `templateUrl`/`styleUrl` on the mixin; buttons gained `small` sizing since `audit:button-size`'s glob couldn't see this file's buttons before either.
- **`mass-event-edit-modal`:** ruled a sanctioned bottom-sheet variant, not fixed — genuine `panelClass` docking, `height:100%` instead of a centered dialog's shell, and pre-existing deliberate spacing comments elsewhere in the same file. Documented in `DESIGN_PRINCIPLES.md`'s Modal contract and in the audit's explicit `EXEMPT` list.
- **Audit rewrite (v2):** pass condition is now "uses the mixin" (no SCSS-expansion needed — the mixin IS the source), matches BEM `__` as well as `-`, checks discrete `padding-left`/`padding-right` not just the shorthand, requires the `:host` max-height+overflow pairing explicitly, flags (not skips) files with no stylesheet, and reads inline `styles:` arrays.
- **One false positive found and fixed during this pass, not weakened around:** widened BEM matching initially flagged `claim-closure-modal`/`section-closure-modal`'s nested `.xxx-blocker-card__header` sub-widgets (legitimate internal card padding, unrelated to the modal's own inset). Added a nested-widget-name exclusion rather than loosening the real check. Verified detection still works against a synthetic broken modal (no mixin, no host pairing, bad padding — all 3 caught) before confirming the real codebase passes clean.
- **Result:** `node scripts/audit-modal-padding.mjs` → 0 violations. Real, not weakened: the `EXEMPT` list has exactly one documented entry, the nested-widget exclusion fixes a genuine false positive.
- **Files touched:** `.claude/BLESSED.md`, `DESIGN_PRINCIPLES.md`, `scripts/audit-modal-padding.mjs`, `_modal-layout.scss` (added `:host` `overflow: hidden`), 15 modal `.component.scss` files, `loss-info-discard-modal.component.{ts,html,scss}` (new).
- **Audit result:** `npm run build` 0 errors, `npm run audit:ac-logic` 49/49, `npm run pre-commit` 17/18 (the 1 failure, `audit:ndbx-wrapper`, predates this task).

---

## 2026-08-21 — Part A: redirect context handoff, Edit Loss Information → Sections

- **Source:** `/goal` autonomous execution, following the same-day audit that found the redirect to Sections carried nothing — `navigate()` called with a single argument, Sections reading only the claim id, landing byte-identical to a nav-bar visit.
- **Mechanism:** query params (`changedFields`/`changedOld`/`changedNew`, parallel arrays), not a new mechanism — the same pattern `sections.ts` already uses to hand `?sectionId=` to Provider Management for its highlight signal.
- **Banner:** dismissible `nx-message` (`context="warning"`, `[closable]="true"`) at the top of Sections, built only when those params are present. Shows what changed with old/new values (same labels the change ledger used), why (coverage depends on cause of loss and loss location), and "review the sections below" — deliberately does not name or highlight specific sections, because `ClaimSection` has no structured link back to a cause-of-loss or location key even after the Stage 2 `damageType` work (verified, not assumed — see the redirect-context audit). Params are stripped from the URL immediately after being read (`replaceUrl: true`) so a refresh or later nav-bar visit shows nothing.
- **Toast:** removed entirely on this path (not reduced to a plain confirmation) — the banner carries strictly more information than the toast ever did, and a bare "saved" toast next to a banner that already explains what and why would be redundant.
- **Files touched:** `edit-loss-information.component.ts`, `sections.ts`/`.html`/`.scss`.
- **Audit result:** `npm run build` 0 errors, `npm run audit:ac-logic` 49/49, `npm run pre-commit` 17/18 (the 1 failure predates this task).

---

## 2026-08-21 — FNOL-to-claim model fix: one damage vocabulary, real sections, loss info survives submit (Stages 1–8)

- **Source:** `/goal` autonomous execution, following the same-day audit that found: FNOL discarded everything it captured at submit, nothing in the app could create a `ClaimSection`, and damage type had three vocabularies that never spoke to each other.
- **Module:** `lookups.json`, `ClaimSection`/`SectionEntity` models, `MockSectionService`, FNOL step 2/summary, Sections screen, `ClaimOverview`.

**Stage 1 — one damage type vocabulary.** Merged `lookups.json.typeOfDamage` (7 → 7, different set): material-damage, business-interruption, machinery-breakdown, bodily-injury, financial-loss, liability, product-recall-costs. Dropped "loss" (too vague to be a real coverage type) and "other-damage" (a catch-all that undermines one-section-per-real-type). Kept business-interruption/machinery-breakdown over the original 7 because seed data already used them extensively (SEC-002/007, SEC-006). Deleted `entity-damage-mapping.ts`'s `DAMAGE_GROUP_OPTIONS` and `edit-entity-damage-modal`'s `DAMAGE_OPTIONS` outright — all 4 consumers now read `MockLookupService` (new `getTypeOfDamageSync()` for callers needing it synchronously inside a `map()`).

**Stage 2 — `ClaimSection.damageType`.** Added as a real field; `SectionEntity.damage` removed outright (redundant once the section owns the type). `sections.json` migrated: `SEC-006` (had "Material damage" + "Machinery breakdown" mixed in one section) split into `SEC-006` (material-damage) + new `SEC-006-B` (machinery-breakdown) — no ticket references `SEC-006`/`SEC-007`'s IDs (checked `public/tickets/*.json`), only `SEC-001/002/003/008` are, and none of those changed shape. `SEC-024-A`'s free-text "Physical damage" normalized to material-damage. New `DamageTypeLabelPipe`. `edit-entity-damage-modal` lost its damage dropdown (nothing entity-level left to edit but instruction status); `add-section-entity-modal` lost its damage multi-select (adding to an existing section now uses that section's own type, not a user pick).

**Stage 3 — creation primitive.** `MockStateService.appendSections()` (same signal+sessionStorage pipeline as `patchSection`) + `MockSectionService.createSection(claimId, damageType, entities, createdBy?)` — the one place a `ClaimSection` gets constructed, with an activity log entry. Nothing called it yet at this point.

**Stage 4 — FNOL step 2 → sections.** `step-summary.onSubmit()` groups by *damage group*, not by each entity's own `damageTypeKey` (hand-seeded entities don't reliably carry that field — only found this by simulating the real logic in Node against `POL-2024-001`'s seed data and getting 1 section instead of the expected 4; fixed by grouping on the `damageGroups[].damageTypeKey` the entities are nested under instead). Walkthrough (no browser tool — simulated in Node): 4 distinct damage-type groups in the default policy → 4 sections, correctly including the same entity name (`Kaufmann's Company Employees`) landing in two different sections (bodily-injury and liability) — the "one fire, two sections" case, not a bug.

**Stage 5 — loss information survives.** `LossInformation` record written via `patchLossInformation`; the created claim's `ClaimOverview` patched with client/policyNumber/dateOfLoss/proximateLossCause/causeOfLoss/description/restriction/recoveryPotential — this is what actually makes the old "carries to Claim Overview" comment true, instead of just removing the false claim. Also appends a real `Claim` record. Not built: a brand-new claim numbering/creation system — too large for this stage; wizard data lands on the claim it already lands on (`mockClaimIds[0]`, still a literal). `lossLocation` mapping is best-effort due to a pre-existing `LocationPickerOutput`/`LossLocation` shape mismatch (flagged, not fixed — out of scope).

**Stage 6 — causeOfLoss truncation.** Decision: `proximateLossCause` stays singular (matches real insurance usage — "proximate cause" IS the primary one) for compact surfaces; added `ClaimOverview.causeOfLoss?: string[]` for the full list, shown on the Reference Panel (the detail view) — Overview grid and preview popover intentionally keep the compact single value. `edit-loss-information`'s sync now writes both fields.

**Stage 7 — entity delete guardrails.** `MockSectionService.deleteEntity()` checks the same 7 blocker flags section close checks (on the entity's owning section — entities don't carry their own reserve/payment links), blocks with a specific reason before the confirm dialog even opens, logs an activity entry on success. Not reusing `ClaimClosureService.validateSectionBlockers()` — that service already injects `MockSectionService`, so the reverse import would be circular; duplicated the 7-flag check inline instead.

**Stage 8 — add damage type from the claim file.** New "Add damage type" action reuses `AddSectionEntityModalComponent` (same modal as "Add Entity") — its target dropdown now also lists damage types with no section yet on the claim, prefixed "+ New section", which create via the Stage 3 primitive. Replaced the invented `DAMAGE_TYPE_ENTITIES` demo map with real entities via `MockEntitySearchService` (same source FNOL uses), reversing `ENTITY_TYPE_TO_DAMAGE_GROUP` to find which entity types route to a chosen damage type. Flagged: 4 of 7 damage types (business-interruption, machinery-breakdown, liability, product-recall-costs) have no routed entity type, so they show "no candidates" today — matches FNOL's own limit exactly, not a new gap. Remove-vs-close: did not build remove — close is already reversible and already gated by the same 7 blockers a hard delete would need anyway.

- **Schema changes:** `ClaimSection.damageType` (required, new). `SectionEntity.damage` removed. `ClaimOverview.causeOfLoss?: string[]` (new, optional). `MockStateService.appendSections()` (new). None of these are `ScenarioOverrides` fields — no schema-version bump needed.
- **Files touched:** ~25 across `lookups.json`, `section.model.ts`, `sections.json`, `mock-section.service.ts`, `mock-state.service.ts`, `entity-damage-mapping.ts`, `mock-entities-damages.service.ts`, `mock-lookup.service.ts`, `move-entity-dialog`, `edit-entity-damage-modal`, `add-section-entity-modal`, `coverage-review-modal`, `entity-detail-panel` (sections), `sections.ts`/`.html`, `step-summary.component.ts`, `claim-overview.model.ts`, `claim-reference-panel.component.html`, `edit-loss-information.component.ts`, new `damage-type-label.pipe.ts`.
- **Audit result after every stage:** `npm run build` 0 errors, `npm run audit:ac-logic` 49/49 (unchanged baseline, including through the `SEC-006` split), `npm run pre-commit` 17/18 (the 1 failure, `audit:ndbx-wrapper`, predates this task).
- **Not touched:** the `speculative/unstarted-tickets` branch (per explicit instruction) — nothing here overlaps it. No conclusion/coverage engine was built — `claim-closure-blocker.builder.ts`'s existing `[accepted-deviation]` seam (BMPCC-17779 AC3, from a prior session) is the only place anything coverage-adjacent lives, and it's a manual flag, not an evaluation.

---

## 2026-08-20 — Working tree cleanup from the uncommitted-work audit: wiring gap fixed, legitimate backlog committed, speculative work shelved

- **Source:** `/goal` autonomous execution — clean up the working tree per the same-day audit findings (67 uncommitted files across 4 buckets: an approved-but-never-committed backlog, a routing wire-up gap, speculative work built from unstarted tickets, and scratch debris).
- **Module:** `app.routes.ts`/`app.scss`, modal SCSS pattern, Claim Overview/Dashboard/Claims List/Notes (PI 2026.3 alignment + notes redesign), tooling, `CLAUDE.md`, `.gitignore`.

**Stage 1 — wiring gap:** `app.routes.ts` had never been committed with the `/tracker` route or the real `claims/:id/limits` route, despite the entire tracker feature and `LimitsDeductiblesComponent` being committed in earlier sessions — both were unreachable on a fresh clone, only "working" because the dev server always ran against the uncommitted working tree. Committed `app.routes.ts` + `app.scss` (`.exploration-banner`, referenced by already-committed `app.ts` with nothing backing it). **Verified via an actual `git clone` into a temp directory** (not just a local diff read) — both routes present and resolving at the resulting HEAD, both before and again after every subsequent commit in this session.

**Stage 2 — legitimate backlog, one commit per cluster:**
- a) Modal padding fix (5 modals + `BLESSED.md`) — vertical-only padding pattern, backed by the 2026-08-14/2026-08-15 `CONVERSIONS.md` entries.
- b) PI 2026.3 UI/UX alignment — Recovery Potential note persistence, manual reassignment (new `ReassignClaimModalComponent`), dashboard scope-filter fix, coverage-review chip — backed by the 2026-08-15 entry (BMPCC-15121).
- c) Notes signal-store rewrite + `attachedTo` scoping data — backed by the 2026-08-18 "Edit Claim Phase 2, Item 1" entry.
- d) Tooling — `audit-modal-padding.mjs` (was referenced by already-committed `package.json` scripts but the script file itself was never committed — `pre-commit` would have failed "module not found" on a fresh clone), human-tone skill install, `package-lock.json` catch-up, `CLAUDE.md` RULE -2.
- **Split-hunk handling:** 4 files (`claim-overview.component.ts`, `claim-overview.model.ts`, `entity-detail-panel.component.{ts,html}`) each mixed an approved change with an unrelated speculative one in the same working-tree diff — e.g. `claim-overview.component.ts`'s recovery-potential-note fix sat in the same method body as an unrequested closure-blocker flag tied to unstarted BMPCC-17779. Built target versions of each file with only the approved lines (verified via `diff -u` against both the unmodified-target and the full working-tree version, not by hand-editing hunk headers — a first attempt at hand-crafted hunk headers produced a corrupt patch), then `git apply --cached` the resulting patch so only that portion staged, leaving the rest in the working tree for Stage 3. Two files turned out, on inspection, to have **zero** approved content left once the already-committed redesign was accounted for (`claim-notes-panel.component.{ts,html}` — the notes-panel redesign itself was already on `main` from an earlier session; every remaining line in these two files was the unrequested attachments feature) — committed nothing from them in Stage 2, all of it went to Stage 3 instead.

**Stage 3 — shelved to `speculative/unstarted-tickets` (branched off `main` after Stage 1/2, not deleted):** 6 commits, one per cluster, plus a `SPECULATIVE.md` README. Verified every ticket's status live against the tracker DB (not trusted from the `.agents/jira-clone/` scrape files alone):
  - Sections "Circumstance" field — BMPCC-18159/18160/18157, all To Do/Unassigned.
  - Approvals notes-on-journey — BMPCC-14908, To Do/Unassigned.
  - Recovery Potential closure-blocker AC3 — BMPCC-17779, To Do (assigned to Ruby Isabelle Costigan, but assigned ≠ started).
  - AOMS/TMR stub tabs on claim right-strip — BMPCC-14352/14419, both To Do; both tickets literally ask "where should this go" as an unresolved design question that the code had already answered on its own.
  - Notes attachments — BMPCC-14967, To Do (generic "UI/UX design" title, assigned to Ann Jeenwechasat but not started).
  - Financial Overview Make Payment modal + Recovery Bookings — no ticket at all, and it **contradicts commit `bc6be9d`**, which deliberately deleted `MakePaymentModalComponent` in favor of page navigation. Flagged explicitly in that commit's message on the speculative branch.
  - One nuance recorded on the branch and worth repeating here: `public/tickets/bmpcc-17779.json` (an already-committed prototype tour on `main`, from an earlier task) also references BMPCC-17779, but only documents the already-shipped Yes/No+note flow per an explicit tracker-bridging instruction — it added no new logic, unlike the shelved closure-blocker commit.
  - Returned `main`'s working tree to clean for every one of these files by committing them on the branch, then `git checkout main` (tracked-file diffs revert to `main`'s version; untracked new files disappear from the working tree entirely, since they only exist as commits on the other branch now).

**Stage 4 — debris:** deleted 3 scratch Playwright screenshot scripts (`shotv10/11/12.mjs`, superseded by their feature's real commit). Added `.agents/jira-clone/` to `.gitignore` (raw scrape material, not source — `.agents/skills/` untouched, that's a real skill install already committed). `src/main.ts`'s uncommitted `sessionStorage.clear()`-on-bootstrap tweak was **reverted, not committed** — well-commented and clearly intentional, but tracing `MockStateService`'s read order showed it would run before every `sessionStorage.getItem(STORAGE_KEY)` call on init, silently wiping the exact "closed state survives page reload" persistence that `audit:ac-logic`'s AC-07 already covers. Intentional-looking but not harmless, so it didn't qualify for the commit path.

**Stage 5:** Corrected `CLAUDE.md` RULE -1's stale "`CLAUDE.md` is gitignored" claim — it's tracked, confirmed via `git ls-files`, and had already been committed repeatedly this session before the claim was ever re-checked.

- **Schema changes:** none.
- **Files touched:** ~50 across 6 commits on `main` (`57740e3`, `8341ef5`, `5eb693c`, `d343f3d`, `e815d67`, `f68a23f`, `e06ad96`) + 7 commits on `speculative/unstarted-tickets` (`6de7141`, `6973e28`, `5856d8d`, `294ef23`, `f8fa57c`, `bc8adf0`, `ce4a23f`).
- **Audit result:** `npm run build` 0 errors. `npm run pre-commit` 17/18 (the 1 failure, `audit:ndbx-wrapper` on `navbar.html`/`claim-overview.component.html`, predates this task — confirmed via `git diff`, neither file was touched here). `npm run audit:ac-logic` 49/49, unchanged. Fresh-clone verification (`git clone` into a temp dir, not just a working-tree read) confirmed both `/tracker` and `claims/:id/limits` resolve at final HEAD.

---

## 2026-08-20 — Tracker end-to-end usability: jira_status column, ticket-to-prototype bridge, 9 new tours

- **Source:** `/goal` autonomous execution — make the tracker usable end to end (real Jira status, route/tour indicators, working click-through bridge, reviewer-mode banner split provable)
- **Module:** `status-chip` (`jira` domain), tracker table/detail-panel, `PrototypeScenarioService`, `public/tickets/*.json`, dev-banner build config
- **Stage 1 — `jira_status` column:** table had no status column at all before this — `jira_status` was filter-only, and the only visible "status" was our own design/build/handoff pill. Added `domain="jira" variant="text"` (color-only, no pill) next to the existing `domain="tracker"` pill, with hex values confirmed non-overlapping (tracker's `in_progress` amber vs jira's `in-progress` blue; tracker's `done` green vs jira's `done` grey). Verified against live Jira for 3 tickets — BMPCC-16104, BMPCC-14629, BMPCC-7133 — all matched exactly.
- **Stage 2 — bridge field:** migration `0004_tracker_prototype_ticket_link.sql` adds `ticket_state.prototype_ticket_id text`, linking a Jira tracker ticket to a `public/tickets/*.json` id. Convention documented in the migration file itself. 12 tracker tickets linked (10 distinct prototype JSON files — 2 pairs of tracker tickets share one JSON where the content is genuinely the same feature: BMPCC-14453+BMPCC-14454 → `bmpcc-14453.json`, BMPCC-14831+BMPCC-14826 → `bmpcc-14831.json`).
- **Stage 3 — click-through bridge:** `TicketDetailPanelComponent`'s "Open in prototype" changed from a static `routerLink` to a click handler: `PrototypeScenarioService.applyTicket()` (finds the ticket's first `done` AC, applies its `stateOverrides`) → navigate → `runPostLandForTicket()` (runs the tour). Falls back to bare navigation with an explicit "no state or tour" hint when a route exists but no ticket is linked.
- **Stage 4 — table indicators:** two new icon-or-dash columns (prototype route present, tour present) — no new text columns, reused the existing link icon plus `product-guide-navigation` for tours (confirmed present in `ndbx-icons.css` first; an earlier draft assumed a nonexistent `map-o`).
- **Stage 5 — 9 new tours + 1 extended:** added a `TourStep` to `close-section.json` (already existed) and authored 9 new minimal prototype tickets, each with one real AC + one `TourStep`: `bmpcc-16104` (Claim Re-Open), `bmpcc-16986` (Mass Event Linkage), `bmpcc-17779` (Recovery Potential Flag), `bmpcc-14452` (Loss Adjuster Rating survey), `bmpcc-14453` (Provider Communication), `bmpcc-14831` (Financial Overview restructure), `bmpcc-7133` (Policy Limits/Deductibles), `bmpcc-17678` (Approvals QA fixes), `bmpcc-12160` (Party role assignment). Two of these tickets' target screens — Provider Management's Send Communication/Rate Adjuster buttons and the whole Limits & Deductibles page — were already-built, uncommitted work from an earlier session; pulled in whole with their full dependency chain (models/services/mock data) since the tours needed those exact elements as `data-tour-id` targets and the commit had to be self-consistent on its own (verified via `git stash push --keep-index -u` + build, not assumed).
- **8 tickets explicitly left without a tour** (routed but `prototype_ticket_id` still null) — listed rather than guessed: BMPCC-7132 (Litigation list only — no litigation-detail sub-view exists to host the AC), BMPCC-16743/16744/16746/16755 (all 4 describe an Attorney/Lawyer delete-confirmation dialog that doesn't exist on the list route — confirmed via grep, zero attorney/lawyer/delete markup on `litigation.component.html`), BMPCC-15238 and BMPCC-18325 (both general "UX/UI alignment" tickets with no single distinct AC to anchor a tour to), BMPCC-14830 (Reserve flow Save/unsaved-changes — `/fnol/reserves` route has no matching UI yet).
- **Stage 6 — local reviewer mode:** new `environment.reviewer.ts` + `angular.json` `reviewer` build/serve configs (`npm run start:reviewer`), same dev Supabase backend as `environment.ts`, only `devBannerMode: 'reviewer'` differs. Verified via `ng build --configuration reviewer` — bundled output confirmed `devBannerMode:"reviewer"` took effect, same file-replacement mechanism already used by `exploration`/`production`.
- **Schema changes:** `ticket_state.prototype_ticket_id text` (migration 0004). No `ScenarioOverrides` change.
- **Files touched:** `status-chip.component.ts`, `tracker.model.ts`, `tracker.service.ts`, `tracker-table.component.{ts,html}`, `ticket-detail-panel.component.ts`, new `core/services/prototype-scenario.service.ts` + `core/models/dev-ticket.model.ts` (extracted from `ClaimDevHelperService` so `features/tracker` can use the same apply mechanism without importing from `features/claims`), 10 `public/tickets/*.json` + `index.json`, `angular.json`, `package.json`, new `environment.reviewer.ts`.
- **Notes:**
  - Git-hunk isolation was unusually heavy this task — 5 of the screen-touching HTML files (`claim-overview`, `financial-overview`, `approvals`, `sections`, `provider-management`) had substantial unrelated uncommitted work already sitting in them from earlier sessions, mixed line-for-line with this task's `data-tour-id` additions in the same hunks. Isolated via `git diff --unified=3` → hand-craft a minimal hunk → `git apply --cached --check` → `git apply --cached`, leaving the unrelated work unstaged rather than committing it under this task's message.
  - `provider-management.component.html`/`limits-deductibles.component.html` were the exception: the `data-tour-id` attributes sit on buttons/sections that are themselves part of an already-built-but-uncommitted feature (Provider Communication modals, Limits & Deductibles page) — not separable, and genuinely needed as the tour's target. Committed whole, dependency chain included, verified self-consistent via a temporary `git stash push --keep-index -u` + build before committing.
  - The `audit:ndbx-wrapper` pre-commit failure (`navbar.html`, `claim-overview.component.html` raw `<input>`s) predates this task entirely — confirmed via `git status`/`git diff` showing zero relation to anything staged here.

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

## 2026-08-24 — WCAG 2 AA static audit + fix sweep (whole app)

- **Source:** verbal request — "check the whole system for accessibility"
- **Module:** app-wide (`shared`, `fnol`, `sections`, `tracker`, `administration`, `claims`, `layout`, `dashboard`, `access-gate`)
- **Files touched:** 68 across 5 commits (`a298fef`, `20def0e`, `578f4cd`, `fb9196d`, `ba89ec8`)
- **What the audit found (static/grep-able only, not a substitute for the manual keyboard/screen-reader/high-contrast passes in `POST_BUILD.md`):**
  1. **Font-size floor** — 19 new violations, all in `dashboard/widgets/*.ts` inline `styles:` blocks (invisible to the `.scss`-scoped grep in `CONTEXT.md`'s known-violations table). The old table's entries (`status-chip`, `dashboard.scss`, `step-1-search.scss`, `claim-detail.scss`) were already fixed in a prior session — that table is now stale and should be refreshed.
  2. **Icon-only controls** — several relying on `title` only (hover-only, not an accessible name) or with no name at all; one plain clickable `<div>` with no button semantics (`news-panel.ts`); a hardcoded `aria-label` that never updated with state (`sections.html`).
  3. **Silent banners** — the biggest category. Many components render `nx-message`/custom banners directly instead of going through `ToastService` (whose `toast-stack` container has a live region) — so saves, errors, and confirmations were happening with zero screen-reader feedback. Worst offenders: `tracker-login` (only feedback in the whole login flow) and `access-gate` (password error).
  4. **Scroll containers missing `tabindex="0"`** — systemic. The shared `_modal-layout.scss` `@mixin body` is reused by ~20+ modals; only a handful had ever had `tabindex` added, so most modal bodies (and several table/list viewports) were keyboard-unreachable.
  5. **High-contrast SVG** — clean app-wide; the codebase barely uses raw `<svg>`, and what exists already uses `currentColor` + `aria-hidden`.
- **Fix approach:** 5 parallel general-purpose agents, one per audited bucket, applying the `LiveAnnouncer` pattern from `mass-events.component.ts` and the `tabindex="0"` pattern from `reassign-claim-modal.component.html` as the blessed references.
- **Git-hygiene incident during the fix:** several files being fixed already had unrelated, pre-existing **uncommitted** feature work sitting in them (e.g. a custom-retention-date feature in `claim-closure-modal`, a reserve-type/amount feature in `claim-reopen-modal`, BMPCC-11006 skeleton-conversion work in `step-1-search`, a `data-tour-id`/"Simulate final payment" feature in `sections.*`). Committing those files whole would have swept unrelated WIP into an accessibility commit. Resolved by having each fix agent re-check its own `git diff` and, where pre-existing hunks were present, hand-build a patch (`git apply --cached`) staging only its own accessibility lines, leaving the rest unstaged. One agent also went ahead and ran `git commit` on its own initiative without being asked — harmless in this case (the resulting commit `a298fef` was verified clean) but flagged so it isn't repeated: **fix agents should stage only; the orchestrating session does the actual commit** once all buckets are staged, since concurrent `git add`/`commit` in one shared working tree can stomp on each other (one agent's commit swept in another's staged files before it was caught and undone with `git reset --soft HEAD^`).
- **Not committed (intentionally left as-is, unrelated to this task):** `location-source-modal.component.html` — a brand-new, never-committed file with a11y fixes needed inside it but no prior committed baseline to diff against, so there's no way to isolate just the accessibility attributes from the rest of the file's (also uncommitted) content. Needs a human call on whether to commit the whole component first, then layer a11y on top.
- **Known remaining gap:** `claim-reference-panel`/`claim-reference-tabs` search listboxes got a full `aria-activedescendant` roving-highlight keyboard implementation rather than the minimal fix — slightly more scope than asked, but self-contained and doesn't touch AC/Stage/closure logic.

---

## 2026-09-01 — BMPCC-17779 (Recovery Potential Flag — Dependency), Phase A

- **Source:** verbal brief — Recoveries call feedback pasted into the session (radio buttons on screen, notification/flag, dashboard channel, part of the closure checklist, "make any selection minimum — yes or no", and Yes must guide them into the recovery domain)
- **Module:** Claims (Claim Overview, closure modal, Dashboard)
- **File:** `public/tickets/bmpcc-17779.json` — rewritten from 1 AC to 6
- **ACs authored:** 6 (done: 5, partial: 1, todo: 0)
- **Deviations:** AC-05 `[accepted-deviation]` — `yes-pending` (Yes on record, no recovery case) stays a **soft warning**, not a hard closure blocker, because `/claims/:id/recoveries` is still a redirect stub (`app.routes.ts:116`). A hard blocker whose fix-it link dead-ends is unresolvable, so promoting it ships with the real recoveries surface (Phase B).
- **Schema changes:**
  - `BlockerType` gained `'recovery-potential-unset'` (emitted) and `'recovery-not-set-up'` (declared, Phase B)
  - Two new `expectedOutcome` assertion keys in `audit-ac-logic.mjs`: `recoveryPotential` and `recoveryPotentialState`
  - `STATE_VERSION` → `'recovery-potential-v5'`
- **Files touched:** 14 — new `core/models/recovery-potential.model.ts`, new `core/mock/services/mock-recovery-attention.service.ts`, new `features/dashboard/widgets/recovery-potential-panel.ts`; rewritten `recovery-potential-card.component.{ts,html,scss}`; **deleted** `recovery-potential-modal/` (3 files); modified `claim-closure.model.ts`, `claim-closure-blocker.builder.ts`, `claim-closure-modal.component.ts`, `dashboard.{ts,html}`, `claim-overview.json`, `mock-state.service.ts`, `scripts/audit-ac-logic.mjs`
- **Notes:**
  - **The modal was the bug.** The old card put the Yes/No behind a "Set" link into a modal, so it read as optional and went unanswered — which is the exact complaint the call raised. Deleted the modal outright rather than adding a nag on top of it.
  - **One derivation, three surfaces.** `recoveryPotentialState()` returns `unanswered | yes-pending | yes-active | no`, and the card, the closure checklist and the dashboard prompt all read it. The alternative — three hand-rolled `=== 'yes' && !hasActiveRecovery` checks — is exactly how the three surfaces would have drifted apart.
  - **NDBX cannot auto-commit a radio.** `NxRadioGroupComponent` exposes no value-change output and `NxRadioComponent` no outputs at all (verified in `allianz-ng-aquila-radio-button.d.ts`), so reactivity goes through the FormControl's `valueChanges` via `toSignal`. Save became an explicit second click as a result — which is the better design anyway, since this field now gates claim closure and a misclick should be undoable.
  - **Nearly broke 8 ticket JSONs.** A hard "unanswered" blocker would have flipped `CLM-2024-001` and `CL-2025-001` to un-closable, breaking every AC in `closure.json`, `champ-preclosure-checklist.json`, `close-section.json`, `ready-to-close.json`, `bmpcc-11360.json` and `bmpcc-14434/35/37.json`. Caught by grepping which tickets assert `canClose` **before** writing the blocker; fixed by seeding decided answers into `claim-overview.json` (4 records) and mirroring the blocker into the audit's independent `canClose` formula.
  - **AC-03 vs AC-04 share identical overrides except the answer**, so `canClose` flipping false→true isolates this blocker instead of passing trivially on unrelated blockers.
  - **Tracker status is wrong.** BMPCC-17779 reads d/b/h = done, which this feedback contradicts — needs reopening.
  - **FNOL now contradicts the claim side.** `step-summary.component.html` labels its recovery-potential radio "Optional — can be updated after claim creation", which is no longer true once the claim cannot close without it. Left alone (FNOL is a separate flow with its own ACs) but flagged.

---

## 2026-09-01 — BMPCC-17779 (Recovery Potential Flag — Dependency), Phase B — the Recoveries page

- **Source:** verbal brief — "ไป map หน่อย ใน main จริงมีอะไรแล้วเราไม่มีอะไร ไปสร้างตามซะ" then "run dev ช่องว่างๆ" → clarified as *"หมายถึงหน้าที่ยังว่าง ยังไม่ได้ทำ"* (build the pages that are still blank). Phase A's own accepted-deviation named this page as the thing that had to exist before its blocker could be promoted.
- **Module:** Claims (new Recoveries page, closure modal, Claim Overview, routes)
- **File:** `public/tickets/bmpcc-17779.json` — 6 ACs → 10
- **ACs authored:** 4 new (AC-07…AC-10, all `done`); AC-05 flipped `partial` → `done` and lost its deviation note
- **Deviations:** none remaining on this ticket — Phase A's only deviation was this page's absence
- **Schema changes:**
  - `TicketAC.targetClaim?: string` — an AC may name its own claim. Needed because this ticket describes a claim-level state machine with four states and no single seeded claim can be in all of them. Honoured by `audit-ac-logic.mjs` and by the dev banner's state inspector (which otherwise reads the wrong claim's tasks/sections while a recovery AC is selected).
  - Two more `expectedOutcome` keys: `recoveryCasesCount`, `openRecoveryCasesCount`
  - `ClaimOverview.hasRecoveryCase?: boolean`; `RecoveryPotentialState` gained `'yes-settled'`
  - `STATE_VERSION` → `'recovery-cases-v6'`
- **Files touched:** 19 — new `core/models/recovery.model.ts`, `core/mock/data/recovery-cases.json`, `core/mock/services/mock-recovery.service.ts`, `features/claims/recoveries/recoveries.component.{ts,html,scss}` + `components/create-recovery-modal/*` + `components/resolve-recovery-modal/*`; modified `recovery-potential.model.ts`, `claim-overview.model.ts`, `dev-ticket.model.ts`, `models/index.ts`, `claim-closure-blocker.builder.ts`, `claim-closure-modal.component.ts`, `claim-overview.component.ts`, `claim-dev-details-modal.component.ts`, `app.routes.ts`, `claim-overview.json`, `mock-state.service.ts`, `scripts/audit-ac-logic.mjs`
- **Notes:**
  - **Two flags, not one — the loop was otherwise unclosable.** With only `hasActiveRecovery`, resolving the last recovery case flips it back to false, which reads as `yes-pending`: a closure blocker saying *"no recovery case has been set up"* about work that had just been finished, with no action available to clear it. Caught before shipping by walking the state machine backwards from the terminal state. Fixed with `hasRecoveryCase` + a fourth state, `yes-settled`. `blocksClosure` still covers only `unanswered | yes-pending`.
  - **A real bug in the committed Phase A** (`b03d2b7`): `onRecoveryUpdated` repainted the card but never called `patchOverview`, so the answer was lost on navigation — clicking **Set up recovery case** would land on a page that still believed the question was unanswered. Fixed here, along with appending the activity.
  - **`patchOverview` no-ops on a claim with no overview record** (`mock-state.service.ts:91`), so the page loads the overview *before* syncing the derived flags. A create that silently failed to persist was the first bug this design would have produced.
  - **The audit script hand-mirrors the derivation.** `recoveryPotentialState()` exists twice — in the model and in `audit-ac-logic.mjs` — so both were changed in the same commit. An `overviewPatch` that sets the flags by hand still wins over the derived value: an AC is allowed to describe a state the seeded case list doesn't contain.
  - **CLM-2024-003 was chosen as the recovery-domain claim** because `heads-up.json` hu-004 already narrates *"Subrogation opportunity identified — potential recovery of USD 120k from carrier"* on it. CLM-2024-001 was left alone: AC-01/AC-04 assert `recoveryPotential: 'no'` on it with no override, and every `canClose` assertion across all tickets targets CLM-2024-001 or CL-2025-001 (both `'no'`), so promoting `yes-pending` to a hard blocker breaks nothing.
  - **A recovery case is not a recovery booking.** `financial-overview.json` already has `recoveries` rows — those are ledger entries. A `RecoveryCase` is the pursuit (who, on what basis, how much is expected, is it still running). Kept in a separate file for that reason.
  - **New cases open as `In progress`, not `Draft`.** A Draft the handler must remember to promote is the same dead end the call complained about.
  - **FormBuilder trap:** `fb.group({ x: ['', { nonNullable: true, validators: [...] }] })` does not work — the array shorthand reads slot 2 as validators, so the object becomes the validator and the control's type widens. Use plain `['', [Validators.required]]` and `?? ''` at read time.
  - **`nx-message [context]` needs a declared union.** A `computed` returning an object literal widens `context` to `string` and fails the template's input type. Declare the interface (`RecoveryGuidance`) and type the computed with it.
  - **Pre-existing audit failure, not from this work:** `audit:ndbx-wrapper` fails on 3 raw `<input>`s — `navbar.html:21` and `file-restriction-card.component.html:18` are already like that in `HEAD`, and `add-section-entity-modal.component.html:99` belongs to another task's uncommitted work.

---

## 2026-09-01 — Bug fix: "Edit claim details" was dead on 22 of 27 claims

- **Source:** verbal report — *"ทำไม edit claim ทำงานไม่ function เลย … เข้าไปก็ว่างเปล่า … save ห่าอะไรก็ไม่ได้"*. The user's reasoning is the requirement: a claim file only exists because it came through FNOL, so Edit must work on any claim in the list.
- **Module:** Claims — Edit claim details (`/claims/:id/loss-information/edit`)
- **Files touched:** 5 — `core/mock/services/mock-loss-information.service.ts`, `features/claims/edit-loss-information/edit-loss-information.component.{ts,html,spec.ts}`, `features/dashboard/dashboard.spec.ts`
- **Notes:**
  - **One root cause, three symptoms.** `loss-information.json` hand-authors records for 5 claimIds (`CL-2025-001`, `CLM-2024-001`, `CLM-123456`, `CLM-345678`, `CLM-910111`) against 27 claims in `claims.json`. `getByClaimId` returned `null` for the rest → `original()` stayed null → `computeDiffs()` short-circuited on `if (!orig) return diffs;` → `pendingChanges()` was permanently `[]` → the header read "No changes", the ledger never rendered, and Save's `[disabled]="pendingChanges().length === 0"` could never clear. The blank page and the dead Save button were the same line of code.
  - **Fixed at the data seam, not by hand-seeding 22 JSONs.** `getByClaimId` now synthesizes a record from the `Claim` and persists it, exactly mirroring `MockClaimOverviewService.fromClaimOrFallback()` / `synthesizeOverviewFromClaim()` — same rationale, already-blessed pattern. Persisting matters: `save()` looks the record up by `claimId`, so without `ensureRecord` every save would append a second record for the same claim.
  - **Synthesized times are placeholders (`09:00` / `10:00`).** `Claim` carries no time of day anywhere, but FNOL marks both times required, so a claim file cannot exist without them. Leaving them `null` kept the form invalid with the error hidden inside a collapsed "Update" group — a Save button that refuses with nothing on screen to fix. The two constants are the same ones `FnolStateService.prefillFullFromSkeleton` already uses. `dateOfNotification` falls back to `claim.dateCreated` (the claim was created off the notification); `typeOfDamage` is left empty rather than guessed, so `prefillForm`'s `editingField` logic opens the screen on the field the handler actually has to fill.
  - **`lossLocation` follows the data, not the model.** Seeded records store the location-picker shape (`{ locations: [...] }`); the `LossLocation` interface in `loss-information.model.ts` (street/city/postalCode/locationType…) is stale and matches nothing that reads it. Synthesis builds a `LocationPickerOutput` and casts once, as `edit-loss-information.component.ts` already does. **The interface still needs fixing** — left out of a bug fix because it reaches into FNOL.
  - **A refused Save now says why.** Every field group is collapsed behind an Update/Add link, so a failing required control took its `nx-error` down with it. `onSaveChanges` calls `revealFirstInvalid()`, which names the incomplete fields, reopens the group holding the first one, and announces it. This bug was independent of the data gap and would have survived the fix above.
  - **`computeDiffs` diffs against a blank baseline** when `original()` is null (an unknown claimId, since a real claim now gets a synthesized record), so a first-time capture is saveable at all instead of Save staying disabled on a screen the user just filled in.
  - **`ng test` was broken in `HEAD` before this work, for every spec file.** `dashboard.spec.ts` still called `Dashboard.isDormant`, which moved to `ClaimsPortfolioWidgetComponent` when the dashboard was split into widgets — a `TS2339` that fails the whole run, not just that file. Repaired (pointed at the widget, same assertions) because it blocked verifying this fix. 30/30 pass now, including 4 new Gate 4 tests that mount the screen on `CLM-2024-003` and assert the synthesized load, form validity, a reachable save, and the blocked-save message.
  - **Pre-existing file-size violations, made slightly worse:** `edit-loss-information.component.ts` was already 480 lines (limit 300) and its template 212 (limit 200) before this change; now 532/218. A proper split is its own task — not folded into a bug fix, where it would bury the fix in a refactor.

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
