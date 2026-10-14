# Sections, entities and damages: every condition, FNOL to Edit claim

Investigated 2026-10-14. Three independent code reviews (FNOL steps, data layer, everything after FNOL) plus replays in a real browser.
**verified** = played in the running prototype. **per code** = read from the source, not played.
Companion docs: `SECTIONS_AND_EDIT_CLAIM.md` (coupling map), `SKELETON_CONVERSION_FLOWS.md` (conversion), `EDIT_CLAIM_EDIT_MODEL.md`.

---

## FIXED 2026-10-14 (P1 items 1, 2, 4, 5 and the cause-edit half of 3)

- **Section rule now:** a section exists when its damage type is chosen in Loss information AND at least one entity in that group is ticked. It holds only the ticked entities (`selected-section-groups.ts`, used by both the Summary preview and submit). Verified: POL-2024-001, Material damage, one entity ticked -> 1 section / 1 entity (was 5 / 14); Summary shows "Material damage".
- **Entities Next gate:** with no ticked entity in the chosen types, Next shows "Select an entity". Verified.
- **Add item** in the entity panel no longer saves twice.
- **Edit claim:** setting a cause on a claim with zero sections creates its first section (same rule as skeleton creation).
- Sections 1, 3, 4 and the case matrix below describe the behaviour **before** this fix (F1, F2, F4, F14, F15, F18 are now changed).

---

## 0. The headline: what the prototype really does

The design intent is a chain: **cause of loss -> coverage check -> entities per cause -> handler selects the entities hit -> one section per damage type**.
The prototype implements almost none of the chain:

| Link in the chain | Prototype reality |
|---|---|
| Cause of loss -> entities | **Not connected.** The entity list is a fixed file per policy number (3 policies). Cause is used only to fill a dropdown inside the entity side panel |
| Coverage check (Promised / Not promised) | Fixed value in the file. Does not gate anything |
| Handler selects entities (checkboxes) | **Ignored.** Nothing downstream reads the checkbox |
| Type of damage chosen in Loss information | Only hides groups on the Entities screen. **Ignored at submit** |
| One section per damage type | True, but built from **every entity in the cache**, ticked or not |
| Promise status -> Coverage review | **No code.** Seeds are hand-written |

