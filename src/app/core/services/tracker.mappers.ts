// snake_case Supabase rows → camelCase tracker models.
//
// Extracted verbatim from tracker.service.ts, which had reached 322 lines —
// over the 300-line limit in CLAUDE.md — and could not take the viewer/
// visibility wiring on top. Pure functions, no behaviour change.
import type {
  Epic,
  Note,
  Pi,
  Relation,
  SyncLog,
  TicketState,
  TicketWithDetails,
} from '../models/tracker.model';

export function toPi(row: Record<string, unknown>): Pi {
  return {
    id: row['id'] as string,
    name: row['name'] as string,
    startDate: (row['start_date'] as string) ?? null,
    endDate: (row['end_date'] as string) ?? null,
    archived: row['archived'] as boolean,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  };
}

export function toEpic(row: Record<string, unknown>): Epic {
  return {
    id: row['id'] as string,
    jiraKey: row['jira_key'] as string,
    title: row['title'] as string,
    piId: (row['pi_id'] as string) ?? null,
    jiraStatus: (row['jira_status'] as string) ?? null,
    archived: row['archived'] as boolean,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  };
}

export function toTicketState(row: Record<string, unknown>): TicketState {
  return {
    ticketId: row['ticket_id'] as string,
    designStatus: row['design_status'] as TicketState['designStatus'],
    buildStatus: row['build_status'] as TicketState['buildStatus'],
    handoffStatus: row['handoff_status'] as TicketState['handoffStatus'],
    blockedBy: row['blocked_by'] as TicketState['blockedBy'],
    blockedNote: (row['blocked_note'] as string) ?? null,
    blockedSince: (row['blocked_since'] as string) ?? null,
    updatedBy: (row['updated_by'] as string) ?? null,
    updatedAt: row['updated_at'] as string,
    prototypeRoute: (row['prototype_route'] as string) ?? null,
    prototypeTicketId: (row['prototype_ticket_id'] as string) ?? null,
  };
}

export function toTicketWithDetails(row: Record<string, unknown>): TicketWithDetails {
  const epicRow = row['epic'] as Record<string, unknown> | null;
  const stateRow = row['state'] as Record<string, unknown>;
  return {
    id: row['id'] as string,
    jiraKey: row['jira_key'] as string,
    title: row['title'] as string,
    epicId: (row['epic_id'] as string) ?? null,
    piId: (row['pi_id'] as string) ?? null,
    jiraStatus: (row['jira_status'] as string) ?? null,
    assignee: (row['assignee'] as string) ?? null,
    jiraUrl: (row['jira_url'] as string) ?? null,
    confluenceUrl: (row['confluence_url'] as string) ?? null,
    archived: row['archived'] as boolean,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
    epic: epicRow ? toEpic(epicRow) : null,
    state: toTicketState(stateRow),
  };
}

export function toNote(row: Record<string, unknown>): Note {
  return {
    id: row['id'] as string,
    ticketId: row['ticket_id'] as string,
    body: row['body'] as string,
    createdBy: row['created_by'] as string,
    createdAt: row['created_at'] as string,
    archived: row['archived'] as boolean,
  };
}

export function toRelation(row: Record<string, unknown>): Relation {
  return {
    id: row['id'] as string,
    ticketId: row['ticket_id'] as string,
    relatedTicketId: (row['related_ticket_id'] as string) ?? null,
    relatedJiraKey: (row['related_jira_key'] as string) ?? null,
    relationType: row['relation_type'] as string,
    archived: row['archived'] as boolean,
    createdAt: row['created_at'] as string,
  };
}

export function toSyncLog(row: Record<string, unknown>): SyncLog {
  return {
    id: row['id'] as string,
    startedAt: row['started_at'] as string,
    finishedAt: (row['finished_at'] as string) ?? null,
    ticketCount: (row['ticket_count'] as number) ?? null,
    epicCount: (row['epic_count'] as number) ?? null,
    status: row['status'] as SyncLog['status'],
    error: (row['error'] as string) ?? null,
    createdAt: row['created_at'] as string,
  };
}
