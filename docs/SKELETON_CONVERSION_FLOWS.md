# Skeleton claim: creation and "Link policy" flows

Written 2026-10-12 for team review. Every result marked **verified** was played in the running prototype on that date (browser, fresh session). Anything marked **per code** was read from the source and not played. Anything marked **not verified** is a guess and says so.

A **skeleton claim** (also called an orphan claim) is a claim registered before a policy is known. **Link policy** attaches a real policy to it so it becomes a normal claim. Only the "Link policy" tail has several different outcomes, so most of this document is about that.

---

## 1. Lifecycle

```
                        Register a skeleton claim (FNOL)
                                     |
                                     v
                          +--------------------+   Extend SLA (+3 days, stays here)
              +---------> |  awaiting-policy   | <-----------------------------+
              |           +--------------------+                               |
              | Reopen        |            |                                    |
              |               | Abandon    | Link policy                        |
       +------------+         v            v                                    |
       |  abandoned | <-------+      +-------------+                           |
       | (Closed)   |                |   linked    |  normal claim from here   |
       +------------+                +-------------+                           |
                                                                                
       matched: shown in the list as "superseded by claim X"; nothing in the app sets it (seed only)
```

| State | Where it comes from | What the handler can do |
|---|---|---|
| `awaiting-policy` | Created that way; Reopen puts it back | Link policy, Extend SLA, Abandon (the last two only from FNOL search) |
| `abandoned` | Abandon (reason required). Status becomes Closed. The Closed mapping is flagged in code as an assumption for Marlene to confirm | Reopen (FNOL search only) |
| `linked` | Link policy | Everything a normal claim allows. Closing is blocked until it has a section and a reserve |
| `matched` | Seed data only (SK-2024-002). No code path sets it | View linked claim |

The SLA (3 days) is display only: "5d (2d overdue)". Nothing expires or moves automatically.

---

## 2. How a skeleton is created (FNOL, 3 steps)

Steps: **Loss information**, **Parties**, **Summary**. Entry: the "Register a skeleton claim" button on FNOL search (needs a client name).

| Input | Required? | Note |
|---|---|---|
| Client name | Yes (2+ chars) | Locked if the handler came from a search result |
| Reason | Yes | Policy not yet issued, Policy not found in system, Multi-policy case (pending investigation), Other |
| Date and time of occurrence, date and time of notification | Yes | Not in the future; notification not before occurrence |
| At least one location | Yes (blocks Next) | Always typed or searched by address or coordinates. There is no policy yet, so nothing comes from Location Manager |
| Cause of loss, type of damage | **No** (an error message shows but does not block) | See flow L8 |
| Notifier (broker or insured), notes, description, parties | No | |
| CBI questions | **Not asked** on this path | See flow L7 |

What creation writes:

| Thing | Result |
|---|---|
| Claim | `SK-<timestamp>`, state `awaiting-policy`, status Open, 3-day SLA, no policy, `location` empty |
| Section | One section, **only if a cause of loss was chosen**. Type is Business interruption if the causes include it, otherwise Material damage. The entity is named after the first location. Type of damage is ignored |
| Loss-information record | **Not written.** The date, time and location typed in the wizard are not saved against the new claim (finding G1) |
| Reserves, tasks | None |

---

## 3. What "Link policy" does (the common part)

1. Handler opens **Link policy** from the claim overview (button) or from the FNOL search results (row menu).
2. The picker is the same search as FNOL "Client and policy search" (Client name, Policy number, Underwriting year, Search, Reset search, Show more for Broker and Line of Business), with **Clients** and **Policies** result tabs. Client name is **pre-filled with the skeleton's client** and the search runs when the picker opens. Choosing a row on the Clients tab narrows the Policies tab to that client. A policy row is selectable only if the loss date is inside the policy period (and, while the client name is left as typed, the client matches). Other rows are greyed with a reason such as "Loss date outside policy period".
3. Picking a row shows the **Link policy** confirm over the picker.
4. Confirm: the policy is attached, the state becomes `linked`, two things are created: a task "Set up reserves" (due in 3 days, high priority) and, only when the skeleton has a stored location, a task "Confirm loss location".
5. **Claim overview path only:** the **Confirm loss location** sheet opens straight away (no slide), listing the policy's active locations with the skeleton's location pinned on top. A **Line of business** column shows the skeleton claim's value on the pinned row and the policy's value on the others (bold when they differ). The handler picks one and confirms. The claim location is replaced and the "Confirm loss location" task is closed.
6. A toast confirms. The claim overview stays on screen. Nothing else guides the handler (the old "needs setup" banner was removed in `efd4fdb`).

