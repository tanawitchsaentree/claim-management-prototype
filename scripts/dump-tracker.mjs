#!/usr/bin/env node
// Pulls the whole tracker Supabase project down into tracker-data/ — one JSON
// per table, plus a readable NOTES.md digest of the note table.
//
// Why a hand-written table list instead of discovery: the PostgREST OpenAPI
// root (GET /rest/v1/) refuses a publishable key ("Only secret API keys can be
// used for this endpoint"), and we only have the publishable one. The list
// below is the schema in supabase/migrations/0001_tracker.sql — if a migration
// adds a table, add it here too.
//
// The manager's own rows are left out by default. The app hides them from
// everyone but her (src/app/core/services/tracker-visibility.ts), and a dump
// committed to the repo with her 6 tickets and their notes in it would make
// that hiding pointless — anyone can read the file. INCLUDE_OWNER=1 puts them
// back for a local-only dump; do not commit the result.
//
// Usage: node scripts/dump-tracker.mjs
//        SUPABASE_KEY=<other key> node scripts/dump-tracker.mjs
//        INCLUDE_OWNER=1 node scripts/dump-tracker.mjs

import { writeFileSync, mkdirSync } from 'node:fs';

const SB  = process.env.SUPABASE_URL ?? 'https://ryhnvtzlybdbqlwzcqrw.supabase.co';
// Publishable (anon) key — RLS on every table allows anon read/write, see
// supabase/migrations/0002_tracker_remove_auth_requirement.sql. Not a secret.
const KEY = process.env.SUPABASE_KEY ?? 'sb_publishable_liEqGoFw_RNdnmpdXQgg-w_UuTrHGP7';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const TABLES = {
  pi:           'name.asc',
  epic:         'jira_key.asc',
  ticket:       'jira_key.asc',
  ticket_state: 'updated_at.desc',
  note:         'created_at.asc',
  relation:     'created_at.asc',
  sync_log:     'started_at.desc',
};

const OUT = 'tracker-data';

// Kept in step with OWNER_ASSIGNEE_MATCH in
// src/app/core/services/tracker-visibility.ts — same substring, matched against
// the same free-text `assignee` field.
const OWNER_MATCH = 'isabelle';
const INCLUDE_OWNER = process.env.INCLUDE_OWNER === '1';

