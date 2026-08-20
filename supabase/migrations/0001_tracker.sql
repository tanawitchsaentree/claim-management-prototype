-- Tracker Phase 1 schema.
-- Run this in the Supabase SQL editor (or `supabase db push`) — not executed
-- automatically by the app.
--
-- GUESSED: exact column sets for pi/epic/ticket/ticket_state/note/relation
-- were not specified up front. Kept minimal and reviewable — see CONVERSIONS
-- note in the chat reply for what to check before running.

create extension if not exists pgcrypto;

-- ── pi (Program Increment) ──────────────────────────────────────────────────
create table pi (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  start_date  date,
  end_date    date,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── epic ─────────────────────────────────────────────────────────────────
create table epic (
  id          uuid primary key default gen_random_uuid(),
  jira_key    text not null unique,
  title       text not null,
  pi_id       uuid references pi(id),
  jira_status text,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── ticket ───────────────────────────────────────────────────────────────
-- Metadata only (synced from Jira) — see ticket_state for OUR data.
create table ticket (
  id              uuid primary key default gen_random_uuid(),
  jira_key        text not null unique,
  title           text not null,
  epic_id         uuid references epic(id),
  pi_id           uuid references pi(id),
  jira_status     text,
  assignee        text,
  jira_url        text,
  confluence_url  text,
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── ticket_state ─────────────────────────────────────────────────────────
-- OUR data. The Jira sync (Edge Function) must never write to this table.
create table ticket_state (
  ticket_id       uuid primary key references ticket(id),
  design_status   text not null default 'not_started'
                    check (design_status in ('not_started', 'in_progress', 'done')),
  build_status    text not null default 'not_started'
                    check (build_status in ('not_started', 'in_progress', 'done')),
  handoff_status  text not null default 'not_started'
                    check (handoff_status in ('not_started', 'in_progress', 'done')),
  blocked_by      text not null default 'none'
                    check (blocked_by in (
                      'none', 'waiting_product', 'waiting_ba', 'waiting_dev',
                      'waiting_other_epic', 'scope_unclear'
                    )),
  blocked_note    text,
  blocked_since   timestamptz,
  updated_by      text,
  updated_at      timestamptz not null default now()
);

-- ── note ─────────────────────────────────────────────────────────────────
create table note (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references ticket(id),
  body        text not null,
  created_by  text not null,
  created_at  timestamptz not null default now(),
  archived    boolean not null default false
);

-- ── relation ─────────────────────────────────────────────────────────────
-- related_jira_key covers linking to a ticket not (yet) synced into `ticket`.
create table relation (
  id                 uuid primary key default gen_random_uuid(),
  ticket_id          uuid not null references ticket(id),
  related_ticket_id  uuid references ticket(id),
  related_jira_key   text,
  relation_type      text not null default 'relates_to',
  archived           boolean not null default false,
  created_at         timestamptz not null default now()
);

-- ── sync_log ─────────────────────────────────────────────────────────────
create table sync_log (
  id           uuid primary key default gen_random_uuid(),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  ticket_count integer,
  epic_count   integer,
  status       text not null default 'running'
                 check (status in ('running', 'success', 'error')),
  error        text,
  created_at   timestamptz not null default now()
);

-- ── triggers: updated_at auto-set ───────────────────────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger pi_set_updated_at
  before update on pi
  for each row execute function set_updated_at();

create trigger epic_set_updated_at
  before update on epic
  for each row execute function set_updated_at();

create trigger ticket_set_updated_at
  before update on ticket
  for each row execute function set_updated_at();

create trigger ticket_state_set_updated_at
  before update on ticket_state
  for each row execute function set_updated_at();

-- ── trigger: blocked_since auto-set/clear ───────────────────────────────
create or replace function set_blocked_since()
returns trigger as $$
begin
  if old.blocked_by = 'none' and new.blocked_by <> 'none' then
    new.blocked_since = now();
  elsif new.blocked_by = 'none' then
    new.blocked_since = null;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger ticket_state_set_blocked_since
  before update on ticket_state
  for each row execute function set_blocked_since();

-- ── trigger: auto-create ticket_state row for every new ticket ─────────
-- Keeps ticket_state always present (defaults: not_started / blocked_by
-- 'none') without the sync function ever writing to ticket_state itself.
create or replace function create_ticket_state()
returns trigger as $$
begin
  insert into ticket_state (ticket_id) values (new.id);
  return new;
end;
$$ language plpgsql;

create trigger ticket_create_state
  after insert on ticket
  for each row execute function create_ticket_state();

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Two known users (you + Isabelle), both authenticated via Supabase magic
-- link — no per-row ownership needed, just an authenticated gate.
-- No delete policy anywhere — use the `archived` boolean instead.
alter table pi           enable row level security;
alter table epic         enable row level security;
alter table ticket       enable row level security;
alter table ticket_state enable row level security;
alter table note         enable row level security;
alter table relation     enable row level security;
alter table sync_log     enable row level security;

create policy pi_select on pi for select to authenticated using (true);
create policy pi_insert on pi for insert to authenticated with check (true);
create policy pi_update on pi for update to authenticated using (true) with check (true);

create policy epic_select on epic for select to authenticated using (true);
create policy epic_insert on epic for insert to authenticated with check (true);
create policy epic_update on epic for update to authenticated using (true) with check (true);

create policy ticket_select on ticket for select to authenticated using (true);
create policy ticket_insert on ticket for insert to authenticated with check (true);
create policy ticket_update on ticket for update to authenticated using (true) with check (true);

create policy ticket_state_select on ticket_state for select to authenticated using (true);
create policy ticket_state_insert on ticket_state for insert to authenticated with check (true);
create policy ticket_state_update on ticket_state for update to authenticated using (true) with check (true);

create policy note_select on note for select to authenticated using (true);
create policy note_insert on note for insert to authenticated with check (true);
create policy note_update on note for update to authenticated using (true) with check (true);

create policy relation_select on relation for select to authenticated using (true);
create policy relation_insert on relation for insert to authenticated with check (true);
create policy relation_update on relation for update to authenticated using (true) with check (true);

create policy sync_log_select on sync_log for select to authenticated using (true);
create policy sync_log_insert on sync_log for insert to authenticated with check (true);
create policy sync_log_update on sync_log for update to authenticated using (true) with check (true);
