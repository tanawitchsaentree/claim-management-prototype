-- Adds ticket_state.prototype_route (2026-08-20, "finish the ticket-to-
-- prototype link" request). Reported before running: this column did not
-- exist in the live schema (confirmed via information_schema.columns) —
-- the request assumed it did. Additive, nullable, no data loss risk, no
-- existing behavior affected.
--
-- Value is an in-app route (e.g. "/claims/CLM-2024-001/sections"), used by
-- the detail panel's "Open in prototype" button via routerLink — same
-- origin, no window.open needed.

alter table ticket_state add column prototype_route text;
