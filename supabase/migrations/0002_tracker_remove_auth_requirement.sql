-- Removes the sign-in requirement (2026-08-20, explicit request).
--
-- Was: RLS policies scoped `to authenticated` + trackerGuard redirecting to
-- /tracker/login when no Supabase session existed.
-- Now: policies scoped `to anon, authenticated` — table/detail-panel work
-- with no session at all. trackerGuard no longer checks for a session
-- (see core/guards/tracker.guard.ts).
--
-- Consequence: updated_by/created_by can no longer be trusted as a real
-- audit trail — anyone hitting the anon key can write, and the app falls
-- back to 'unknown' for the editor identity since there's no signed-in user.
-- No delete policy anywhere — that part is unchanged.
--
-- Postgres has no `ALTER POLICY ... TO`, so each policy is dropped and
-- recreated with the wider role list; `using`/`with check` clauses are
-- unchanged (still `true` for every one).

drop policy pi_select on pi;
drop policy pi_insert on pi;
drop policy pi_update on pi;
create policy pi_select on pi for select to anon, authenticated using (true);
create policy pi_insert on pi for insert to anon, authenticated with check (true);
create policy pi_update on pi for update to anon, authenticated using (true) with check (true);

drop policy epic_select on epic;
drop policy epic_insert on epic;
drop policy epic_update on epic;
create policy epic_select on epic for select to anon, authenticated using (true);
create policy epic_insert on epic for insert to anon, authenticated with check (true);
create policy epic_update on epic for update to anon, authenticated using (true) with check (true);

drop policy ticket_select on ticket;
drop policy ticket_insert on ticket;
drop policy ticket_update on ticket;
create policy ticket_select on ticket for select to anon, authenticated using (true);
create policy ticket_insert on ticket for insert to anon, authenticated with check (true);
create policy ticket_update on ticket for update to anon, authenticated using (true) with check (true);

drop policy ticket_state_select on ticket_state;
drop policy ticket_state_insert on ticket_state;
drop policy ticket_state_update on ticket_state;
create policy ticket_state_select on ticket_state for select to anon, authenticated using (true);
create policy ticket_state_insert on ticket_state for insert to anon, authenticated with check (true);
create policy ticket_state_update on ticket_state for update to anon, authenticated using (true) with check (true);

drop policy note_select on note;
drop policy note_insert on note;
drop policy note_update on note;
create policy note_select on note for select to anon, authenticated using (true);
create policy note_insert on note for insert to anon, authenticated with check (true);
create policy note_update on note for update to anon, authenticated using (true) with check (true);

drop policy relation_select on relation;
drop policy relation_insert on relation;
drop policy relation_update on relation;
create policy relation_select on relation for select to anon, authenticated using (true);
create policy relation_insert on relation for insert to anon, authenticated with check (true);
create policy relation_update on relation for update to anon, authenticated using (true) with check (true);

drop policy sync_log_select on sync_log;
drop policy sync_log_insert on sync_log;
drop policy sync_log_update on sync_log;
create policy sync_log_select on sync_log for select to anon, authenticated using (true);
create policy sync_log_insert on sync_log for insert to anon, authenticated with check (true);
create policy sync_log_update on sync_log for update to anon, authenticated using (true) with check (true);
