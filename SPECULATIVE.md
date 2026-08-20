# speculative/unstarted-tickets

Branch exists only to preserve work that was found sitting uncommitted in
`main`'s working tree during the 2026-08-20 audit, traced to Jira tickets
that were **To Do** and mostly **unassigned** at the time — i.e. nobody had
actually started this work, and no user handed it over in conversation
either. Per `CLAUDE.md` RULE -2, none of this belongs on `main` until a real
ticket starts or the user asks for it directly. Nothing here was deleted —
pick a commit up with `git cherry-pick <sha>` once that changes.

Each cluster is its own commit so it can be cherry-picked independently.

| Cluster | Commit | Ticket(s) | Status / Assignee (verified live) | Why shelved |
|---|---|---|---|---|
| Sections "Circumstance" field | `6de7141` | BMPCC-18159 `[FE]`, BMPCC-18160 `[FIGMA]`, BMPCC-18157 `[BE]` | All **To Do**, Unassigned | Nobody started any of the 3 tickets. Also only half-built: the ticket describes a field in FNOL *and* a read-only display on Section Overview — only the Section Overview half exists, and it was built editable, not read-only. |
| Approvals — notes on Approval Journey | `6973e28` | BMPCC-14908 `[UI/UX][Figma]` | **To Do**, Unassigned | Not started. |
| Recovery Potential closure-blocker AC3 | `5856d8d` | BMPCC-17779 | **To Do**, assigned to Ruby Isabelle Costigan | Assigned ≠ started — ticket is still To Do. Note: a *different*, already-committed piece of work on `main` (`public/tickets/bmpcc-17779.json`, a prototype tour) also references this ticket ID — that one only documents the already-shipped Yes/No+note flow per an explicit user instruction to bridge tracker tickets to prototype screens; it added no new logic. This commit is the one that actually implements new, unrequested behavior (a closure blocker) off the same ticket's description. |
| AOMS/TMR stub tabs on claim right-strip | `294ef23` | BMPCC-14352, BMPCC-14419 `[UI/UX Proposal]` | Both **To Do** (14352 assigned, 14419 unassigned) | Both tickets literally ask *"where should this integration go"* — an open design question with no resolution. This code already guessed an answer and built it. |
| Notes attachments | `f8fa57c` | BMPCC-14967 | **To Do**, assigned to Ann Jeenwechasat | Not started. Reuses infra built for a different, already-shipped ticket (BMPCC-14453, Provider Communication) on an unrequested surface. |
| Financial Overview: Make Payment modal + Recovery Bookings | `bc8adf0` | — none — | n/a | No ticket asks for this at all. **Also contradicts commit `bc6be9d`** on `main`, which deliberately deleted `MakePaymentModalComponent` and moved "Make payment" to page navigation. Resolve that conflict before reviving this — don't just cherry-pick it back in. |

## If you're picking one of these up

1. Confirm the ticket has actually started (status ≠ To Do) or the user has asked for it directly — that's the whole point of shelving these here instead of on `main`.
2. `git cherry-pick <sha>` onto a feature branch off current `main`.
3. For the Financial Overview cluster specifically: read `bc6be9d`'s commit message on `main` first. It's a real decision, not an oversight.
4. Re-run `npm run build`, `npm run pre-commit`, `npm run audit:ac-logic` — these commits haven't been checked against `main`'s current state since being moved here.
