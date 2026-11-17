# Financial pages: Financial Overview, Limits and Deductibles, Recoveries

Routes:
- /claims/CLM-2024-001/financial (Financial Overview, claim and section level)
- /claims/CLM-2024-001/limits (Limits and Deductibles)
- /claims/CLM-2024-003/recoveries (Recoveries)

Built in commit 9157cf0 (light accordion per table, open by default). No single ticket.
Related tickets in public/tickets: bmpcc-14831 (Financial Overview layout), bmpcc-7133 (Limits and Deductibles), bmpcc-17779 (Recovery potential, AC-07 to AC-10 cover the Recoveries page), gg-7-financial-overview and gg-6-recoveries (Global Genius booking states), gg-4 payments, gg-5 reserves.

## Sources

- bmpcc-14831 AC-01: Transaction summary with an item count; pagination was asked for, a plain count was built (accepted deviation).
- bmpcc-7133 AC-01: limits and deductibles as separate sections with a Claim / Section level switch.
- bmpcc-17779 AC-07 to AC-10: Recoveries is a real page, explains why the handler was sent there, Create recovery case, resolve as Recovered or Written off.
- gg-7 AC-01, AC-02: one line saying how many items couldn't be booked, split into "needs you" and "with Finance", each a link; red claim banner with Send claim again.
- gg-6 AC-01 to AC-03: recovery booking statuses; Send again; same status on Recoveries and Financial > Recovery bookings.
- Confluence 2613336187, "07. Financial Overview Workflow SDD": one screen with section-level payments and reserves, outstanding amounts and actions; FR-001 to FR-007 (totals by section, outstanding vs paid, Make Payment and Update Reserves prefilled, drill-down to section and line, recoveries); must handle more than 1,000 lines and degrade gracefully when a source is down.
- Confluence 2592411533, "06. Financial Summary Workflow SDD": claim-level widgets Payments, Reserves, Additional Financial Details, Outstanding.
- Confluence 3222338365 and 3012968424 (progress reports): 14376 summary, 14377 pagination, 13871 transaction summary filtered by section, 14355 Allianz / Market share switch, 14661 currency conversion, 17379 approved transactions only, all Done.
- Production test page testing/src/pages/FinancialSummaryPage.ts:19-47,181-333 in ../claims-management-main: H1 "Financial overview", H2s "Financial Summary", "Additional Financial details", "Payments", "Reserves".
- Confluence 3348478719, "09. Limit and Deductibles Workflow SDD": show limits and deductibles at claim and section level with how much is used and how much is left; one deductible per section; net payment = payment minus selected deductibles; unknown claim returns 404.
- Confluence 3197535868, "08. Limits & Deductibles Solutioning": "(Ref.)" marks a combined limit; several limits on one BI section when more than one cause of loss; waiting period, indemnity period, min, max still to confirm.
- Confluence 2748393772 "Technical Documentation for Recovery-Draft" and 2758544597 "Recovery Domain": Recoveries is its own micro-frontend (team Opal, not in the prod copy). Types Subrogation, Salvage, Deductible.
- Confluence 2899716834, "CFM-560 Recovery Status": status Open, Closed, Reopen; a reason is required to close or reopen (legal, time-barred, successful, without success, cost/benefit, partially successful); a closed recovery allows no edits.
- Confluence 2719855458: one recovery per section; booking only after money is received; follow-up within 90 days.
- Confluence 3012962372: BMPCC-17779 (Recovery potential flag) was descoped. The prototype uses it as the home of the Recoveries page.
- Production close check: frontend/apps/claims-management-overview/src/app/shared/components/close-claim-confirmation-dialog/close-claim-confirmation-dialog.component.ts:42 ("No active recovery actions").
- "Written off" was not found in any Commercial Claims source. The prototype's case statuses (In progress, Recovered, Written off) are an assumption.

## Who