/** Paged fetch — PostgREST caps a plain select, so never trust one response. */
async function fetchAll(table, order) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${SB}/rest/v1/${table}?select=*&order=${order}`, {
      headers: { ...H, Range: `${from}-${from + 999}`, Prefer: 'count=exact' },
    });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    const total = Number((res.headers.get('content-range') ?? '').split('/')[1]);
    if (!page.length || page.length < 1000 || (!Number.isNaN(total) && rows.length >= total)) {
      return { rows, total: Number.isNaN(total) ? rows.length : total };
    }
  }
}

mkdirSync(OUT, { recursive: true });

// Fetch everything first, withhold second, write third. Withholding needs the
// full `ticket` table to know which ticket_ids belong to the owner, and doing it
// inside the fetch loop would silently depend on `ticket` being iterated before
// its dependent tables.
const data = {};
const counts = {};
for (const [table, order] of Object.entries(TABLES)) {
  const { rows, total } = await fetchAll(table, order);
  data[table] = rows;
  counts[table] = total;
}

// `complete` compares against PostgREST's own exact count, so a silent
// truncation shows up as a mismatch instead of a short file nobody notices.
// `withheld` is counted separately — a deliberately dropped row must never
// look like a failed fetch.
const withheld = {};
if (!INCLUDE_OWNER) {
  const ownerTicketIds = new Set(
    data.ticket.filter((t) => (t.assignee ?? '').toLowerCase().includes(OWNER_MATCH)).map((t) => t.id),
  );
  const drop = (table, keyOf) => {
    const before = data[table].length;
    data[table] = data[table].filter((row) => !ownerTicketIds.has(keyOf(row)));
    withheld[table] = before - data[table].length;
  };
  drop('ticket', (r) => r.id);
  drop('ticket_state', (r) => r.ticket_id);
  drop('note', (r) => r.ticket_id);
  drop('relation', (r) => r.ticket_id);
}

const summary = [];
for (const table of Object.keys(TABLES)) {
  const rows = data[table];
  const total = counts[table];
  const held = withheld[table] ?? 0;
  summary.push({
    table,
    rows: rows.length,
    reported_total: total,
    withheld_owner_rows: held,
    complete: rows.length + held === total,
  });
  writeFileSync(`${OUT}/${table}.json`, JSON.stringify(rows, null, 1) + '\n');
  const flag = rows.length + held === total ? '' : `  ⚠️ expected ${total}`;
  console.log(`${table.padEnd(13)} ${String(rows.length).padStart(4)} rows${held ? ` (${held} withheld)` : ''}${flag}`);
}
writeFileSync(`${OUT}/_dump-summary.json`, JSON.stringify(summary, null, 1) + '\n');
if (INCLUDE_OWNER) console.log('\n⚠️  INCLUDE_OWNER=1 — this dump contains the manager\'s rows. Do not commit it.');

// ── NOTES.md — the note table is the only place a lot of this project's
// reasoning is written down, and it is unreadable as raw JSON. ──────────────
const piName     = id => data.pi.find(p => p.id === id)?.name ?? '(no PI)';
const ticketById = new Map(data.ticket.map(t => [t.id, t]));
const stateById  = new Map(data.ticket_state.map(s => [s.ticket_id, s]));

const notesByTicket = new Map();
for (const n of data.note) {
  if (!notesByTicket.has(n.ticket_id)) notesByTicket.set(n.ticket_id, []);
  notesByTicket.get(n.ticket_id).push(n);
}

const md = [
  '# Tracker notes — full text',
  '',
  `${data.note.length} notes across ${notesByTicket.size} tickets, ${data.note.filter(n => n.archived).length} archived.`,
  'Generated by `node scripts/dump-tracker.mjs` — do not hand-edit; edit the row in Supabase and re-run.',
  '',
  'Almost every note is authored by `Claude`, i.e. by an agent session, **not** by product, a BA, or a developer.',
  'That matters when a note reads like a decision: check `created_by` before treating one as a statement from anyone else.',
  '',
];

if (!INCLUDE_OWNER && withheld.note) {
  md.push(
    `${withheld.note} note(s) on ${withheld.ticket} withheld ticket(s) are not in this file — see the manager-access rule in \`tracker-data/README.md\`.`,
    '',
  );
}

const groups = new Map();
for (const t of data.ticket) {
  if (!notesByTicket.has(t.id)) continue;
  const key = piName(t.pi_id);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(t);
}

for (const pi of [...groups.keys()].sort().reverse()) {
  md.push(`## ${pi}`, '');
  for (const t of groups.get(pi)) {
    const st = stateById.get(t.id) ?? {};
    const flags = [
      `D ${st.design_status ?? '?'}`, `B ${st.build_status ?? '?'}`, `H ${st.handoff_status ?? '?'}`,
      st.blocked_by && st.blocked_by !== 'none' ? `⛔ ${st.blocked_by}` : null,
    ].filter(Boolean).join(' · ');
    md.push(`### ${t.jira_key} — ${t.title.trim()}`, '', `${flags}${t.assignee ? ` · assignee: ${t.assignee}` : ''}`, '');
    if (st.blocked_note) md.push(`**blocked_note:** ${st.blocked_note}`, '');
    for (const n of notesByTicket.get(t.id)) {
      md.push(`- ${n.created_at.slice(0, 10)} · \`${n.created_by}\`${n.archived ? ' · _archived_' : ''} — ${n.body.replace(/\s*\n\s*/g, ' ')}`);
    }
    md.push('');
  }
}

writeFileSync(`${OUT}/NOTES.md`, md.join('\n') + '\n');
console.log(`\nwrote ${OUT}/NOTES.md (${data.note.length} notes)`);