**Verified replay (POL-2024-001):** Loss information = Fire + Material damage only. On the Entities screen only **1 entity** (Kaufmann's Warehouse) ticked, 7 shown, "Number of entities: 7". After Submit the claim has **5 sections / 14 entities**:
Material damage (7 entities), Business interruption (1), Financial loss (2), Bodily injury (2), Liability (2). Hidden groups, not-promised entities and unticked entities all became section entities. The Summary said "Types of damage: Not specified".

---

## 1. FNOL gating (policy path)

| Step | Required to press Next | Message / behaviour |
|---|---|---|
| Search | Policy selected ("Register a claim" disabled otherwise, tooltip "Select a policy to continue") | Does **not** reset previous FNOL state or caches |
| Loss information | Date and time of occurrence and notification (required); dates not in the future; notification date not before occurrence; **at least one cause**; **at least one type of damage**; every event block has at least one damage; "Specify other" required if Other Event; CBI answer required when the CBI question is shown; CBI case type when answer is Yes; supplier/customer name when case type ends `-named` | Banner "N issues need attention before continuing". Verified: empty type of damage keeps you on the page |
| Entities & Damages | **Nothing.** Next only marks the step done | No "select an entity" message exists |
| Parties | Nothing | |
| Reserves | A reserve total above 0 **or** an active narrative | Dialog "Reserve required" |
| Summary | `claimGroupCount > 0` (always 1 for real policies); recovery note when potential = No | "Submit claim" |

Other facts: all steps redirect to Search if there is no policy. The stepper is not clickable. No route guards between steps (a direct URL jump to Summary works, verified by use). A browser refresh wipes FNOL state and the entity cache. **Cancel does not clear anything** despite the message "Any information... will be lost". Submitting does not clear the cache either, so a second visit to Summary can submit a **second claim** from the same data.

## 2. Loss information, atom by atom

| Field | Rule |
|---|---|
| Cause of loss | Multi-select, 16 keys. Required (length check). Other Event shows "Specify other cause" (required, max 100) |
| Incident circumstance | Optional. Options = union of the circumstances of the selected causes; full list + "Unknown" if no cause, Other Event, or an unmapped cause |
| Type of damage | Multi-select, 7 keys. Required (length check). **No dependency on cause** |
| Events | One block per selected cause; each needs at least one damage. Not re-synced when Type of damage changes |
| Loss location | Optional, **one location only**. No location -> Entities screen shows an info banner and limits are shown per policy coverage instead of per location |
| CBI question | **Verified:** shown when Type of damage includes Business interruption and does **not** include Material damage. BI + Material hides it and clears the answer. The **cause** "Business interruption" has no CBI effect |
| CBI originating location | Required in the error list, **not** in the Next gate (per code), so Next works without it |
| Duplicate-claim check | Policy + date + cause, 1 second debounce, warns, never blocks |

## 3. Entities & Damages screen, atom by atom

**What loads:** `entities-damages.json`, keyed by policy. Only **POL-2024-001 (16 entities), POL-2024-006 (5), POL-2024-009 (4)** have data. Any other policy returns an empty tree. Each policy has a "Possibly promised" and a "Not promised" section, each holding damage groups.

| Behaviour | Rule |
|---|---|
| Group filter | If Type of damage is empty the whole tree shows. Otherwise only groups whose key is selected; selected types with no entities appear as an **empty group** ("No location selected"). The filter changes only the **view**; the data keeps every group |
| Statuses | promised / conditional / by-extension / not-promised. **Shown as a chip only.** None changes selectability |
| Checkbox | No disabled state anywhere. A parent with sub-items is checked when all sub-items are, indeterminate when some |
| Show selected only | Not found |
| Number of entities | Counts **all shown** entities, not selected ones |
| Add Entity | 6 types (building, vehicle, marine, employee group, financial, other). Needs at least 2 filters to search. New row: status "promised", possibly-promised section, limit "—", group by type: building/vehicle/marine/other -> Material damage, employee -> Bodily injury, financial -> Financial loss. **No route to Business interruption, Liability, Machinery breakdown, Product recall costs**; use Move to |
| Add other policy | Banner when sibling policies exist (001 -> 006, 009; 006 -> 009). Copies **all** of that policy's entities (original ids kept), `coveredBy` gets " · POL-…" |
| Move to | Section + group (all 7 types). Does not change the status chip; leaves empty groups. For seed entities the dialog preselects Material damage (no `damageTypeKey` on seeds) |
| Remove from list | The **only** action that keeps an entity out of the sections |
| Side panel / damage items | Fields: Damaged item (min 3 chars), Description, Caused by (required), Amount (required, >= 0). **Upload items is hard-disabled.** The items are never read by sections, summary or reserves |
| Storage | In-memory cache only; lost on refresh |

## 4. Submit: how sections are created (exact)

`createSectionsFromEntitiesDamages` runs only on the non-skeleton path:

1. Read the cache for the policy. Take every group that has at least one entity.
2. Group by the **group's** `damageTypeKey`; promised and not-promised entities of the same key merge into one list. Checkbox state, Type of damage and promise status are **not consulted**.
3. For each key, create one section: name `"<damage type label> — <first entity name>"` (CBI case-type label instead of the damage type label when CBI applies), status Open, all blocker flags false, each entity `Not assigned`, **no coverage review**.
4. CBI: only if the key is `business-interruption` **and** the answer is Yes: every entity in that group gets the CBI fields.
5. **Not passed to the section:** location, dates, entity id, limit, covered-by, status, damage items.

Same entity name in two groups gives two sections (intended). Zero entities in the cache: no sections, claim still created. Multi-claim demo policies (`POL-2024-MC*`): only the first claim gets sections.
Order: sections -> loss information record -> claim/overview -> financial reserves from the FNOL reserves. Failure midway leaves earlier sections behind; retry makes new ids.

The Summary preview is wrong for seed data: "Types of damage" comes from entity keys that seed rows lack (**verified: "Not specified"**), and "section count" is the **entity** count.

## 5. Every "damage" in the system

| Concept | Where | Meaning | Connected to |
|---|---|---|---|
| `typeOfDamage` | Loss information | Claim-level kinds of loss (7 keys) | Entities view filter, CBI rule, events checkboxes, stored. **Not** submit |
| Damage group (`damageTypeKey`) | Entities tree | Bucket of entities | Becomes the section's `damageType`; reserves rows |
| `ClaimSection.damageType` | Section | The raw key | Section naming, financial code (PD/BI), reserve matching |
| `DamageItem` | FNOL entity panel | An itemised damaged thing with amount | **Nothing.** Dies at submit |
| `DamagedItem` (sections) | Sections entity panel | Item with name, damage, caused by | Component-local seed for 3 entity ids; **not stored** |
| `DamagedItem` (reserve) | Reserves step | A reserve line | Hard-coded 3 names for every policy |
| `events[].damages` | Loss information | Which damages each cause brought about | Stored only |

Vocabulary mismatches: 7 lookup keys vs 6 labels in the damaged-item form (no Product recall costs) vs seed keys `cyber`, `business-int`, `cargo-damage`, `hull-damage` vs seed loss info `structural`, `contents`; "Financial Loss" (seed) vs "Financial loss" (lookup).

## 6. Other ways sections exist

| Route | Rule | Reachable now |
|---|---|---|
| Skeleton creation | Only if a cause was chosen. Damage type = Business interruption if the causes include it, else Material damage. One entity named after the first typed location. **Type of damage ignored** | Yes |
| Link policy fallback | Only if the claim has a cause and **no** section. Entity = claim city, else client name | Yes |
| Add Section modal | Damage type, entity multi-select (by entity-type mapping), dates, CBI | **No.** The button was removed (`e1f4323`) and nothing else opens it |
| Seed data | 15 hand-written sections; 3 regular claims (001, 011, 024) have any | n/a |

After FNOL a handler **cannot**: add a section or entity, change a damage type, rename an entity, move entities, delete a section, or keep damaged items. They **can**: rename a section, edit instruction status and CBI on an entity, set or override coverage review, delete an entity, close and reopen.

## 7. After the claim exists: every action

**Section row:** Edit (opens panel), Mark as reviewed (only when flagged and Open), Make payment, Instruct provider, Add note, View notes, Simulate final payment, Close section, Reopen section (only when Closed). All disabled when the claim is Closed; payment, provider, simulate, close also disabled when the section is Closed.
**Entity row:** View details, Edit (instruction status, CBI), Set/Override coverage review, Add note, Delete (blocked by any of the 7 section flags).
**Section panel:** rename (confirm; no activity logged; not propagated to Financial), read-only status, entity count, incident circumstance, closure/reopen details. **Entity panel:** read-only details; damaged items add/edit/delete are local and lost on navigation.

**Blocker flags:** only `hasOpenReserves` is ever set by code; the other six are always false, so only reserves can block a section close. Closing needs: no open deductible, litigation, subrogation/salvage, reserves, payments, provider. Entities, damaged items and the Review-needed flag are not checked.
**Claim closing:** all sections Closed (only then); converted skeletons also need a section and a reserve. Auto-close (simulate final payment) closes the claim when all sections are Closed and **skips every other claim blocker**.

### Edit claim details -> sections (exact)

| Field | Writes | Flags sections |
|---|---|---|
| Cause of loss | loss info, overview cause (first label + list), claim record keys | **Yes** |
| Specify other cause | loss info only | No |
| Incident circumstance | loss info, overview | No |
| Type of damage | loss info only (not overview, not claim) | **Yes** |
| Dates / times | loss info; overview + claim date for date of occurrence only | No |
| Loss description | loss info, overview, claim | No |
| Loss location | loss info, overview and claim location | **Yes** |

Flagging: **Open sections only**, all of them, regardless of relevance; a second Update **overwrites** the first flag's fields; closed sections are never flagged; a flagged section that is closed and reopened shows the old flag again. Nothing changes a section's name, damage type, entities or coverage review.

### Conversion (Link policy) and sections
Existing sections untouched; no flag; location reconfirm writes only loss information (not claim location, overview location, or entity names). A skeleton made in the wizard has no loss-info record, so there is nothing to reconfirm.

## 8. Case matrix

### FNOL (policy path)

| # | Scenario | Result | Evidence |
|---|---|---|---|
| F1 | Nothing ticked, Next | Allowed; sections identical to "everything ticked" | per code |
| F2 | One entity ticked (POL-001, Material damage) | **5 sections / 14 entities** | **verified** |
| F3 | Type of damage empty | Cannot leave Loss information | **verified** |
| F4 | Type selected with no entities (e.g. Machinery breakdown) | Empty group shown; no section for it; other groups still produce sections | per code |
| F5 | Policy with no entity data (e.g. POL-2024-004) | Empty groups; **no sections**; claim still created | per code |
| F6 | BI alone | CBI question shown and required | **verified** |
| F7 | BI + Material damage | CBI hidden; BI group becomes a plain section | **verified** (question), per code (section) |
| F8 | CBI Yes, no originating location | Next allowed; section lacks the location | per code |
| F9 | Cause = Business interruption, type = Material damage | No CBI, no BI section from the cause | per code |
| F10 | Same entity name in two groups | Two sections | per code |
| F11 | Add entity (building) | Joins Material damage; counted at submit even if the group is hidden | per code |
| F12 | Add sibling policy | All its entities join and become section entities | per code |
| F13 | Remove all entities | No sections | per code |
| F14 | Back, change Type of damage | View filter changes; sections still from the whole cache | per code |
| F15 | Move entity to an unselected group | Disappears from view; still becomes a section entity | per code |
| F16 | Refresh | State and cache lost; redirect to Search | per code |
| F17 | Submit twice (via Summary revisit) | Second claim, second set of sections | per code |
| F18 | Add damage item | **Saved twice** (2 rows -> 4 rows; same item duplicated) | **verified** |
| F19 | No parties added | Reserves step empty; "Reserve required" needs a narrative | per code |
| F20 | Policy mismatch with Reserves cache | Reserves built once, never rebuilt when entities or parties change | per code |

### After FNOL

| # | Scenario | Result | Evidence |
|---|---|---|---|
| A1 | Skeleton with cause fire | One Material damage section | **verified** (SK-2024-005) |
| A2 | Skeleton with no cause | No section; after linking the claim has a "no sections yet" blocker that **cannot be fixed** (no Add section) | **verified** (SK-2024-009) |
| A3 | Edit cause, Update | Flags Open sections; section content unchanged | **verified** |
| A4 | Edit type of damage | Flags sections; nothing else changes | **verified** |
| A5 | Edit then "Later" | Flag remains until Mark as reviewed | **verified** |
| A6 | Claim with zero Closed sections, Reopen | Reopen button disabled (cannot reopen) | per code |
| A7 | Delete the last entity | Empty section remains | per code |
| A8 | Add reserve to a Closed section | Allowed; flag flips on a closed section | per code |
| A9 | Claim closed, direct URL to Edit | Works; no guard | per code |

## 9. Defect register (ranked)

**P1: breaks the intended flow**
1. Sections are built from every entity, ignoring selection, Type of damage and promise status (verified). Section count and contents are wrong whenever a handler selects fewer entities than the policy lists.
2. "Add item" in the entity panel saves the item twice (verified).
3. No way to create a section after FNOL (button removed in `e1f4323`); skeletons without a cause, and every regular claim without sections, are stuck. A converted skeleton with no section has a closure blocker nobody can clear.
4. Entities screen has no "select at least one" rule; submit works with zero selection.

**P2: wrong data or misleading UI**
5. Summary: "Types of damage: Not specified" for seed policies (verified); section count = entity count; claim groups always 1.
6. Reopen claim is disabled when the claim has no Closed sections (e.g. CLM-2024-007, -018, -019, -027).
7. Reserves step: empty without parties; rows built once and never refreshed; damaged items are 3 hard-coded names.
8. CBI originating location not enforced although it is listed as required.
9. Edit claim: Type of damage reaches no other record; flags overwrite each other; flags ignore relevance; closed-then-reopened sections show stale flags.
10. FNOL Cancel and Submit do not clear state; a new FNOL starts with the old form and cache.
11. Seeds disagree with the rules: financial seed section ids `S1`/`S2` vs real `SEC-*` ids (reserves orphaned); CLM-2024-001's sections use entity names from another policy.

**P3: housekeeping**
12. `addEntity` not persisted (and unreachable). `updateDamageItem` never called. Entity chip `status` goes stale after Move. `documentsCount`, `selected`, `propertyId` have no readers. `EntityRow` component is dead code.
13. Rename does not update Financial; its dialog says it does. Rename and flagging write no activity.
14. Hard-coded actors differ by screen (Mara Mustermann, Leonie Fischer, Current User).
15. Auto-close of the claim skips all other claim blockers; the Sections page keeps `claimClosed=false` afterwards.
16. Label/vocabulary mismatches (section 5).

## 10. What decides "right" (questions for the team)

1. Should unticked entities ever become section entities? (We assume no.)
2. Is at least one selected entity required before Next? What does production say?
3. Should Type of damage restrict sections, or only the screen?
4. Where does a handler create a section after FNOL?
5. Should Edit claim re-run the entity and coverage step when cause changes?
6. Which entity data should a section keep (location, limit, covered-by, promise status)?