Claim handler (and the approver or manager who checks the numbers).
Knows the claim story, the policy, the payees, what was promised to the broker.
Does not do finance for a living. Gross, net, reinsurance share and exchange rates are someone else's world. (assumption)
Juggling: many open claims, payment requests, approvals, broker chasing, month-end deadlines (dashboard banner "Q2 Financial Closure Period").
How often:
- Financial Overview: several times a week per active claim, every time money moves or someone asks "what is the exposure?". (assumption)
- Limits and Deductibles: before a reserve or payment, and when a payment looks too large. (assumption, SDD 3348478719 ties deductibles to payment)
- Recoveries: rarely. When a third party is to blame, when salvage is sold, and before closing a claim (closure blocker, bmpcc-17779 AC-03 to AC-10).

## Story

As a claim handler, I want to see in one place how much is reserved, paid, pending and recovered on a claim, what the policy allows, and what we are trying to get back, so that I can set the right reserves, pay the right amount and close the claim without surprises.

Real-world triggers:
- A payment request comes in: "is there enough reserve and room under the limit?"
- The approver or the manager asks: "what is the incurred on this claim?"
- Global Genius rejects a booking and a task says "couldn't be booked".
- A carrier or contractor caused the loss and we want our money back.
- The claim is ready to close and the checklist says a recovery is still open.

## Journey

1. Opens Financial Overview from the side menu.
   Sees: title, Claim / Section level switch, five summary tiles, Financial details, Transaction summary.
   Knows: roughly what was paid.
   Does: reads Incurred and Outstanding reserves.
   Feels: wants the numbers to add up at a glance.

2. Sees a booking problem (if any).
   Sees: yellow line "6 items couldn't be booked: 4 need you (3 payments, 1 recovery) …".
   Knows: probably got a task or a bell notice.
   Does: clicks "3 payments".
   Feels: expects to land on exactly those three.

3. Fixes and comes back.
   Sees: Payments list.
   Does: opens the row, Send again; then Back to the overview.
   Feels: wants Back to go to the overview, not out of the claim.

4. Looks at one section.
   Sees: Section level, a section dropdown, currency and exchange rate, Financial summary.
   Knows: which section the payment belongs to.
   Does: picks the section.
   Feels: needs the same number format as the claim level to compare.

5. Checks what the policy allows.
   Sees: Limits and Deductibles, Claim / Section level, Policy limits, Deductibles.
   Knows: the payment amount in mind.
   Does: finds the limit and deductible for the section.
   Feels: wants "how much is left", not only the full limit.

6. Starts or updates a recovery.
   Sees: Recoveries, summary tiles, Recovery cases, Recovery postings.
   Does: Create recovery case, or ⋮ > Resolve case on an open one.
   Feels: careful, because writing off money is final and audited.

7. Done.
   Sees: toast, the row changed, the tiles updated.
   Feels: sure it happened and the claim is one step closer to closing.

## Pain points

- Numbers that do not add up between tiles, details and transaction rows. The handler stops trusting the page.
- Section level in a different currency (Section 2 is USD, base EUR) and a different number format.
- Links that land on a longer list than they promised.
- Back that leaves the page, because view changes replace the address.
- Section limits shown at claim level look like claim-wide limits. Combined limits are a known open risk (3348478719, 3197535868).
- No "used / remaining" on limits, which is the stated purpose (3348478719).
- Resolving a recovery is final (Confluence: closed recovery allows no edits, 2899716834) but needs a reason; any friction or silent disabled button here blocks closing the claim.
- Toasts that claim an effect that did not happen ("closure no longer waits…").
- Closed claims: actions disabled without saying why.
- Long tables: more than 1,000 lines must work (2613336187); only a count was built (bmpcc-14831 AC-01).

## Needs

- Financial Overview: totals that agree everywhere; one money format (symbol, no decimals or always decimals); the most important column (Total incurred) visible without sideways scroll; booking problems as links that land on just those items; Back returns to the overview; level and section kept in the address.
- Limits: claim level shows only claim-level items; section level shows which section; how much is used and left; a clear note when a limit is combined.
- Recoveries: why I am here (guidance line); what is open, expected, recovered; confirm before resolving or creating; a toast that tells the true effect; disabled actions explain why.
- All three: the same loading spinner, the same empty state, the same closed-claim message.

