// Who is allowed to see whose tracker rows.
//
// READ THIS BEFORE TRUSTING IT: this is a *visibility* rule, not a security
// boundary. The Supabase publishable key ships inside the deployed bundle and
// RLS on `ticket` is `to anon, authenticated using (true)`, so anyone can curl
// the table and read every row regardless of what this file says. Making it a
// real boundary means an RLS policy plus a Supabase Auth account for the owner
// — which re-imposes sign-in on the whole team (removed on request 2026-08-20,
// see core/guards/tracker.guard.ts). Deliberately not done; the ask was to keep
// the manager's rows off other people's screens in the prototype.
//
// Everything is keyed off a substring of `ticket.assignee` rather than a user
// id because the tracker has no user table — assignee is a free-text name
// copied from Jira ("Costigan, Ruby Isabelle (Allianz Services GmbH)").

/** Substring matched case-insensitively against `ticket.assignee`. */
export const OWNER_ASSIGNEE_MATCH = 'isabelle';

/** Shown in the unlock control and the "viewing as" chip. */
export const OWNER_LABEL = 'Isabelle';

/**
 * PostgREST filter that removes the owner's rows *at the server*, so hidden
 * rows never reach the browser at all — a client-side `.filter()` would still
 * put them in the network response for anyone with devtools open.
 *
 * The `assignee.is.null` arm is load-bearing. `NULL ILIKE '%isabelle%'` is NULL,
 * and `NOT NULL` is still NULL, so a bare `assignee=not.ilike.*isabelle*` drops
 * every unassigned ticket too — verified against the live table: 57 active rows
 * became 45 instead of the correct 51.
 */
export const HIDE_OWNER_FILTER = `assignee.is.null,assignee.not.ilike.*${OWNER_ASSIGNEE_MATCH}*`;

/** True when this assignee string belongs to the owner. */
export function isOwnerAssignee(assignee: string | null | undefined): boolean {
  return !!assignee && assignee.toLowerCase().includes(OWNER_ASSIGNEE_MATCH);
}
