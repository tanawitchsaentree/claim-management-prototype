# Skeleton claim: creation and "Link policy" flows

Written 2026-10-12 for team review; sections 2, 3 and 5 updated 2026-10-21 after Link policy was extended (BMPCC-19113). The flow table in section 4 keeps its 2026-10-12 results; where the new sheet changes an outcome, the Notes below say so. Every result marked **verified** was played in the running prototype on that date (browser, fresh session). Anything marked **per code** was read from the source and not played. Anything marked **not verified** is a guess and says so.

> **Claim numbers.** Only the number *shown* changes at conversion. The internal key (`claimId`, e.g. `SK-2024-005`) never changes, so sections, tasks, reserves and links keep pointing at it; the URL still carries the internal key, and a URL with the new or old number redirects to it. The number format `CLM-<year>-<seq>` is an assumption to confirm with the team. Reset in the DEV bar puts the claim back to its SK- number.

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
| Loss-information record | Written since 2026-10-21: dates, location, cause and description typed in the wizard are saved against the new claim, and the claim's `location` is set (finding G1, fixed) |
| Parties | The parties typed in step 2 are attached to the new claim (finding G9, fixed) |
| Reserves, tasks | None |

---

## 3. What "Link policy" does (the common part)

Link policy is one bottom sheet with four steps and a progress tracker on the left (Policy, Claim details, Coverages, Reserves). Going Back keeps what was typed and ticked; Back to policies resets.

1. Handler opens **Link policy** from the claim overview (button) or from the FNOL search results (row menu). Both entry points run the same sheet.
2. **Step 1, Policy.** The same search as FNOL "Client and policy search" (Client name, Policy number, Underwriting year, Show more), with **Clients** and **Policies** result tabs. Client name is pre-filled with the skeleton's client and the search runs on open. A policy row is selectable only if the loss date is inside the policy period (and, while the client name is left as typed, the client matches). Picking a row goes straight to step 2.
3. **Step 2, Claim details** ("Complete the claim"). What a skeleton never captured:
   - **Loss description**, required, pre-filled from the skeleton.
   - **Cause of loss**: kept if the cause lookup knows it ("storm" and "wind-storm" are read as Natural Event). A skeleton with no cause, or with one the lookup does not know, gets **Other Event**, with a one-line note saying which of the two it was. Conversion goes ahead either way.
   - **CBI questions** (the same block as FNOL's Loss information step) when the cause includes Business Interruption. Required fields carry a *.
   - **Location of loss**: the skeleton's typed location is shown as a manual location with **Keep this location** (default) / **Change location**. Only Change opens the Add location sheet for the chosen policy (compare mode, closest policy location first). After a change the choices become **Change again** / **Use the skeleton location**. A skeleton with no location offers an optional **Add location**. Nothing opens by itself, and no "Confirm loss location" task is created any more.
4. **Step 3, Coverages.** The FNOL Entities & Damages table in ticking-only mode (no row menus, no Documents column). At least one coverage must be ticked; each ticked damage type becomes a section holding the ticked entities (CBI answers are tagged on the business interruption section). If the policy lists no entities, one section is built from the cause instead, so a converted claim never has 0 sections. The placeholder section a skeleton got from its cause at creation is replaced.
5. **Step 4, Reserves (optional).** One row per section about to be made: reserve type, sub-type (no default, required once an amount is entered) and an amount in the policy's currency. Leaving amounts empty keeps the "Set up reserves" task.
6. **Link policy** opens the confirm; on confirm the policy is attached, the state becomes `linked`, the claim gets a regular number (`CLM-<year>-<seq>`, the SK- number kept as an alias), and:
   - a **loss event** (`EVT-0nn`) is created and the claim attached to it (shown on the overview, opens its own page);
   - the **insured** (the client) and the **broker** from the policy join the claim's parties (kept across reloads; Make Payment's payee list reads them). No underwriter exists in the policy data, so none is added;
   - sections and reserves are created as chosen; a "Set up reserves" task (due in 3 days, high) only if some section has no reserve;
   - the activity log gets the claim number, policy, and (if changed) cause and description rows.