## Scenarios

Financial Overview
- F-01 Happy: land on claim level and read the numbers.
- F-02 Items that couldn't be booked: follow a link (gg-7).
- F-03 Back after following a link.
- F-04 Section level: switch and pick a section.
- F-05 Collapse and reopen a table.
- F-06 Reload or share the page while on section level.
- F-07 Closed claim.
- F-08 Unknown claim or no data.
- F-09 Loading.

Limits and Deductibles
- L-01 Claim level.
- L-02 Section level.
- L-03 Claim with no limits or deductibles (CLM-2024-003).
- L-04 Unknown claim.
- L-05 How much of a limit is left.
- L-06 Closed claim (CLM-2024-011).

Recoveries
- R-01 Happy: land with cases (CLM-2024-003).
- R-02 Resolve a case as Written off.
- R-03 Create a recovery case.
- R-04 Cancel a half-filled Create.
- R-05 Recovery expected, no case yet (CLM-2024-024).
- R-06 Recovery question not answered (CLM-2024-002).
- R-07 No recovery potential, postings only (CLM-2024-001).
- R-08 Posting couldn't be booked, Send again (gg-6).
- R-09 Closed claim (CLM-2024-011).
- R-10 Loading.

## Checks (owner's rules, applied to every step)

- Visible signal after every action.
- No button that reads as cancel, back or "did nothing".
- Confirm before commit, toast after.
- Stay in context: no jumps, Back returns to where I was.
- Same thing looks the same everywhere (numbers, loading, empty, closed).
- Plain language.
- Only existing NDBX and app components.

## Audit 2026-11-17

Walked in Playwright at 1440 x 900 as Mara Mustermann (handler). Global Genius states loaded with ?pt=GG-7-FINANCIAL-OVERVIEW and ?pt=GG-6-RECOVERIES. Zero console errors.
Screenshots: /tmp/ux-audit/financial-pages-<scenario>-<step>.png (fo-*, ld-*, rec-*).

Result: 25 scenarios, 13 pass, 12 fail.

### F-01 Happy landing: fail
- What the user sees: tiles say Incurred €125,000. The Transaction summary rows say Total incurred €100,000, €400,000 and €10,240,000. A row named "Reserve: Business Interruption" has €1,000,000 under Indemnity payment. The last three columns, including Total incurred, are off to the right and need sideways scroll (fo-happy-01-landed, fo-happy-02-full).
- Why it hurts: the numbers contradict each other on one screen. Pain point "numbers that do not add up". Need "most important column visible".
- Fix: correct the mock rows in src/app/core/mock/data/financial-overview.json for CLM-2024-001 so the running Total incurred ends at the tile value (run npm run audit:ac-logic after). Pin the Transaction and Total incurred columns with the nxTable sticky option already used in src/app/features/dashboard/manager/manager-case-table.component.html (sticky="last").

### F-02 Items that couldn't be booked: fail
- What the user sees: the line "6 items couldn't be booked: 4 need you (3 payments, 1 recovery) …" is clear. Clicking "3 payments" opens Payments with all 12 payments; the toolbar says "Needs you: 5" with "Show only these" off (fo-gg-01-notbooked, fo-gg-02-link-to-list).
- Why it hurts: the link promised 3, the list shows 12, and the "needs you" count is 5 (it also counts sent back and rejected). Check "visible signal", pain point "links that land on a longer list".
- Fix: let the link turn on the existing "Show only these" filter (setNeedsYouOnly in financial-overview.component.ts:225) and make the warning count and the toolbar count use the same rule.

### F-03 Back after a link: fail
- What the user sees: from Payments, browser Back leaves the page (in the test it went to about:blank, in real use to whatever was before Financial Overview) (fo-gg-03-back).
- Why it hurts: the handler cannot return to the overview they came from. Check "stay in context".
- Fix: setView() uses replaceUrl: true (financial-overview.component.ts:279). Use a normal navigation for link clicks, the way the manager dashboard keeps filters in the address so Back works (manager-dashboard.component.ts setFilters, AC-11 of bmpcc-22395).