Entry points: **A** = claim overview button (full flow above). **B** = FNOL search row menu (skips step 5, then opens the claim overview).

---

## 4. Flow catalogue

How many flows: **9 flows that depend on the data (L1 to L9)**, **2 that depend on what the handler does (L10, L11)**, and **3 that never reach "linked" (T1 to T3)**.

| ID | Flow | Play it with | Policy picker | Location sheet | After linking | Status |
|---|---|---|---|---|---|---|
| **L1** | Exact match, one policy location | **SK-2024-005** | 1 policy | "Exact match", pre-selected | Location replaced, location task closed. 1 section | Verified |
| **L2** | Near match, policy has several locations | **SK-2024-004** | 1 policy | "Differs: street" on the closest, pre-selected | Location replaced, task closed. 1 section (created now: see note) | Verified |
| **L3** | Several eligible policies, the first has locations | **SK-2024-001** (pick POL-2024-021) | 3 eligible | "Differs: street, postal code" pre-selected | Location replaced, task closed | Verified |
| **L4** | The chosen policy has **no locations** | **SK-2024-001** (pick POL-2024-022 or 023) | same as L3 | **Skipped** | Location stays as typed, task "Confirm loss location" stays open | Verified |
| **L5** | **No close match**: no policy location shares the city or postal code | **SK-2024-006** | 1 policy | Warning shown, **nothing pre-selected**, Confirm disabled until one is chosen | If cancelled: location stays typed, task stays open | Verified |
| **L6** | **No eligible policy**: the only policy expired before the loss date | **SK-2024-007** | 1 row, greyed "Loss date outside policy period" | Never reached | Dead end: only Cancel. See G5 | Verified |
| **L7** | **Business interruption** cause | **SK-2024-008** | 1 policy | Normal ("Differs: street") | Section is Business interruption. No CBI is asked at any point. See G4 | Verified |
| **L8** | **No cause of loss** at creation | **SK-2024-009** | 1 policy | Normal | **0 sections** after linking. Closing is blocked later ("no sections yet"). See G3 | Verified |
| **L9** | **Created in the FNOL wizard** (location was not saved) | **SK-2024-010** (seeded to look the same) | 1 policy | **Not shown**: the claim has no stored location | No location task, no location to confirm. Section exists. See G1 | Verified |
| **L10** | Handler **cancels** the location sheet | any of L1 to L3, L5, L7, L8 | n/a | Cancel | Linking still completes; "Confirm loss location" task stays open | Per code |
| **L11** | Entry **B**: FNOL search row menu | any awaiting skeleton, e.g. **SK-2024-005** | same picker | **Not shown** | Task stays open; toast says "sections, reserves and re-confirm the location" (no section task exists); goes to the claim overview | Verified |
| **T1** | `matched` | **SK-2024-002** | n/a | n/a | Only "View linked claim" (goes to CLM-2024-001) | Per code |
| **T2** | `abandoned` | **SK-2024-003** | n/a | n/a | Reopen (FNOL search) returns it to `awaiting-policy` | Per code |
| **T3** | Extend SLA | any awaiting skeleton, FNOL search | n/a | n/a | SLA +3 days, state unchanged | Per code |

Note on L2: SK-2024-004 has no section in the seed, so linking creates one (entity named after the city). SK-2024-001 and the new ones already have a section from creation.

### What each seed skeleton is set up as

