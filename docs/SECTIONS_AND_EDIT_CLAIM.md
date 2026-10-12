# Sections and Edit claim details: how they connect today

Prepared 2026-10-12 as the basis for a design deep-dive. Evidence labels:
**verified** = played in the running prototype that day, **per code** = read from the source, not played.

---

## 1. The one-page answer

**Edit claim details and Sections are almost not connected.** Two things link them:

1. After saving a change to Cause of loss, Type of damage or Loss location, Edit offers to take the handler to Sections and shows a warning banner there.
2. The claim's *Incident circumstance*, which Edit writes and the Sections detail panel shows read-only.

Everything else is a separate copy of the facts. **Changing the cause, type of damage or location never changes, renames, retypes, opens or closes a section.** The banner is the only consequence, and it disappears the moment the handler leaves the page.

A section is built **once** (at FNOL submit, skeleton creation, or conversion) and its name, damage type and entity names are frozen strings from that moment.

---

## 2. What a section is

| Part | Holds | Notes |
|---|---|---|
| **Section** (`ClaimSection`) | name, `damageType`, status Open/Closed, closure and reopen details, 7 blocker flags | Name is `"<damage type label> — <first entity name>"` (or the CBI case-type label instead of the damage type). Frozen at creation. Only manual rename can change it |
| **Entity** (`SectionEntity`) | name, instruction status, coverage review (Standard / Additional information required / Enhanced review required), provider, dates, CBI fields | The entity name is the property or asset (a location name). There is no location field other than the CBI originating location |
| **Damaged items** | item, caused by, description, damage | **Not stored.** Component-local mock data for three seeded entity ids. Added items vanish on reload |

Damage types: Material damage, Business interruption, Machinery breakdown, Bodily injury, Financial loss, Liability, Product recall costs.

A section has **no** cause of loss, location or circumstance of its own.

### How sections get created (all of them)

| Path | When | Rule |
|---|---|---|
| FNOL submit | Normal claim | One section per damage type that has entities, all those entities inside it. Name from the first entity. CBI details added if the claim is BI with CBI = yes |
| Skeleton creation | Only if a cause of loss was chosen | One section. BI if the causes include business interruption, otherwise Material damage. Entity = first typed location's name |
| Link policy (fallback) | Only if the claim has a cause but no section yet | Same rule, entity = the claim's city, or the client name |
| Add Section on the Sections page | **No longer reachable** | The header button was removed in `e1f4323`. The code and the modal still exist but nothing opens them |

Result: after FNOL there is **no way in the UI to create a section**.

### What a handler can do on the Sections page

- Section: rename, close (3-step modal), reopen (with a reason), make payment, instruct provider, add or view notes.
- Entity: edit (instruction status, CBI), set or override coverage review (reason required), delete (blocked while the section has open reserves, payments, etc.), add note.
- Cannot do: change the damage type, change the cause or location, add an entity or section.

### Closing

Closing a section needs six clear checks (deductible, litigation, subrogation or salvage, reserves, payments, provider). Only `hasOpenReserves` is ever set by code (when a reserve is added or changed); the other six flags are false in all seed data and never change, so in the prototype only reserves can block.

Claim closing needs every section closed and at least one section and one reserve for a converted skeleton. Closing the last section can auto-close the claim.

---

## 3. What Edit claim details does when Update is pressed

Confirm first ("Keep editing" / "Update") then saves to the loss-information record, adds one activity row per changed field, patches the claim overview, shows a "Claim details updated" toast, and **only for Cause of loss / Type of damages / Loss location** asks "Review sections?" (see the new flow, commit `3aa29b2`).

Fields Edit cannot change: CBI questions, events, parties. Edit has **no CBI controls**.

---

## 4. Coupling map: where each fact lives and what Edit updates

| Fact | Copies | Updated by Edit | Not updated |
|---|---|---|---|
| **Cause of loss** | Loss information (keys); claim overview (labels: headline + full list); claim record (keys); section damage type (indirect) | Loss information, overview headline and list | Claim record (still read by the duplicate check, policy overview, conversion); sections |
| **Specify other cause** | Loss information only | Loss information | Nothing else holds it. Overview shows just "Other Event" |
| **Incident circumstance** | Loss information; overview (key) | Both | n/a. Sections reads the overview copy, read-only |
| **Type of damage** | Loss information (keys); section damage type | Loss information only | Overview has no such field; **sections** |
| **Dates and times** | Loss information; overview date of loss; claim record loss date; entity date of occurrence | Loss information; overview date of loss (occurrence date only) | Claim record loss date (duplicate check and search still use the old date); entity dates; overview "date reported"; times |
| **Loss description** | Loss information; overview; claim record | Loss information, overview | Claim record |
| **Loss location** | Loss information; overview location; claim record location; entity names (indirect); CBI originating location (separate) | Loss information only | Overview location, claim record location, **entity names** |
| **CBI** | Loss information (case type, third party, industry, location); section entity copies built once at FNOL | Nothing (no controls) | Section copies are edited only on the Sections page and never sync back |