### F-04 Section level: fail
- What the user sees: claim level shows "€35,000"; section level shows "20,000.00" with no symbol. The dropdown has six sections in two naming styles ("Section 1: - Property Damage" and "Property Damage — Warehouse & Forklift"), and the chosen name is cut off ("Section 1: - Property Dama…"). Section 2 is in USD with base EUR, with no hint which currency the table uses (fo-section-01 to 03).
- Why it hurts: the handler cannot compare claim and section numbers or be sure of the currency. Check "same thing looks the same".
- Fix: format section rows with the same currency pipe as the claim level (financial-details-table.component.html uses currency: … 'symbol' : '1.0-0'), and clean up the section names in the mock data so each section appears once in one style.

### F-05 Collapse and reopen: pass
Light accordion opens and closes, open by default (fo-collapse-01).

### F-06 Reload on section level: fail
- What the user sees: after reload the page is back on Claim level; the address never had the level or section (fo-section-04-after-reload).
- Why it hurts: sharing a link with the approver or returning from Payments loses the section view. Check "stay in context".
- Fix: keep level and section in the query string like view and expand already are (financial-overview.component.ts:152-188).

### F-07 Closed claim: pass (with a note)
Blue message "Claim is closed — Make Payment and Update Reserves are disabled." (fo-closed-01).
Note: the em dash; "This claim is closed, so Make Payment and Update Reserves are off." reads more plainly.

### F-08 Unknown claim: fail
- What the user sees: title and level switch, then a spinner that never stops (fo-unknown-01).
- Why it hurts: no end, no message. The template already has "No financial data available for this claim." (financial-overview.component.html:207) but it is never reached. SDD 2613336187 asks to degrade gracefully.
- Fix: stop loading when the lookup fails and show that existing empty state.

### F-09 Loading: pass
Spinner (fo-loading-01), same as financial-overview.component.html:26.

### L-01 Claim level: fail
- What the user sees: Policy limits lists Overall policy limit €5,000,000, Property damage limit €2,000,000 and Business interruption limit €800,000 with no section column. The same two section limits appear again on Section level (ld-happy-01-claim-level, ld-section-01).
- Why it hurts: section limits read as claim-wide limits. Combined and section limits being mixed up is the top risk in 3348478719 and 3197535868.
- Fix: filter claim level to level === 'claim', the same way section level already filters (limits-deductibles.component.html:75), at line 32 and in the deductibles loop.

### L-02 Section level: pass (with a note)
Section, Type, Amount, Application method per row (ld-section-01). Amounts right-aligned, percentage shows as 2%.
Note: "Business interruption waiting period deductible 2%" mixes a waiting period (usually days, assumption) with a percentage; waiting period is still an open attribute in 3197535868. Check with the business before showing it this way.

### L-03 No limits: pass
"No policy limits found for this claim." and "No deductibles found for this claim." (ld-empty-01).

### L-04 Unknown claim: pass (low risk)
Shows the same empty states (ld-unknown-01). Not reachable from the app's own links.

### L-05 How much is left: fail
- What the user sees: only the full limit. No used, no remaining.
- Why it hurts: SDD 3348478719 says the page exists to show what is used and what is left; the handler checking a payment has to work it out by hand.
- Fix: add Used and Remaining columns, filled from the same totals the Financial Overview tiles use (app-fo-claim-summary). Mark combined limits with "(Ref.)" as the Solutioning page describes.

### L-06 Closed claim: pass
Read-only page, same as open (ld-closed-01).

### R-01 Happy landing: pass (with a note)
Tiles Open cases 1, Expected $120,000, Recovered $16,400; Recovery cases and Recovery postings tables (rec-happy-01, rec-happy-02-full).
Note: the column called "Action" shows a date for finished cases (recoveries.component.html:76 and 111). Rename it or move the date into Status as "Recovered 11-04-2024".