| SK-ID | Client | Loss date | Cause | Typed location | Policy (locations) |
|---|---|---|---|---|---|
| SK-2024-001 | Jonas Kaufmann | 2024-05-04 | fire | Industriestraße 8, 80333 Munich | POL-2024-021 (2), -022 (0), -023 (0) |
| SK-2024-002 | Jonas Kaufmann | 2026-09-04 | none | none | matched to CLM-2024-001 |
| SK-2024-003 | Thomas Kaufmann | 2026-08-19 | none | none | abandoned |
| SK-2024-004 | Rieke Vogt | 2026-09-19 | storm | Speicherstraße 21, 20457 Hamburg | POL-2026-001 (Hamburg, Bremen) |
| SK-2024-005 | Mira Lenz | 2026-09-25 | fire | Marktplatz 1, 50667 Cologne | POL-2026-002 (same address) |
| SK-2024-006 | Bruno Albers | 2026-09-22 | water | Leopoldstraße 10, 80802 Munich | POL-2026-003 (Berlin, Dresden) |
| SK-2024-007 | Sven Brandt | 2026-09-27 | theft | Industrieweg 3, 90402 Nuremberg | POL-2026-004 (expired 2026-01-01) |
| SK-2024-008 | Ida Falk | 2026-09-21 | business interruption | Mainzer Landstraße 48, 60325 Frankfurt | POL-2026-005 (Mainzer Landstraße 50) |
| SK-2024-009 | Otto Weiss | 2026-09-23 | **none** | Königstraße 22, 70173 Stuttgart | POL-2026-006 (Königstraße 20) |
| SK-2024-010 | Lars Nord | 2026-09-24 | storm | claim has **no stored location** | POL-2026-007 (Georgstraße 8) |

Replay: the state of a play-through is kept in the browser tab. Press **Reset** in the yellow DEV bar, or open a new tab, to get the skeletons back.

---

## 5. Findings the team should look at

| # | Finding | Evidence | Why it matters |
|---|---|---|---|
| G1 | A skeleton made in the FNOL wizard does **not keep the location (or the times) typed there**. The claim has no location and no loss-information record | Code: creation writes none; play-through L9 | The location sheet and the "Confirm loss location" task never appear for a real wizard-made skeleton. The seeded SK-001 and SK-004 behave differently from a real one |
| G2 | Linking from the FNOL search row menu skips the location sheet and ends on the overview; its toast mentions "sections" although no section task is made; it has no error handling | L11 | Two entry points, two behaviours |
| G3 | Cause of loss is not enforced when creating a skeleton. Without it no section is made, and linking does not add one | L8 | A linked claim can have 0 sections and the handler is not told until closing |
| G4 | Business interruption: the section type follows the cause, but the CBI questions (supplier or customer, utility type, trigger location) are never asked on the skeleton path or at linking | L7, code | Same gap raised in the claim-conversion discussion |
| G5 | When no policy is eligible, the picker is a dead end. Abandon and Extend SLA exist only on FNOL search, not on the overview | L6 | Handler has no next step from the claim overview |
| G6 | `matched` is never set by the app, and Abandon maps to status Closed (marked in code as an assumption) | Code | Needs a product answer before these can be built out |
| G7 | After linking, nothing guides the handler. The section entity keeps the typed location's name even after the location is replaced by the policy's | Code | See open question Q1 |
| G8 | Cause of loss is never checked against the policy's coverage | Code | Planned as a silent check that flags a section for enhanced review |
| G9 | Parties added during skeleton creation are stored in one shared list, not against the new claim | Code (not traced further) | **Not verified**: may mean parties are lost |

---

## 6. Open questions for the team

1. **After linking, where should the handler land?** Proposed: update the section's entity name to the chosen location, then go to Edit claim details only if the cause is business interruption and CBI is missing, otherwise to the Reserves page with the add-reserve form open.
2. Should a skeleton be allowed to exist without a cause of loss (G3)?
3. Should Abandon and Extend SLA also be on the claim overview (G5)?
4. Which entry point is right for Link policy: both, or the overview only (G2)?
5. When no policy location matches (L5), should the handler be allowed to keep the typed location with an "enhanced review" flag?
6. What is `matched` for, and should the app ever set it (G6)?