### Sections to Edit (the reverse direction)

Nothing on the Sections page writes to loss information or the overview. Closing, reopening, renaming, CBI edits and coverage review stay inside the section data. The only shared piece is circumstance, which Edit writes and Sections reads.

---

## 5. Mismatches a handler can reach today

| # | Steps | What is now inconsistent | Evidence |
|---|---|---|---|
| S1 | Edit **Cause of loss**, Update, "Stay on this page" | Overview shows the new cause. The section keeps its old name and damage type. **No marker remains anywhere** that the sections need a look | **Verified.** Cause changed, section rows identical, no banner after Stay |
| S2 | Edit cause to **Business interruption** | No BI section, no CBI captured, and Edit cannot capture CBI | Per code |
| S3 | Edit cause **away from** BI on a claim with a CBI section | Section keeps damage type BI, CBI fields and CBI-labelled name | Per code |
| S4 | Edit **Type of damage**, Update, Review sections | Banner lists the change; section damage type unchanged; the overview has no type-of-damage field, so the new value lives only in loss information | **Verified.** The code comment claiming it "maps directly" to the section damage type is wrong: nothing applies it |
| S5 | Edit **Loss location** | Loss information updated; overview location, claim location and entity names stay old. Editing only the 2nd+ location or any attribute other than the first location's display name produces **no change at all** | Per code |
| S6 | Edit **Date of occurrence** | Overview date updates; the claim record date does not, so duplicate check and claim search use the old date. Entity dates unchanged | Per code |
| S7 | Edit "Other" cause text | Only loss information holds it. The closure modal's "other" check compares against `'other'` but the label is `'Other Event'`, so it likely never fires | Per code (not played) |
| S8 | Edit **Description** | Claim record keeps the old text | Per code |
| S9 | Any cause or date edit, then a new FNOL | Duplicate check compares against the **old** cause and date | Per code |
| S10 | Skip or dismiss the review | No task, flag or activity is left for the unreviewed sections | **Verified** (banner count 0 after Stay) |
| S11 | Open Edit on a claim created through FNOL | Location is saved in a different shape than Edit reads, so "Loss location" likely shows "Not provided" | Per code (not played) |
| S12 | Link policy then confirm a location | Loss information gets the policy location. Overview location and entity names keep their pre-reconfirm values | Per code |
| S13 | Open Edit on a claim with no loss-information record | A record is synthesised with empty type of damage and a mostly empty cause, while sections already exist with a damage type | Per code |
| S14 | Seed claim **CLM-2024-001** | Overview cause was "Water damage" while loss information said "Fire", so seed data disagree before anyone edits | **Verified** |
| S15 | After the review banner | Banner told the handler to "use Add Section". That button no longer exists. Text fixed in `0c679d8`, but the handler **still cannot create the replacement section** | **Verified** (old text), fixed |

---

## 6. Decisions for the deep-dive

Each with what the code supports and a recommendation.

1. **Should editing cause, type of damage or location change sections?**
   Options: (a) never, only warn (today); (b) warn and persist a "needs review" marker on the affected sections; (c) auto-change. Recommendation: **(b)**. The handler decides, but the warning must not vanish. Section-level "Review needed" chip until a handler marks it reviewed.
2. **Which section is affected by which edit?** Today none is named. Type of damage maps to a section damage type directly; cause and location do not map at all. Needs a rule, e.g. type-of-damage change flags sections of the changed type, location change flags sections whose entity name matches the old location.
3. **How does a handler create the section a new cause needs?** There is currently no way after FNOL. Restore an entry point (Add section) or create it from Edit, or hand the handler off to the Sections page with the form pre-filled from the changed value.
4. **Where is CBI edited?** Only in the Sections entity edit today; Edit claim details has none. A BI cause needs a CBI answer at the same time.
5. **Which copy is the truth?** Loss information, overview and claim record each hold a version. Propose one record read by all screens, or one sync function that writes every copy, instead of the current partial list.
6. **Section name freeze.** The name embeds the first entity at creation. When the location changes, should the name follow? Today only manual rename does that.
7. **Persisting what the handler skipped.** "Stay on this page" should not mean "forget". Same marker as decision 1.

Cheap, unambiguous fixes available now: the claim-record copies (S6, S8, cause), the location sync (S5, S12), and the 2nd+ location diff (S5).