### R-02 Resolve as Written off: fail
- What the user sees: ⋮ > Resolve case > Written off > types the reason. "Resolve case" stays disabled. It only turns on after clicking Recovered and then Written off again (rec-resolve-03, rec-resolve-03b-reason-typed-still-disabled, rec-resolve-03c-after-retoggle).
- Why it hurts: the handler thinks the form is broken and cannot resolve the case, so the claim cannot close. Check "button that did nothing".
- Root cause: canConfirm() is a computed() in resolve-recovery-modal.component.ts:68-73 that reads form validity, which is not a signal, so typing never re-runs it. Recovered has the same problem with the amount field.
- Second issue: Written off is final (2899716834: closed allows no edits) and goes straight through, no confirm.
- Fix: read the note and amount through toSignal(valueChanges) like outcomeSig already does at line 58, and add the shared confirm step used by Reassign (src/app/shared/components/confirm-dialog/confirm-dialog.component.ts, called in reassign-claim-modal.component.ts:206-212).

### R-03 Create a recovery case: fail
- What the user sees: form with clear hints; Create case disabled until valid; then a new row REC-C-003 and the toast "Recovery case REC-C-003 created. Claim closure no longer waits on a recovery case being set up." (rec-create-01 to 03).
- Why it hurts: CLM-2024-003 already had cases, so closure was never waiting; the toast states an effect that did not happen. No confirm before the save, which the owner asks for on every save. Check "toast after" must be true.
- Fix: show the closure sentence only when the state moved from yes-pending to yes-active (recoveries.component.ts:243-246); otherwise "REC-C-003 is now in the list." Add the shared confirm dialog before saving, as in R-02.

### R-04 Cancel a half-filled Create: pass (with a note)
Cancel closes the window (rec-create-04-cancelled-dirty). Note: typed text is lost without asking; acceptable for a short form.

### R-05 Recovery expected, no case: pass (with a note)
Info line "Recovery is expected but no recovery case has been set up yet." plus postings (rec-empty-yespending-01).
Note: the next line repeats it ("No recovery case has been set up yet."). Keep one, and point to Create recovery case in the empty state's [action] slot (src/app/shared/components/empty-state/empty-state.component.html:13).

### R-06 Recovery question not answered: pass
Warning with "Answer on Claim Overview" (rec-unanswered-01).

### R-07 No recovery potential, postings only: pass (with a note)
Postings listed, same as Financial > Recovery bookings (rec-postings-01).
Note: REC-001 and REC-002 are "Reinsurance" from Munich Re and Swiss Re. Confluence lists Subrogation, Salvage and Deductible as recovery types (2748393772); reinsurance is not money from a third party. Check the mock data.

### R-08 Couldn't be booked, Send again: pass (with a note)
Expand REC-003: why it failed, "Send again to Global Genius", confirm "Send this recovery to Global Genius again? … won't be booked twice", row shows "Sent again, waiting", then "Booked". Financial > Recovery bookings shows the same status (rec-gg-01 to 05).
Note: no toast when it becomes Booked; a handler who left the page only learns it from the bell, if at all.

### R-09 Closed claim: fail
- What the user sees: "Create recovery case" is greyed out, no reason on hover, no message (rec-closed-01, rec-closed-02-hover-disabled).
- Why it hurts: Financial Overview explains the same situation with a blue message and tooltips. Check "same thing looks the same", "button that did nothing".
- Fix: copy the closed-claim nx-message (financial-overview.component.html:20) and the [nxTooltip] on the disabled button (financial-overview.component.html:127).

### R-10 Loading: fail
- What the user sees: plain text "Loading…" (rec-loading-01, recoveries.component.html:40). The two sibling pages show the NDBX spinner.
- Why it hurts: check "same thing looks the same".
- Fix: use the same nx-spinner block as financial-overview.component.html:26.

### Other notes
- The Recoveries screen in production is a separate micro-frontend with Open / Closed / Reopen and a required reason list (2899716834). The prototype's In progress / Recovered / Written off with free text does not match. Treat it as a design proposal, not a copy of production.
- Em dashes appear in user-facing copy on these pages (closed message, modal subtitles, empty cells). Plain commas or "None" read better.
