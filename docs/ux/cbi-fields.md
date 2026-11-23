# CBI branch fields on FNOL Loss information

Route: /fnol/loss-information (policy POL-2024-001 offers all 12 CBI case types).
Ticket ACs: public/tickets/fnol-cbi-fields.json (AC-01 to AC-06).

## Sources

- Confluence 3163290837, "CBI Extension, Functional Design (BMPCC-17927)", version 32:
  "Data Captured" and "Category-specific fields" tables, Open Points 4, 6, 10, 13, 14,
  and the embedded "CBI Coverage Type Flow" diagram (Untitled Diagram-1788248817521).
- Confluence 3157631012, "PI 2026.4 UI/UX Alignment Open Points", row 1: Authority Order (Y/N)
  is asked for the four Denial of Access types; Add location only for the four
  Supplier/Customer types.
- Production repo ../claims-management-main: no CBI fields anywhere in the frontend.
- Built code: src/app/shared/components/cbi-panel/, src/app/shared/utils/cbi-rules.ts,
  src/app/features/sections/entity-detail-panel/.

## What the design says, per branch

- Supplier / Customer, Named / Unnamed (4): name (required for Named), industry (optional,
  manual entry in baseline), originating loss location (Country, City, ZIP required).
- Denial of Access (4): Authority order (Y/N). Mapping still "hypothesis, needs Sarah"
  (Open Point 13), but the UI/UX alignment page lists the four types explicitly.
- Loss of Attraction (2): "Trigger event location, may overlap with Originating Loss
  Location; needs field-level reconciliation". The diagram asks "is this the Loss location
  captured? need use case". Not decided, so no field.
- Service Interruption (1): Utility type dropdown, Power / Gas / Water / Steam /
  Telecommunications / IT.
- (Air)Port Blockage (1): "?" in the diagram, Open Point 14. No field.
- Claim Section "includes Extension Limits": the limits come from the AiP per case
  (Open Point 10). The design gives no values or layout. Not built.
- Industry as a WB/AOC code picker: the diagram says "in WB, AOC codes there will be
  industry codes", but the Data Captured table (newer, BMPCC-18249 AC03) says "Manual
  entry only in baseline (no search)". Stays a text field.

## Who

Claim handler on commercial property and BI claims, registering a new loss at FNOL.
Has the broker's first notice in front of them: what stopped the business and why.
Does not know the CBI case-type names by heart; they come from the policy wording.

## Story

As a claim handler, when a Business Interruption loss was caused away from the insured's
own site, I want to record the CBI case type and only the extra facts that case needs, so
the right CBI section is created and underwriting can track CBI accumulation.

## Journey

1. Ticks Business interruption under Type of damage. Sees the CBI question. Knows from the
   broker that the cause was outside the client's site.
2. Answers Yes. Sees "Contingent business interruption details" and the case type list,
   grouped Supplier, Customer, Denial of Access, Loss of Attraction, Other.
3. Picks the case type. Sees only the fields that type needs, nothing else.
4. Fills them in and presses Next. A missing answer is named in the error summary.
5. Submits the claim. Opens Sections, then the BI entity. Sees the same answers there.

## Pain points

- A long form with fields that do not apply to this case type.
- Not knowing whether a field is required until Next fails.
- Answers typed at FNOL that are nowhere to be seen on the created section.

## Needs

- Fields appear only for the case type picked, and disappear (and clear) when it changes.
- Required fields say so in the label, and the error summary names them.
- The section's entity panel repeats what was captured, so nothing has to be re-checked
  in Edit claim details.

## Scenarios

- S1 Supplier Named: name (required), industry (optional), originating location (required).
  Customer types read "Customer name" / "Customer industry". Unnamed: name optional.
- S2 Denial of Access (any of 4): "Was access denied by order of an authority?" Yes / No,
  required. No name, industry or location.
- S3 Loss of Attraction (either): no extra field. Next works after picking the type.
- S4 Service Interruption: Utility type dropdown with the six options, required.
- S5 (Air)Port Blockage: no extra field. Next works after picking the type.
- S6 Switching case type: the previous branch's fields go and their values are cleared.
- S7 After submit: the BI section's entity panel shows case type, plus third party, industry
  and location (Supplier/Customer), or the authority answer (Denial of Access), or the utility
  type (Service Interruption). Rows that do not apply to the type are not shown.
- Edge: policy offering no CBI type (POL-2024-003): the question is not asked at all
  (BMPCC-18249, unchanged here).

## Walk-through audit (after build)

- S1 to S5 walked on /fnol/loss-information with Playwright, each case type picked from the
  grouped list, Next pressed empty to see the required message, then filled.
- S6: picked Denial of Access, answered Yes, switched to Service Interruption: authority
  question gone; switched back: it is empty again.
- S7: submitted one claim per branch (Supplier Named, Denial of Access, Loss of Attraction,
  Service Interruption, Port Blockage) and opened the entity panel: each shows only its own rows.
- Zero console errors in every walk. DEV banner: FNOL-CBI-FIELDS AC-02 applies and lands on
  /fnol/loss-information with the policy selected.