7. A toast says what happened: "Policy POL-2026-005 linked, 2 sections on the claim. Reserves are set."

Entry points: **A** = claim overview button, **B** = FNOL search row menu. Both now use the same steps, so G2 below is fixed.

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
| G1 | **Fixed 2026-10-21.** A skeleton made in the FNOL wizard did **not keep the location (or the times) typed there**. The claim has no location and no loss-information record | Code: creation writes none; play-through L9 | The location sheet and the "Confirm loss location" task never appear for a real wizard-made skeleton. The seeded SK-001 and SK-004 behave differently from a real one |
| G2 | **Fixed 2026-10-21 (same steps on both entry points).** Linking from the FNOL search row menu skipped the location sheet and ends on the overview; its toast mentions "sections" although no section task is made; it has no error handling | L11 | Two entry points, two behaviours |
| G3 | **Fixed at conversion 2026-10-21 (cause defaults to Other Event; a section always exists).** Cause of loss is not enforced when creating a skeleton. Without it no section is made, and linking does not add one | L8 | A linked claim can have 0 sections and the handler is not told until closing |
| G4 | **Fixed 2026-10-21 (CBI asked in step 2).** Business interruption: the section type follows the cause, but the CBI questions (supplier or customer, utility type, trigger location) are never asked on the skeleton path or at linking | L7, code | Same gap raised in the claim-conversion discussion |
| G5 | When no policy is eligible, the picker is a dead end. Abandon and Extend SLA exist only on FNOL search, not on the overview | L6 | Handler has no next step from the claim overview |
| G6 | `matched` is never set by the app, and Abandon maps to status Closed (marked in code as an assumption) | Code | Needs a product answer before these can be built out |
| G7 | **Fixed 2026-10-21 (sections come from the ticked coverages and replace the placeholder).** After linking, nothing guides the handler. The section entity keeps the typed location's name even after the location is replaced by the policy's | Code | See open question Q1 |
| G8 | Cause of loss is never checked against the policy's coverage | Code | Planned as a silent check that flags a section for enhanced review |
| G9 | **Fixed 2026-10-21.** Parties added during skeleton creation were stored in one shared list, not against the new claim | Code (not traced further) | **Not verified**: may mean parties are lost |

---

## 6. Open questions for the team

1. **After linking, where should the handler land?** Proposed: update the section's entity name to the chosen location, then go to Edit claim details only if the cause is business interruption and CBI is missing, otherwise to the Reserves page with the add-reserve form open.
2. Should a skeleton be allowed to exist without a cause of loss (G3)?
3. Should Abandon and Extend SLA also be on the claim overview (G5)?
4. Which entry point is right for Link policy: both, or the overview only (G2)?
5. When no policy location matches (L5), should the handler be allowed to keep the typed location with an "enhanced review" flag?
6. What is `matched` for, and should the app ever set it (G6)?

---

## 7. Added 2026-10-21 (BMPCC-19113)

- The "Awaiting policy" chip: the **All claims** list shows it beside Open on skeleton claims, and its Status filter has an **Awaiting policy** entry. The FNOL search Claims tab deliberately does **not** (BMPCC-17927 functional review, item 4, 2026-09-22: only Open/Closed there). To be confirmed with the team.
- Open question: Circumstance (AGCS) is not asked at conversion (team: still open). The overview shows "Incident circumstance –" for a skeleton.
- Open question: Property ID. The manual Add location form has no such field.
- Open question: Underwriter. No underwriter exists in the policy data, so none is added to the claim's parties.
- DEV banner ticket BMPCC-19113 has one case per scenario (storm, business interruption, no cause, no location, no nearby policy location, full conversion, list chip).
