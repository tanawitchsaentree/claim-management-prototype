import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TrackerViewerService } from './tracker-viewer.service';
import { HIDE_OWNER_FILTER } from './tracker-visibility';
import {
  toNote,
  toPi,
  toRelation,
  toSyncLog,
  toTicketWithDetails,
} from './tracker.mappers';
import type {
  Note,
  Pi,
  Relation,
  SyncLog,
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

@Injectable({ providedIn: 'root' })
export class TrackerService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly viewer = inject(TrackerViewerService);

  readonly tickets = signal<TicketWithDetails[]>([]);
  readonly ticket = signal<TicketWithDetails | null>(null);
  readonly notes = signal<Note[]>([]);
  readonly relations = signal<Relation[]>([]);
  readonly syncLog = signal<SyncLog[]>([]);
  readonly pis = signal<Pi[]>([]);
  // Two independent flags — getTickets() (the list, read by tracker-table) and
  // getTicket() (a single ticket, read by the detail panel) used to share one
  // `loading` signal. Opening any ticket flashed the WHOLE TABLE into its
  // loading-spinner state, and changing a filter while the panel was open
  // flashed the panel into ITS loading-spinner state — neither fetch had
  // actually changed the other's data, just the shared flag toggling.
  readonly loading = signal(false);
  readonly ticketLoading = signal(false);
  readonly error = signal<string | null>(null);

  // Guards against out-of-order Supabase responses — each of these fires
  // repeatedly with different arguments (filters changing, ticket rows
  // clicked through) with no cancellation, so an older call's response can
  // resolve after a newer one and overwrite it with stale data. One counter
  // per independent async flow; only the response matching the latest call
  // for that flow is applied.
  private ticketsRequestSeq = 0;
  private ticketRequestSeq = 0;
  private notesRequestSeq = 0;
  private relationsRequestSeq = 0;

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
    const seq = ++this.ticketsRequestSeq;
    this.loading.set(true);
    this.error.set(null);

    let query = this.supabase.from('ticket').select(TICKET_SELECT);
    // Owner's rows are excluded server-side, not filtered out of the response —
    // see tracker-visibility.ts. Applies to every ticket read below too.
    if (!this.viewer.isOwner()) query = query.or(HIDE_OWNER_FILTER);
    if (!filters.showArchived) query = query.eq('archived', false);
    if (filters.piId) query = query.eq('pi_id', filters.piId);
    if (filters.jiraStatus?.length) query = query.in('jira_status', filters.jiraStatus);
    if (filters.epicId) query = query.eq('epic_id', filters.epicId);
    if (filters.assignee) query = query.ilike('assignee', `%${filters.assignee}%`);

    const { data, error } = await query;
    if (seq !== this.ticketsRequestSeq) return; // a newer getTickets() call (e.g. another filter change) superseded this one

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

  // `silent: true` skips the loading flag — used by updateTicketState()'s refresh-after-save,
  // which is re-fetching a ticket that's ALREADY fully displayed just to pick up server-confirmed
  // fields (updated_by/updated_at). Toggling ticketLoading there used to blank the entire open
  // panel (every dropdown, every field) back to a spinner and re-render it on every single field
  // edit — the panel "flashing" on every click was this, not the open/close animation.
  async getTicket(jiraKey: string, opts: { silent?: boolean } = {}): Promise<void> {
    const seq = ++this.ticketRequestSeq;
    if (!opts.silent) this.ticketLoading.set(true);
    this.error.set(null);

    let query = this.supabase.from('ticket').select(TICKET_SELECT).eq('jira_key', jiraKey);
    // Closes the `?key=BMPCC-14833` hole: the panel fetches by key independently
    // of the list, so hiding rows from the table alone left every hidden ticket
    // one shared URL away from being fully readable.
    if (!this.viewer.isOwner()) query = query.or(HIDE_OWNER_FILTER);

    // maybeSingle(), not single() — a hidden or genuinely missing key now yields
    // (null, null) instead of PGRST116, so the panel's fallback branch shows
    // "This ticket could not be found." rather than a raw PostgREST error. It
    // reads identically whether the row is absent or withheld, which is the
    // point: the message must not reveal that a hidden row exists.
    const { data, error } = await query.maybeSingle();

    if (seq !== this.ticketRequestSeq) return; // superseded by a newer getTicket() call — drop this stale response

    if (error) {
      this.error.set(error.message);
      this.ticket.set(null);
    } else {
      this.ticket.set(data ? toTicketWithDetails(data as Record<string, unknown>) : null);
    }
    if (!opts.silent) this.ticketLoading.set(false);
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
      await this.getTicket(current.jiraKey, { silent: true });
    }
  }

  async addNote(ticketId: string, body: string, createdBy: string): Promise<void> {
    this.error.set(null);
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
    const seq = ++this.notesRequestSeq;
    const { data, error } = await this.supabase
      .from('note')
      .select('*')
      .eq('ticket_id', ticketId)
      .eq('archived', false)
      .order('created_at', { ascending: false });

    if (seq !== this.notesRequestSeq) return; // superseded by a newer getNotes() call (switched tickets) — drop this stale response

    if (error) {
      this.error.set(error.message);
      return;
    }
    this.notes.set((data ?? []).map((r) => toNote(r as Record<string, unknown>)));
  }

  async getRelations(ticketId: string): Promise<void> {
    const seq = ++this.relationsRequestSeq;
    const { data, error } = await this.supabase
      .from('relation')
      .select('*')
      .eq('ticket_id', ticketId)
      .eq('archived', false);

    if (seq !== this.relationsRequestSeq) return; // superseded by a newer getRelations() call — drop this stale response

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
