import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type {
  Epic,
  Note,
  Pi,
  Relation,
  SyncLog,
  Ticket,
  TicketFilters,
  TicketState,
  TicketWithDetails,
} from '../models/tracker.model';

const TICKET_SELECT = '*, epic:epic_id(*), state:ticket_state(*)';

// Shared by tracker-table (days-blocked column/sort) and ticket-detail-panel
// (days-blocked line under the Blocked row).
export function daysSince(iso: string | null): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function toPi(row: Record<string, unknown>): Pi {
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

function toEpic(row: Record<string, unknown>): Epic {
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

function toTicketState(row: Record<string, unknown>): TicketState {
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
  };
}

function toTicketWithDetails(row: Record<string, unknown>): TicketWithDetails {
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

function toNote(row: Record<string, unknown>): Note {
  return {
    id: row['id'] as string,
    ticketId: row['ticket_id'] as string,
    body: row['body'] as string,
    createdBy: row['created_by'] as string,
    createdAt: row['created_at'] as string,
    archived: row['archived'] as boolean,
  };
}

function toRelation(row: Record<string, unknown>): Relation {
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

function toSyncLog(row: Record<string, unknown>): SyncLog {
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

@Injectable({ providedIn: 'root' })
export class TrackerService {
  private readonly supabase = inject(SupabaseService).client;

  readonly tickets = signal<TicketWithDetails[]>([]);
  readonly ticket = signal<TicketWithDetails | null>(null);
  readonly notes = signal<Note[]>([]);
  readonly relations = signal<Relation[]>([]);
  readonly syncLog = signal<SyncLog[]>([]);
  readonly pis = signal<Pi[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // Filter state lives here, not on the component — TrackerTableComponent
  // is destroyed/recreated on '' <-> 'ticket/:key' navigation (different
  // route configs, same component class), so filters must survive outside
  // it to "persist while navigating within the tracker".
  readonly filters = signal<TicketFilters>({ showArchived: false });

  setFilters(patch: Partial<TicketFilters>): void {
    this.filters.update((f) => ({ ...f, ...patch }));
  }

  // Not in the original service list — added so the PI filter dropdown has
  // names to show (ticket only carries pi_id, not a joined pi name).
  async getPis(): Promise<void> {
    const { data, error } = await this.supabase.from('pi').select('*').eq('archived', false).order('name');
    if (error) {
      this.error.set(error.message);
      return;
    }
    this.pis.set((data ?? []).map((r) => toPi(r as Record<string, unknown>)));
  }

  async getTickets(filters: TicketFilters = {}): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    let query = this.supabase.from('ticket').select(TICKET_SELECT);
    if (!filters.showArchived) query = query.eq('archived', false);
    if (filters.piId) query = query.eq('pi_id', filters.piId);
    if (filters.jiraStatus?.length) query = query.in('jira_status', filters.jiraStatus);
    if (filters.epicId) query = query.eq('epic_id', filters.epicId);
    if (filters.assignee) query = query.ilike('assignee', `%${filters.assignee}%`);

    const { data, error } = await query;
    if (error) {
      this.error.set(error.message);
      this.loading.set(false);
      return;
    }

    let rows = (data ?? []).map((r) => toTicketWithDetails(r as Record<string, unknown>));
    // blocked_by / prototype_route live on the joined ticket_state row —
    // filtered client-side rather than via a PostgREST !inner embed filter
    // (2 users, small dataset).
    if (filters.blockedBy) {
      rows = rows.filter((r) => r.state.blockedBy === filters.blockedBy);
    }
    if (filters.hasPrototypeRoute !== undefined) {
      rows = rows.filter((r) => !!r.state.prototypeRoute === filters.hasPrototypeRoute);
    }
    this.tickets.set(rows);
    this.loading.set(false);
  }

  async getTicket(jiraKey: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase
      .from('ticket')
      .select(TICKET_SELECT)
      .eq('jira_key', jiraKey)
      .single();

    if (error) {
      this.error.set(error.message);
      this.ticket.set(null);
    } else {
      this.ticket.set(toTicketWithDetails(data as Record<string, unknown>));
    }
    this.loading.set(false);
  }

  async updateTicketState(
    ticketId: string,
    partial: Partial<Pick<TicketState, 'designStatus' | 'buildStatus' | 'handoffStatus' | 'blockedBy' | 'blockedNote' | 'prototypeRoute'>>,
    updatedBy: string,
  ): Promise<void> {
    const patch: Record<string, unknown> = { updated_by: updatedBy };
    if (partial.designStatus !== undefined) patch['design_status'] = partial.designStatus;
    if (partial.buildStatus !== undefined) patch['build_status'] = partial.buildStatus;
    if (partial.handoffStatus !== undefined) patch['handoff_status'] = partial.handoffStatus;
    if (partial.blockedBy !== undefined) patch['blocked_by'] = partial.blockedBy;
    if (partial.blockedNote !== undefined) patch['blocked_note'] = partial.blockedNote;
    if (partial.prototypeRoute !== undefined) patch['prototype_route'] = partial.prototypeRoute;

    const { error } = await this.supabase.from('ticket_state').update(patch).eq('ticket_id', ticketId);
    if (error) {
      this.error.set(error.message);
      return;
    }

    const current = this.ticket();
    if (current && current.id === ticketId) {
      await this.getTicket(current.jiraKey);
    }
  }

  async addNote(ticketId: string, body: string, createdBy: string): Promise<void> {
    const { error } = await this.supabase
      .from('note')
      .insert({ ticket_id: ticketId, body, created_by: createdBy });
    if (error) {
      this.error.set(error.message);
      return;
    }
    await this.getNotes(ticketId);
  }

  async getNotes(ticketId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('note')
      .select('*')
      .eq('ticket_id', ticketId)
      .eq('archived', false)
      .order('created_at', { ascending: false });

    if (error) {
      this.error.set(error.message);
      return;
    }
    this.notes.set((data ?? []).map((r) => toNote(r as Record<string, unknown>)));
  }

  async getRelations(ticketId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('relation')
      .select('*')
      .eq('ticket_id', ticketId)
      .eq('archived', false);

    if (error) {
      this.error.set(error.message);
      return;
    }
    this.relations.set((data ?? []).map((r) => toRelation(r as Record<string, unknown>)));
  }

  async getSyncLog(limit = 5): Promise<void> {
    const { data, error } = await this.supabase
      .from('sync_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.error.set(error.message);
      return;
    }
    this.syncLog.set((data ?? []).map((r) => toSyncLog(r as Record<string, unknown>)));
  }
}
