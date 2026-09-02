export type TrackerStageStatus = 'not_started' | 'in_progress' | 'done';

export type BlockedReason =
  | 'none'
  | 'waiting_product'
  | 'waiting_ba'
  | 'waiting_dev'
  | 'waiting_other_epic'
  | 'scope_unclear';

export type SyncStatus = 'running' | 'success' | 'error';

export interface Pi {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Epic {
  id: string;
  jiraKey: string;
  title: string;
  piId: string | null;
  jiraStatus: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: string;
  jiraKey: string;
  title: string;
  epicId: string | null;
  piId: string | null;
  jiraStatus: string | null;
  assignee: string | null;
  jiraUrl: string | null;
  confluenceUrl: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

// OUR data — the Jira sync must never write to this shape.
export interface TicketState {
  ticketId: string;
  // No designStatus. The ticket_state.design_status column still exists in
  // Supabase (0001_tracker.sql) and is left alone — dropping a column needs a
  // migration and buys nothing — but nothing in the app reads or writes it as of
  // 2026-09-02. It duplicated buildStatus in practice: 15 of 15 handoff-done rows
  // were also build-done, only 7 distinct combinations existed across 51 rows,
  // and 49 of the 51 were stamped `updated_by: Claude`, i.e. self-assessed by an
  // agent session rather than by a designer. A column nobody sets honestly is
  // worse than no column.
  buildStatus: TrackerStageStatus;
  handoffStatus: TrackerStageStatus;
  blockedBy: BlockedReason;
  blockedNote: string | null;
  blockedSince: string | null;
  updatedBy: string | null;
  updatedAt: string;
  // In-app route this ticket maps to (e.g. "/claims/CLM-2024-001/sections") —
  // added 2026-08-20 for the "Open in prototype" button.
  prototypeRoute: string | null;
  // Bridge to public/tickets/*.json's own id space (DevTicket.ticketId) —
  // added 2026-08-20. When set, "Open in prototype" applies this ticket's
  // stateOverrides + runs its postLand/tour via PrototypeScenarioService
  // instead of a bare route navigation.
  prototypeTicketId: string | null;
}

export interface Note {
  id: string;
  ticketId: string;
  body: string;
  createdBy: string;
  createdAt: string;
  archived: boolean;
}

export interface Relation {
  id: string;
  ticketId: string;
  relatedTicketId: string | null;
  relatedJiraKey: string | null;
  relationType: string;
  archived: boolean;
  createdAt: string;
}

export interface SyncLog {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  ticketCount: number | null;
  epicCount: number | null;
  status: SyncStatus;
  error: string | null;
  createdAt: string;
}

// Shape returned by TrackerService.getTickets()/getTicket() — ticket joined
// with its epic and (always-present, trigger-created) ticket_state.
export interface TicketWithDetails extends Ticket {
  epic: Epic | null;
  state: TicketState;
}

export interface TicketFilters {
  piId?: string;
  jiraStatus?: string[];
  blockedBy?: BlockedReason;
  assignee?: string;
  epicId?: string;
  hasPrototypeRoute?: boolean;
  showArchived?: boolean;
}
