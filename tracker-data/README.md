# tracker-data — full dump of the tracker Supabase project

Everything the Supabase tracker holds, as flat JSON, plus `NOTES.md` — a readable
render of the `note` table, which is where most of this project's reasoning is
actually written down and which is unreadable as raw JSON.

Refresh:

```bash
node scripts/dump-tracker.mjs
```

Overwrites every file here. Never hand-edit these files — edit the row in
Supabase and re-run, otherwise the next dump silently reverts you.

Project: `https://ryhnvtzlybdbqlwzcqrw.supabase.co`. The publishable (anon) key
is inlined in the script, not a secret: RLS on every table grants anon
read/write, see `supabase/migrations/0002_tracker_remove_auth_requirement.sql`.
Override with `SUPABASE_URL` / `SUPABASE_KEY` env vars.

## Tables — as of the 2026-09-02 dump

| File | Rows | What it is |
|---|---|---|
| `pi.json` | 2 | PI 2026.3, PI 2026.4. `start_date`/`end_date` are both null on both rows — never filled in. |
| `epic.json` | 12 | 9 in PI 2026.3, 3 in PI 2026.4. |
| `ticket.json` | 173 | 57 active, 116 archived. 169 tagged PI 2026.3, 4 tagged PI 2026.4. |
| `ticket_state.json` | 173 | One per ticket. Design / build / handoff status, blocker flag, `prototype_route`. |
| `note.json` | 196 | Free text against a ticket, 2026-08-20 → 2026-08-31, on 172 of the 173 tickets. |
| `relation.json` | 0 | Empty. Nothing has ever written a ticket-to-ticket relation. |
| `sync_log.json` | 7 | Every Jira sync run. All 7 `success`. |

`_dump-summary.json` carries a `complete` flag per table: the row count is
asserted against PostgREST's own `count=exact` header, so a truncated page shows
up as `complete: false` instead of as a short file nobody notices. All 7 were
`true` on this dump.

The column list in `dump-tracker.mjs` is hand-written from
`supabase/migrations/0001_tracker.sql` rather than discovered, because the
PostgREST OpenAPI root (`GET /rest/v1/`) rejects a publishable key — *"Only
secret API keys can be used for this endpoint"*. **If a migration adds a table,
add it to `TABLES` in the script too, or it will be missing here and nothing
will warn you.**

## Reading the data without being misled

**`ticket.jira_status` is live for 51 tickets, stale or absent for the rest.**
The `sync-jira` edge function runs a fixed JQL held as a server-side secret; it
cannot be overridden per request. 170 of 173 rows carry *some* status, but only
the ~51 inside that JQL scope were refreshed on 2026-09-02. A `Done` on a row
outside the scope is whatever it was when it was last in scope.

**`pi_id` is tagged by hand.** The sync never reads `fixVersion`, so PI 2026.4
holds only 4 rows here while Jira itself carries more under
`fixVersion = PI 2026.4 CM`. Absence from PI 2026.4 in this dump is not evidence
the work doesn't exist.

**Almost every note and status was written by an agent session, not by a human.**
`note.created_by`: `Claude` 187, `claude (real-repo doc audit 2026-08-31)` 6,
`claude-code` 2, `verify-script@test` 1. `ticket_state.updated_by`: `Claude` 170,
`claude-code` 1, `unknown` 2. So a note that reads like a product decision is
almost certainly a prior self-assessment. Check `created_by` / `updated_by`
before treating one as a statement from product, a BA, or a dev.

**A `blocked_by` flag is usually not a real blocker** — same reason. Of the 30
blocked active tickets, 28 carry `updated_by: Claude`. Those mean "nobody has
asked yet", not "product is withholding an answer". Two rows
(BMPCC-14352, BMPCC-14419, both `waiting_other_epic`, both `updated_by: unknown`)
are the only blockers not self-authored.

## Snapshot of the active 57

Build: 24 done · 6 in progress · 27 not started.
Design: 26 / 5 / 26. Handoff: 18 / 3 / 36.

Blocker flags: `none` 27 · `scope_unclear` 22 · `waiting_dev` 5 ·
`waiting_other_epic` 2 · `waiting_ba` 1. Every blocked row is in PI 2026.3.

`prototype_route` is set on 78 of 173 rows — those are the ones with a built
screen to point at. `TRACKER.md` at the repo root renders them as live gh-pages
links and marks any route that no longer exists in `app.routes.ts`.
