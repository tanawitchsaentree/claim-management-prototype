// Tracker Phase 1 — Jira sync.
//
// Deploy: `supabase functions deploy sync-jira` (from the supabase/ dir).
// Secrets (set via `supabase secrets set NAME=value` — never commit these):
//   JIRA_BASE_URL   e.g. https://your-domain.atlassian.net
//   JIRA_TOKEN      Jira API token / PAT
//   JIRA_JQL        the JQL string scoping which issues to sync (config, not hardcoded)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected by the Edge
// Functions runtime — do not set them yourself.
//
// Confirmed empirically against jmp.allianz.net (2026-08-20), not guessed:
// - `Authorization: Bearer <token>` — 200 on /rest/api/2/myself. Basic auth
//   401s on this instance. This is a Data Center PAT, not a Cloud API token.
// - API version is v2, not v3 — `/rest/api/3/search` 302-redirects (doesn't
//   exist on this instance). Must use `/rest/api/2/search`.
// - Epic link is `customfield_16101` ("Epic Link", classic field — confirmed
//   via /rest/api/2/field), NOT `fields.parent`. `parent` is null on nearly
//   every Story in BMPCC; Epic Link carries the real epic key.
//
// Known Phase-1 limitation: Sub-tasks link to their immediate parent (a
// Story), which itself carries the Epic Link — this sync does not walk that
// second hop, so sub-tasks land in "No epic" in the table's epic grouping.
//
// - confluence_url is NOT populated by this sync (no defined source) — the
//   ticket table column exists for the detail panel to display, but nothing
//   currently writes it. Manual-edit UI for it is out of Phase 1 scope.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status?: { name: string };
    assignee?: { displayName: string };
    issuetype?: { name: string };
    // "Epic Link" classic custom field on this instance — see file header.
    customfield_16101?: string | null;
  };
}

async function fetchAllIssues(baseUrl: string, token: string, jql: string): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  let startAt = 0;
  const maxResults = 100;

  while (true) {
    const url = `${baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,status,assignee,issuetype,customfield_16101&startAt=${startAt}&maxResults=${maxResults}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Jira search failed: ${res.status} ${await res.text()}`);
    }

    const body = await res.json();
    issues.push(...(body.issues ?? []));

    startAt += maxResults;
    if (startAt >= (body.total ?? 0)) break;
  }

  return issues;
}

// deno-lint-ignore no-explicit-any
async function upsertIssues(supabase: any, baseUrl: string, issues: JiraIssue[]) {
  const epics = issues.filter((i) => i.fields.issuetype?.name === 'Epic');
  const tickets = issues.filter((i) => i.fields.issuetype?.name !== 'Epic');

  if (epics.length > 0) {
    const { error } = await supabase.from('epic').upsert(
      epics.map((e) => ({
        jira_key: e.key,
        title: e.fields.summary,
        jira_status: e.fields.status?.name ?? null,
      })),
      { onConflict: 'jira_key' },
    );
    if (error) throw new Error(`epic upsert failed: ${error.message}`);
  }

  // epic_id is a FK to our epic.id — resolve jira epic key -> our row id
  // after epics are upserted.
  const { data: epicRows, error: epicFetchError } = await supabase.from('epic').select('id, jira_key');
  if (epicFetchError) throw new Error(`epic fetch failed: ${epicFetchError.message}`);
  const epicIdByKey = new Map<string, string>((epicRows ?? []).map((r: { id: string; jira_key: string }) => [r.jira_key, r.id]));

  if (tickets.length > 0) {
    const { error } = await supabase.from('ticket').upsert(
      tickets.map((t) => ({
        jira_key: t.key,
        title: t.fields.summary,
        jira_status: t.fields.status?.name ?? null,
        assignee: t.fields.assignee?.displayName ?? null,
        epic_id: t.fields.customfield_16101 ? epicIdByKey.get(t.fields.customfield_16101) ?? null : null,
        jira_url: `${baseUrl}/browse/${t.key}`,
      })),
      { onConflict: 'jira_key' },
    );
    if (error) throw new Error(`ticket upsert failed: ${error.message}`);
  }

  return { epicCount: epics.length, ticketCount: tickets.length };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const baseUrl = Deno.env.get('JIRA_BASE_URL');
  const token = Deno.env.get('JIRA_TOKEN');
  const jql = Deno.env.get('JIRA_JQL');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!baseUrl || !token || !jql) {
    return new Response(
      JSON.stringify({ error: 'Missing JIRA_BASE_URL / JIRA_TOKEN / JIRA_JQL secret' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: logRow, error: logError } = await supabase
    .from('sync_log')
    .insert({ status: 'running' })
    .select()
    .single();
  if (logError) {
    return new Response(JSON.stringify({ error: logError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const issues = await fetchAllIssues(baseUrl, token, jql);
    const { epicCount, ticketCount } = await upsertIssues(supabase, baseUrl, issues);

    await supabase
      .from('sync_log')
      .update({ status: 'success', finished_at: new Date().toISOString(), ticket_count: ticketCount, epic_count: epicCount })
      .eq('id', logRow.id);

    return new Response(JSON.stringify({ epicCount, ticketCount }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    await supabase
      .from('sync_log')
      .update({ status: 'error', finished_at: new Date().toISOString(), error: String(err) })
      .eq('id', logRow.id);

    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
