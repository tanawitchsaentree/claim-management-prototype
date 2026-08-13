# Tech Debt Register

Extracted from `CONVERSIONS.md` deferred items (`⚑`) + known gaps from sessions.
Owner = team unless noted. Priority: **P1** (blocks feature correctness) / **P2** (UX gap) / **P3** (cleanup/future-proof).

---

## Claims — Edit Loss Information

| ID | Item | Priority | Source |
|----|------|----------|--------|
| TD-001 | `edit-loss-information` FormGroup is a manual copy of `FnolStateService`'s lossInformation group. If FNOL fields change, edit form must be updated manually. Fix: extract shared `buildLossInfoFormGroup()` factory. | P2 | BMPCC-415-F2 |
| TD-002 | CanDeactivate guard missing: browser Back button and nav-link clicks bypass the discard modal. Fix: implement Angular `CanDeactivate` route guard. | P2 | BMPCC-415-F2 |
| TD-003 | ~~`computeDiffs()` does not fully diff cause details sub-fields (water/theft sub-fields). Extend when needed.~~ **Resolved 2026-08-13** — moot, cause details removed entirely (Isabelle design review). | P3 | BMPCC-415 |
| TD-004 | `policyNumber` passed as `null` in edit mode for LocationPicker — policy-location lookup won't work. Requires claimId → policyNumber mapping. | P2 | BMPCC-415 |
| TD-005 | `prefillFromExistingLossInfo()` added to FnolStateService but edit screen uses its own FormGroup (intentional isolation). Available for future wizard-edit hybrid flows. | P3 | BMPCC-415 |
| TD-006 | `BMPCC-11681 Q open:` Confirm with Product that Reopened claims should allow loss information edit. | P1 | BMPCC-11681 |

---

## Claims — Closure Blockers (Cross-domain)

| ID | Item | Priority | Source |
|----|------|----------|--------|
| TD-007 | **Payments** blocker is flag-only (`hasOpenPayments`). No `MockPaymentsService` exists. Fix: create model + mock service + mock data + wire into `validateBlockers()`. ~M effort. | P2 | BMPCC-14435 |
| TD-008 | **Recovery** blocker is flag-only (`hasActiveRecovery`). No `MockRecoveryService` exists. Same fix as TD-007. | P2 | BMPCC-14435 |
| TD-009 | **Deductible** blocker is flag-only (`hasOpenDeductible`). No service. Same fix. | P2 | BMPCC-14435 |
| TD-010 | **Provider** blocker is flag-only (`hasActiveProvider`). No service. Same fix. | P2 | BMPCC-14435 |
| TD-011 | **Bills** blocker is flag-only (`hasUnpaidBills`). No service. Same fix. | P2 | BMPCC-14435 |
| TD-012 | **Reports** blocker is flag-only (`hasIncompleteReports`). No service. Same fix. | P2 | BMPCC-14435 |
| TD-013 | "Go to Reserves" navigation link is rendered but disabled (muted + `cursor:not-allowed`). `/claims/:id/financial` redirects to overview — no dedicated reserves route exists. | P3 | BMPCC-14435 |

---

## FNOL — Summary Step

| ID | Item | Priority | Source |
|----|------|----------|--------|
| TD-014 | Per-section earliest date: should this live in the loss-information `events` FormArray (each section captures own date) or stay derived in summary VM? Mock chose derived. PO-OPEN. | P2 | 2026-05-27 FNOL Summary |
| TD-015 | Multi-claim split is triggered by `policyNumber.startsWith('POL-2024-MC')` — not real backend grouping logic. Needs real grouping rule (entity-type vs. coverage vs. damage-type). | P1 | 2026-05-27 FNOL Summary |
| TD-016 | `LossEventOverviewComponent` shows 3 hardcoded derived claims regardless of route ID. Real screen will hydrate from a service. | P1 | 2026-05-27 FNOL Summary |
| TD-017 | `step-summary` TS file at 299/300 lines — at limit. Next change must split `buildClaimGroups` / `deriveEarliestSectionDate` into a sibling helper. | P3 | 2026-05-27 FNOL Summary |

---

## FNOL — Loss Location (CWB)

| ID | Item | Priority | Source |
|----|------|----------|--------|
| TD-018 | `LocationItem.source` enum extended to include `'cwb'` — confirm this propagates correctly to all downstream consumers of `source`. | P3 | BMPCC-219 |

---

## FNOL — Duplicate Claim Check

| ID | Item | Priority | Source |
|----|------|----------|--------|
| TD-019 | "Submitted by me" filter uses string match (`requester === user.name`). Should use user ID when backend provides it. | P2 | BMPCC-216 |

---

## Dashboard

| ID | Item | Priority | Source |
|----|------|----------|--------|
| TD-020 | `DORMANT_DAYS = 30` threshold hardcoded. Needs business sign-off on per-LOB rules. | P2 | DASH-P2 |
| TD-021 | `bigReserveMovements: 3` in KPI row is hardcoded placeholder. Needs `ReserveMovement` model + real service. | P1 | DASH-P2 |
| TD-022 | `€50k` reserve movement threshold in banner copy is a placeholder value. Confirm with business. | P2 | DASH-P2 |
| TD-023 | Payments card shows static "150,000 EUR" — needs real payment aggregation service. | P1 | DASH-P2 |
| TD-024 | `dashboardRole: 'aviation-handler'` not mapped to existing `'admin'|'adjuster'|'claimant'` RBAC system. Needs role model decision. | P2 | DASH-P2 |
| TD-025 | Calendar integration is internal mock only — no Microsoft Graph / Outlook API. Decision on Outlook integration deferred. | P3 | DASH-P2 |
| TD-026 | `AuthService` uses `localStorage('dashboard:persona')` for persona persistence — intentional for dev demo. Remove before production auth wired. | P1 | DASH-P2 |

---

## Mass Event

| ID | Item | Priority | Source |
|----|------|----------|--------|
| TD-027 | `MassEvent.region` is `string` (singular). Confluence spec implies `Region(s)` = array. Changing to `string[]` requires admin UI + mock data updates. | P2 | BMPCC-ME-POPOVER |

---

## Claims — Sections

| ID | Item | Priority | Source |
|----|------|----------|--------|
| TD-028 | Section closure `canClose` logic is computed independently in both `ClaimClosureService` (runtime) and `audit-ac-logic.mjs` (Node). Drift risk accepted because both share `mock-state` source data. If logic changes, update both. | P2 | BMPCC-14434 |

---

## Notes

- Items marked **P1** affect correctness / production-readiness.
- Items marked **P2** are visible UX gaps or incomplete feature surfaces.
- Items marked **P3** are code quality / future-proofing; safe to defer until a related feature touch.
- When an item is resolved: mark it with a strikethrough comment and the resolution date, or delete the row and add a note to `CONVERSIONS.md`.
