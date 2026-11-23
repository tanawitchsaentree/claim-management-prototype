# FNOL Reserves: one card per claim, and the Add reserve flow

UX basis for the FNOL Reserves step, then an audit of what is built.
Route: /fnol/reserves (after Parties, before Summary). DEV banner ticket: FNOL-RESERVES-MULTI.

Sources used

- Production page object: claims-management-main/testing/src/pages/ReservesPage.ts (the only surviving source for this screen; the Reserves MFE itself, `finance-service-reserve`, is not in the local copy)
  - Claim card: claim number heading, then "Policy ID", "Total reserve", "Allianz share" (getPolicyId, lines 94-116)
  - Add reserve dialog: Section, Party, Damage, Reserve type dropdowns, each enabled after the one before; "Proceed to add" (lines 33-47, 138-359). The newer smoke flow picks Section, then Reserve type straight away (lines 681-738: "this flow has no Party dropdown")
  - Editor: full page, heading is the damage name ("Material Damage", h1), tabs Indemnity / Expenses / Recoveries, a sub-type dropdown ("Select") and an Amount field per tab, a close icon that goes back with the values kept (lines 49-66, 361-577)
  - Table: a total row first, then an Indemnity, an Expense and a Recovery row; total = indemnity + expenses - recoveries (5,000 + 3,000 - 250 = 7,750, lines 579-652). Row menu "Open menu" > "Edit Details"
  - Next: "The FNOL event may create multiple claims. Any claim with no reserve and no narrative triggers a blocking warning ... fill the inline narrative form for each affected claim, retry Next" (lines 740-812)
- Production smoke test: testing/tests/smoke/FNOLEventActivation.spec.ts steps 26-29 (claim number exists from the Parties step on; sub-type "Property Damage", amount 10000)
- Production summary: frontend/apps/claims-management-summary (Next of Reserves goes to Summary)
- Prototype before this change: step-reserves (one policy only), AddReserveModalComponent (flat Section + Reserve type), reserve-detail-panel (side panel), BMPCC-22665 IMP-7 ("FNOL reserves belong to the first selected policy")

## Who

Claim handler (commercial lines) registering a new loss.

- Knows: the loss story, which entities are damaged, which parties are involved, a first rough figure for the damage (from the broker, the client or a quick site report).
- Often does not know: an exact amount. Many FNOLs are registered before anyone has looked at the damage.
- Juggling: several FNOLs a day, broker mails, getting the first reserve right (it drives authority limits and reporting).
- Stakes: a claim without a reserve and without a reason is a reporting gap. A reserve on the wrong section or party is wrong reporting and later rework.

## Story

As a claim handler, I want to enter a first reserve, or say why there is none yet, for every claim this loss creates, so that each claim starts with an honest financial picture and nobody has to chase it later.

Real-world trigger

- A fire at Jonas Kaufmann's site damages the building (Property policy POL-2024-021), a visitor's car (Liability POL-2024-022) and a production machine (Engineering POL-2024-023). One notification, three claims.
- The broker gives a first figure for the building (about EUR 250,000). Nothing is known yet for the car or the machine.

## Journey

1. Arrive on Reserves (from Parties)

- Sees: "Reserves", then one card per claim, stacked in the order the policies were chosen. Each card: "Claim 1" plus its policy, line of business, total reserve, Allianz share, Allianz reserves.
- Knows: which policies got a claim (chosen on the Policies step).
- Feels: oriented if each card clearly says which policy it is.

2. Start a reserve on one claim

- Sees: "Add reserve" on that card.
- Does: opens it. A small dialog asks Section, Party, Damage, Reserve type, in that order. Each one opens up only after the one before is chosen. When there is only one choice it is already picked.
- Feels: guided. Needs to see which claim the dialog is for.

3. Enter the amounts

- Sees: "Proceed to add" opens a near full-screen editor titled with the damage type (for example "Material damage"), which claim, section, party and damaged entity it is for, and tabs Indemnity / Expenses / Recoveries, on the tab picked in the dialog.
- Does: picks a sub-type, types an amount, can add more lines or switch tab.
- Feels: confident if the totals update while typing and recoveries visibly reduce the total.

4. Go back to the claims

- Does: Done, or the X. The values are kept, like production.
- Sees: a toast that says what was saved on which claim; the card's total and table rows (total first, then Indemnity, Expenses, Recoveries).

5. A claim with no figure yet

- Does: "Add explanation" on that card, picks a reason ("Waiting for loss adjuster report", ...), Save.
- Sees: the reason on the card instead of the prompt.

6. Next

- If any claim has no reserve and no explanation: a dialog names those claims and says what to do. After closing it, those cards are marked so they are easy to find.
- Otherwise: goes to Summary. Each claim's total shows there, and after Submit on each claim's Claim Overview and Financial tab.

## Pain points

- Several claims on one page look alike. Entering a figure on the wrong claim is easy if the card does not shout its policy.
- A blocking "Reserve required" message that does not say which claim is meant forces the handler to hunt through every card.
- Four dropdowns in a row are slow when most claims have one section and one party.
- Recoveries in the same editor read like more money. If the total adds them, the reserve is overstated.
- Adding the same section, party and damage twice creates two lines that are really one.
- Closing the editor with nothing typed should not leave an empty line behind.
- No parties entered on the Parties step means there is nobody to reserve against.

## Needs

