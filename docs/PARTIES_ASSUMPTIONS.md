# Parties Step — Architecture Assumptions

Source: Hierarchy refactor task, 2026-05-12
Status: PENDING_PO_CONFIRMATION

These assumptions were made based on Figma visual evidence and business context inference.
Each is flagged for PO confirmation before the Parties step is shipped.

---

## A1 — Top level = Claim

**Assumption:** The top-level grouping is a Claim ID (e.g. "123456.1").
For the current FNOL flow, there is exactly 1 claim seeded as "FNOL-CURRENT".
Multi-claim view (e.g. showing 21 related/historical claims) is out of scope
until PO confirms whether this view shows prior claims for the same insured.

**Source:** Figma shows "Claim ID: 123456.1" and "Claim ID: 123456.2" as top-level rows.
**Impact if wrong:** If FNOL always = 1 claim, Claim row is unnecessary hierarchy.
If related claims should appear, `getClaimsForPolicy` needs to fetch historical data.

---

## A2 — Section = sub-grouping within a claim

**Assumption:** "Section ID: ABC001" is an opaque identifier for a party grouping
within a claim — treated as a tag on each Party for grouping purposes.
Exact business meaning (coverage section, loss location, etc.) is unknown.

**Source:** Figma shows Section rows between Claim row and party rows.
**Impact if wrong:** Sections may need to be predefined (fetched from policy data),
not inferred from party `sectionId` fields.

---

## A3 — Add Party entry points (3 paths)

**Assumption:**
1. Top toolbar button → adds to first claim's directParties
2. Claim row kebab "Add additional parties" → adds to that claim's directParties
3. Section row kebab "Add additional parties" → adds to that section's parties

**Source:** Figma shows kebab on Claim and Section rows with "Add additional parties" option.
**Impact if wrong:** If UI should prompt user to choose direct vs section,
the modal needs a target-selector step before the search form.

---

## A4 — Party belongs to exactly one location in hierarchy

**Assumption:** A party is assigned to either `claim.directParties` OR a `section.parties`,
never both. `sectionId` being undefined means direct.

**Source:** Structural assumption — no evidence of parties in multiple locations.
**Impact if wrong:** If parties can appear in multiple sections, the flat cache model
must be redesigned (current model deduplicates by partyId on add).

---

## A5 — Claim and Section row kebab: only "Add additional parties"

**Assumption:** Claim rows and Section rows have a single kebab action:
"Add additional parties". No View/Edit/Remove at Claim or Section level.
View/Edit/Remove exist only on party rows.

**Source:** Figma audit described kebab at Claim and Section level with Add action visible.
**Impact if wrong:** May need separate actions (e.g. "Remove claim", "Rename section").

---

## A6 — Party row kebab: View details / Edit role / Remove

**Assumption:** All party rows (direct and in-section) have the same 3 kebab options.

**Source:** Phase 5 implementation — confirmed in prior audit.
**Impact if wrong:** Low risk — this is the same pattern as Entities & Damages.

---

## A7 — Selection state is visual cascade only (no bulk action)

**Assumption:** Checking a Claim checkbox checks all its Section checkboxes (cascade).
Checking a Section checkbox contributes to Claim indeterminate state.
No bulk action is wired to this selection — it is visual-only until use case is defined.

**Source:** Figma shows checkboxes but no bulk-action toolbar was visible in the audit.
**Impact if wrong:** If bulk delete/move is needed, selection state must drive an action bar.

---

## A8 — Display broker hierarchy toggle is deferred

**Assumption:** The toggle is a visual stub. No logic is wired.
"Broker hierarchy" likely means showing broker-role parties in a sub-tree under their client,
but the exact behavior has not been confirmed.

**Source:** PO has not provided a spec for this toggle.
**Impact if wrong:** May require a significant re-render of party rows for broker-client relationships.

---

## A9 — Pagination unit = Claim, default 2 per page

**Assumption:** Pagination counts Claim rows, not individual parties.
Default page size = 2 (matches Figma screenshot showing "Claims per page: 2").

**Source:** Figma label "Claims per page: 2".
**Impact if wrong:** If page size should be larger (e.g. 10), update `claimsPerPage`
in `step-parties.component.ts`.
