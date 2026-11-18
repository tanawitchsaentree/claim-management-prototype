# Global Genius errors on the handler dashboard

Source: James's review call questions and the PO / BO answers (email, 2026-11-18). Builds on the existing GG work (gg-1 to gg-8, BMPCC-22661, epic BMPCC-18348).

## Who
Claims handler, opening the dashboard first thing in the morning.
Knows their claims, not Global Genius. Does not know if GG is down.
Juggling tasks, calls, approvals. Wants to fix what is theirs and ignore the rest.

## Story
As a claims handler I want to see only the GG problems I have to fix, and get to the fix in one click, so that money gets booked without me chasing things that fix themselves.

## Journey
1. Opens the dashboard. Sees: one line in a list per broken item that needs them. Knows: what broke, on which claim. Feels: in control if the list is short and clear, alarmed if everything is red.
2. Reads a row. Sees: "Payment to Dirk Haas not booked: the bank details don't match". Knows what to fix before clicking.
3. Clicks the row action. Lands on the exact screen (the payment), with GG's message shown there. No stop on Claim Overview.
4. Fixes and sends again. Sees a toast. The row leaves the dashboard list.
5. When GG is down: sees one banner, "nothing to do", and a count of waiting items. No red rows for those.
6. Days before planned downtime: sees a heads-up banner with date and time.

## Pain points
- Red on every claim during downtime: looks like 50 problems, is really zero actions. Alarm fatigue, people stop trusting red.
- A red triangle with no words: the handler has to open the claim to learn what broke.
- Several failures on one claim: one claim row can't link to two different screens.
- Failures only Finance can fix showing as the handler's job.
- Pages inside a small widget: hard to scan, unlike the rest of the dashboard.

## Needs
- Red means "you must act". Nothing else is red.
- Each row says what broke, in plain words, and where the action goes.
- One click to the exact fix screen.
- A clear "nothing to do" state while GG is down, and a warning before planned downtime.

## Critique of the PO answers
1. Banner during downtime: agree. But do not also flag every waiting claim in red. Waiting items are counted in the banner only, and show as "Waiting for Global Genius" (not red) on the claim itself.
2. Pagination in the widget: not needed. Downtime items no longer go in the widget, so the list is short. Use the dashboard's own pattern: first 5 rows, then "Show N more" (recovery-potential-panel.ts).
3. Red triangle, claim status stays Open: agree. Add the reason text on the row, otherwise the triangle means nothing.
4. Deep link to the payment screen: agree. Make the list one row per broken item (not per claim), so every row links straight to its own fix. That also answers "what if one claim has two failures".
5. Claim not set up in GG: its row links to Claim Overview, where the retry already is.
6. Finance-owned failures: not in the handler's list (they can't fix them). The claim still shows "With Finance".
7. Planned downtime: agree with a banner a few days ahead, in the same spot and style as the financial closure banner. Three states: before, during, gone.

## Scenarios
- GGD-01 Two handler-fixable failures on two claims: two rows, each links to its fix.
- GGD-02 One claim, payment and reserve both failed: two rows, two links.
- GGD-03 Claim registration failed: row "Claim not set up in Global Genius", links to Claim Overview.
- GGD-04 More than 5 items: 5 rows, "Show N more".
- GGD-05 GG down (unplanned or during planned): banner "Global Genius is unavailable. N items are waiting and will be sent automatically when it's back. Nothing to do." No red rows for those items.
- GGD-06 Planned downtime in 3 days: banner with date and time, "payments and reserves you approve then will be sent afterwards".
- GGD-07 Finance-owned failure only: not in the list; empty state if nothing else.
- GGD-08 Nothing broken: empty state "Everything is booked in Global Genius."
- GGD-09 After fixing: toast, row gone on return to the dashboard.

## Open for the operational process (not design)
- Who announces planned downtime, and from where (admin screen or system feed)?
- How is unplanned downtime detected?
- During downtime, are payments queued (assumed) or blocked?
- Does the backend really resend automatically after downtime? The "nothing to do" message depends on it.

## Audit 2026-11-18

Walked in the browser (Playwright, dev server on port 4291) with each AC's own setup from `public/tickets/gg-9-dashboard.json`, and GGD-05 once more through the DEV banner (Apply, no reload). Screenshots in /tmp/gg-dash/. No console errors in any scenario.

- GGD-01 pass. Two rows on CLM-2024-001 and CLM-2024-003. Fix payment opens Payments with 123456-3 open and the reason shown; Fix reserve opens Reserves of CLM-2024-003 with the reserve open.
- GGD-02 pass. Two rows on CLM-2024-001, each link opens its own item.
- GGD-03 pass. Row "Claim not set up in Global Genius", Retry on claim opens Claim Overview with the claim banner and Retry.
- GGD-04 pass. Count 8, first 5 rows, "Show 3 more" shows all 8 (payments, reserves, recovery, section).
- GGD-05 pass. Banner "Global Genius is unavailable. 3 items are waiting ...". The 3 waiting items are not rows; the 1 handler item still is.
- GGD-06 pass. Banner with the date in 3 days, 18:00 to 22:00. List empty.
- GGD-07 pass. Finance-owned payment and an escalated reserve are not listed; empty state.
- GGD-08 pass. Empty state "Everything is booked in Global Genius."
- GGD-09 pass. Fix payment, tick, Send again: toasts "Sent again" then "Payment 123456-3 is now booked". Back on the dashboard the list is empty.

Not built (outside this build):
- Critique 1, second half: on the claim itself, waiting items should read "Waiting for Global Genius" (not red). The Payments / Reserves lists still say "Couldn't be booked" for items with cause gg-unavailable.
- Items with cause gg-unavailable are never rows, so after downtime ends a gg-unavailable item whose automatic retries ran out (gg-4 AC-03) is not on the dashboard. It depends on the open question "does the backend really resend automatically".