- Step 1: each card names its claim and policy; totals per claim, not one grand total.
- Step 2: the dialog says which claim it is for; dropdowns that open up in order; single choices pre-picked; a clear reason when a list is empty (no sections or no parties yet).
- Step 3: the damage type as title, who and what it is for under it, live totals, recoveries shown as minus.
- Step 4: a clear "saved" signal, values kept on close, blank lines dropped.
- Step 5: the explanation per claim, same panel as before.
- Step 6: the gate per claim, naming the claims, and the cards marked after the dialog.

## Scenarios

- RES-01 Three claims, nothing entered yet: three cards (Claim 1 POL-2024-021 Property, Claim 2 POL-2024-022 Liability, Claim 3 POL-2024-023 Engineering), each "No reserves yet" with "Add explanation".
- RES-02 Add reserve dialog: Section, Party, Damage, Reserve type open up in order; changing Section clears the choices after it; single choices are pre-picked; Proceed to add stays off until all four are set.
- RES-03 Editor: opens on the chosen tab with one empty line; sub-type and amount; more lines; tabs; totals = indemnity + expenses - recoveries; Done keeps the values and a toast confirms.
- RES-04 Same section, party and damage again: the dialog opens the existing line on the chosen tab instead of adding a second one.
- RES-05 Edit details and Remove from the row menu.
- RES-06 Next with claims missing a reserve and an explanation: dialog names them, the cards are marked; fixing each one lets Next through.
- RES-07 Single policy FNOL (no Policies step): one card, Claim 1, the gate works the same.
- RES-08 Submit: each claim's Summary total, Claim Overview total reserve and Financial tab reserves come from its own card.
- RES-09 Empty lists: no ticked entities or no parties yet, the dialog says so and points to the step to fix it.

## Decisions (not settled by production or a ticket)

- RES-D1 Claim number on the card: production already has a claim number here (claims exist from the Parties step). This prototype creates claims on Summary Submit, so the card says "Claim 1", "Claim 2" with the policy, and the claim number comes at Submit.
- RES-D2 Section = one claim section per damage type with ticked entities (the same rule Submit uses to create sections). Damage = a ticked entity in that section. Party = the parties entered on the Parties step (they go onto every claim, IMP-7).
- RES-D3 Single choices are pre-picked, so with one section and one party the handler goes Section, then Reserve type, as in production's newer smoke flow.
- RES-D4 Editor = bottom sheet (the app's near full-screen sheet), not a route. Values are kept on Done and on X, like production's close icon. No Cancel.
- RES-D5 Same section + party + damage opens the existing line (no duplicates).
- RES-D6 IMP-7 changed: reserves are now entered per claim on the Reserves step, because production asks for a reserve or a narrative on every claim. Before, only the first policy had reserves in FNOL.
- RES-D7 Allianz share per claim comes from the policy's co-insurance (Allianz participant share), 100% when there is no co-insurance.
- RES-D8 Sub-types per reserve type (Indemnity: Property damage, ...; Expenses: Legal fees, ...; Recoveries: Salvage, ...). Production only shows "Property Damage" and "Legal Fees" as examples.
- RES-D9 The old "This policy / All policies / By policy" switch in the side panel (a prototype invention with made-up cross-policy data) is removed. The stacked claim cards replace it.
- RES-D10 Co-insurance flag column is dropped from the editor; production shows only sub-type and amount per tab.
- RES-D11 The Next check counts only an indemnity amount as "a reserve" (production: "Please add a indemnity reserve or a narrative"). A claim with only expenses still needs an explanation, and the card prompt says "No indemnity reserve yet."

## Audit (after build, 2026-11-23)

Walked every scenario in a real browser (Playwright, DEV banner ACs applied), zero console errors.

- RES-01 ok: three cards, each names claim, line of business and policy; totals per claim.
- RES-02 ok: single section pre-picked; Party, Damage, Reserve type open in order; changing Party clears the later two without showing errors; Proceed stays off until all four are set. Fixed during the walk: a cleared field showed "Choose the damaged entity." straight away.
- RES-03 ok: editor opens on the chosen tab with an empty line; totals update while typing; recoveries shown as minus and subtracted (250,000 + 12,000 - 5,000 = 257,000); amount without sub-type blocks Done on that tab; toast names the claim. Fixed during the walk: the tab list did not re-render after "Add another line" in some cases (now driven by a signal).
- RES-04 ok: same section, party and damage opens the existing line, one line stays.
- RES-05 ok: Edit details and Remove; Remove asks first; card goes back to its empty state.
- RES-06 ok: dialog names Claim 2 and Claim 3, page scrolls to Claim 2, both cards marked red until fixed; Next then reaches Summary.
- RES-07 ok: one card, five sections offered, single-claim wording in the dialog.
- RES-08 ok: Summary 257,000 / 40,000 / 180,000; after Submit each claim's lossAmount and Financial reserves are its own. Seen, not caused here: the Financial page keeps showing the previous claim's list when you jump from one claim's Financial page straight to another's inside the app.
- RES-09 ok: with no parties the dialog says so and Proceed stays off. Fixed during the walk: Proceed was on, because a disabled field does not count against the form.

Still open

- The card heading is "Claim N", not the real claim number (RES-D1).
- Summary still shows the "no reserve" explanation of the first claim only.
- Recoveries still do not reach the Financial tab (unchanged, separate design).
