# Global Genius errors on the handler dashboard

Source: James's review call questions and the PO / BO answers (email, 2026-11-18), and a colleague's Figma design (claims portfolio triangle + popover, Claim Overview banner). Builds on the existing GG work (gg-1 to gg-8, BMPCC-22661, epic BMPCC-18348).

## Who
Claims handler, opening the dashboard first thing in the morning.
Knows their claims, not Global Genius. Does not know if GG is down.
Juggling tasks, calls, approvals. Wants to fix what is theirs and ignore the rest.

## Story
As a claims handler I want to see which of my claims have a GG problem, what broke, and get to the fix in one click, so that money gets booked without me chasing things that fix themselves.

## Base: the colleague's Figma design
The design replaces the first build's separate "Global Genius: needs your action" list (that widget is removed).
- Claims portfolio: a red triangle right after the Claim ID on a claim with a GG problem. Status chip "Failed".
- Click the triangle: a popover with a close X. Bold "Global Genius processing failed.", then "Claim couldn't be processed in Global Genius: [root cause].", "Retry to process it again." and a "Retry" link.
- Claim Overview: red banner at the top. Bold "Global Genius processing failed", then "Claim couldn't be processed in Global Genius: [root cause]. Retry to process it again." and a "Retry" link.

## The 4 agreed changes, and why
1. "Failed" only when the claim itself couldn't be set up in GG. If a payment, reserve, recovery or section failed, the claim is still Open; only the triangle shows. Why: the PO / BO answer was "status stays Open", and Failed on a claim that is fine would read as the whole claim being broken.
2. The popover action fits the cause. Claim set-up failed, or GG was unavailable and the automatic retries ran out: "Retry". Data the handler must fix (bank details, party, sub-type): no Retry, one line per broken item saying what broke, with "Fix payment" / "Fix reserve" / "Fix recovery" straight to it. Section not booked: "Retry on claim" to Claim Overview, where its Retry is. Finance-owned: "with Finance, nothing for you to do", no action. Why: a Retry on bad data fails again, and one claim can have two failures that need two different screens.
3. Claims with a GG problem sort to the top of the portfolio. Why: the widget shows 5 rows, so a problem on an older claim would be hidden. (A "Global Genius issues: N · Show only these" chip was tried and removed 2026-11-19 at the designer's request: sorting first is enough.)
4. While GG is down, no triangle on items that failed because GG was unavailable. The downtime banner stays and counts them. Why: red on every claim during downtime looks like many problems and is really zero actions.

## Journey
1. Opens the dashboard. Sees: claims with a GG problem at the top of Claims portfolio, each with a red triangle. Knows: which claims.
2. Hovers (or clicks) a triangle. Reads what broke, in plain words, and the one action that fits.
3. Retry, or Fix payment / reserve / recovery (lands on that item, open, with GG's reason), or Retry on claim.
4. After a fix: a toast, and the triangle is gone.
5. When GG is down: one banner, "nothing to do", a count of waiting items, no triangles for those.
6. Days before planned downtime: a heads-up banner with date and time.

## Needs
- Red means "you must act or know". Nothing else is red.
- The popover says what broke, per item, and where the action goes.
- One click to the exact fix screen.
- A clear "nothing to do" state while GG is down, and a warning before planned downtime.

## Scenarios (public/tickets/gg-9-dashboard.json)
- GGD-01 Claim not set up in GG: triangle, status Failed, popover with GG's root cause and Retry.
- GGD-02 Claim Overview banner: "Global Genius processing failed", root cause inline, Retry link.
- GGD-03 Bank details wrong: triangle, status Open, popover line with Fix payment, no Retry.
- GGD-04 Payment and reserve failed on one claim: two lines, two links.
- GGD-05 GG was unavailable, retries ran out: popover line with Retry (same confirm as the Reserves list).
- GGD-06 Section not booked: popover line with Retry on claim.
- GGD-07 Finance-owned only: lines "with Finance, nothing for you to do", no action.
- GGD-08 Problems past row 5: sorted first.
- GGD-09 GG down: banner counts 2 waiting items, no triangle on those claims, the data problem still has one.
- GGD-10 Planned downtime in 3 days: banner, no triangles.
- GGD-11 Nothing broken: no triangles, no banner.

## Open for the operational process (not design)
- Who announces planned downtime, and from where (admin screen or system feed)?
- How is unplanned downtime detected?
- During downtime, are payments queued (assumed) or blocked?
- Does the backend really resend automatically after downtime? The "nothing to do" message depends on it.

## Audit 2026-11-18 (second build, colleague design)

Walked in the browser (Playwright, dev server on port 4295) with each AC's own setup from `public/tickets/gg-9-dashboard.json`, as Mara Mustermann, My claims, last 30 days. Screenshots in /tmp/gg-dash2/. No console errors in any scenario.

- GGD-01 pass. CLM-2024-028 first row, triangle, Failed, chip "Global Genius issues: 1". Popover text as the design, with BKG-4102 inline. Retry: toast, the triangle goes, status Open.
- GGD-02 pass. Banner as the design. Retry: blue "Retrying", then green "now set up" after about 3 seconds.
- GGD-03 pass. CLM-2024-025 triangle, Open. Fix payment opens Payments with that payment open.
- GGD-04 pass. Two lines; Fix reserve opens Reserves with that reserve open.
- GGD-05 pass. CLM-2024-029 sorts first. Retry opens "Send this reserve to Global Genius again?"; Send again: toast, triangle gone.
- GGD-06 pass. Section line with BKG-5021; Retry on claim opens Claim Overview of CLM-2024-028.
- GGD-07 pass. Two Finance lines, no links. The close X closes the popover.
- GGD-08 pass. Rows 1 to 4 are 025, 028 (Failed), 029, 026. Show only these lists the 4; Show all goes back to the top 5.
- GGD-09 pass. Banner "2 items are waiting". No triangle on 025 / 026; 029 keeps its triangle.
- GGD-10 pass. Banner with the date in 3 days, 18:00 to 22:00. No triangles, no chip.
- GGD-11 pass. No triangles, no chip, no banner.

Not built:
- View all claims does not carry the GG filter: claims-list.component.ts is at 296 of 300 lines.
- "Failed" shows only in the dashboard portfolio, not on the Claims list or the Claim Overview status.
- A claim whose policy is missing in GG (policy-missing) gets no triangle: the policy team fixes it.
- While GG is down, a claim set-up failure still shows its triangle and Retry.
- On the claim itself, items waiting for GG still read "Couldn't be booked", not "Waiting for Global Genius" (from the first build).

## Changes 2026-11-19 (designer review before the team demo)
- Claims portfolio is the first widget on the dashboard.
- Triangle is solid (filled), and its popover opens on hover; it stays open while the mouse is on it so Retry / Fix links can be clicked.
- "Global Genius issues" chip removed.
- Q2 Financial Closure banner switched off so only the GG banner shows.
- Claim Overview: failed sections in ONE banner with one row per section and a Retry link, never one banner each.
