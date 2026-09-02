import { Component, EventEmitter, Input, OnChanges, Output, computed, inject, signal } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxModalModule, NxDialogService } from '@allianz/ng-aquila/modal';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { SupabaseService } from '../../../core/services/supabase.service';
import { TrackerService, daysSince } from '../../../core/services/tracker.service';
import { PrototypeScenarioService } from '../../../core/services/prototype-scenario.service';
import type { BlockedReason, TrackerStageStatus } from '../../../core/models/tracker.model';
import { AddNoteModalComponent, AddNoteModalData } from '../add-note-modal/add-note-modal.component';

const STAGE_OPTIONS: { value: TrackerStageStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

const BLOCKED_OPTIONS: { value: BlockedReason; label: string }[] = [
  { value: 'none', label: 'Not blocked' },
  { value: 'waiting_product', label: 'Waiting: Product' },
  { value: 'waiting_ba', label: 'Waiting: BA' },
  { value: 'waiting_dev', label: 'Waiting: Dev' },
  { value: 'waiting_other_epic', label: 'Waiting: Other epic' },
  { value: 'scope_unclear', label: 'Scope unclear' },
];

@Component({
  selector: 'app-ticket-detail-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxDropdownModule,
    NxFormfieldModule,
    NxInputModule,
    NxButtonModule,
    NxIconModule,
    NxModalModule,
    NxSpinnerModule,
    AppDatePipe,
  ],
  templateUrl: './ticket-detail-panel.component.html',
  styleUrl: './ticket-detail-panel.component.scss',
  animations: [
    // Same technique as ClaimRightStripComponent's `panelSlide` trigger
    // (claim-right-strip.component.ts:27-39) — width/opacity keyframes on
    // enter/leave. Applied here to a fixed-position right-edge drawer
    // instead of an inline flex child.
    trigger('panelSlide', [
      transition(':enter', [
        style({ width: 0, opacity: 0, overflow: 'hidden' }),
        animate('220ms cubic-bezier(0.2, 0, 0, 1)', style({ width: '420px', opacity: 1 })),
      ]),
      transition(':leave', [
        style({ overflow: 'hidden' }),
        animate('180ms cubic-bezier(0.4, 0, 1, 1)', style({ width: 0, opacity: 0 })),
      ]),
    ]),
  ],
})
export class TicketDetailPanelComponent implements OnChanges {
  @Input({ required: true }) jiraKey!: string;
  @Output() closed = new EventEmitter<void>();

  private readonly supabase = inject(SupabaseService).client;
  private readonly dialog = inject(NxDialogService);
  private readonly prototypeScenarioSvc = inject(PrototypeScenarioService);
  readonly trackerService = inject(TrackerService);
  readonly opening = signal(false);

  readonly stageOptions = STAGE_OPTIONS;
  readonly blockedOptions = BLOCKED_OPTIONS;

  readonly designControl = new FormControl<TrackerStageStatus>('not_started', { nonNullable: true });
  readonly buildControl = new FormControl<TrackerStageStatus>('not_started', { nonNullable: true });
  readonly handoffControl = new FormControl<TrackerStageStatus>('not_started', { nonNullable: true });
  readonly blockedByControl = new FormControl<BlockedReason>('none', { nonNullable: true });
  readonly blockedNoteControl = new FormControl<string>('', { nonNullable: true });
  readonly prototypeRouteControl = new FormControl<string>('', { nonNullable: true });

  readonly pi = computed(() => {
    const ticket = this.trackerService.ticket();
    if (!ticket?.piId) return null;
    return this.trackerService.pis().find((p) => p.id === ticket.piId) ?? null;
  });

  readonly daysBlocked = computed(() => daysSince(this.trackerService.ticket()?.state.blockedSince ?? null));

  // Auto-matched by jiraKey against the loaded ticket-file registry when nobody's set
  // prototype_ticket_id by hand — see PrototypeScenarioService.resolveTicketId()'s comment.
  readonly effectivePrototypeTicketId = computed(() => {
    const ticket = this.trackerService.ticket();
    if (!ticket) return null;
    return this.prototypeScenarioSvc.resolveTicketId(ticket.jiraKey, ticket.state.prototypeTicketId);
  });

  readonly effectivePrototypeRoute = computed(() => {
    const ticket = this.trackerService.ticket();
    if (!ticket) return null;
    return this.prototypeScenarioSvc.resolveRoute(ticket.jiraKey, ticket.state.prototypeTicketId, ticket.state.prototypeRoute);
  });

  // True only when the link came from auto-matching, not from the manual field — controls
  // whether the panel shows the free-text input (manual fallback) or a read-only auto-detected
  // summary. A manually-set prototype_ticket_id always takes the manual/editable branch too,
  // since the user chose to wire it explicitly and might want to change it.
  readonly isAutoDetected = computed(() => {
    const ticket = this.trackerService.ticket();
    return !!ticket && !ticket.state.prototypeTicketId && !!this.prototypeScenarioSvc.getTicketById(ticket.jiraKey);
  });

  ngOnChanges(): void {
    if (this.jiraKey) {
      this.load();
      // Idempotent — PrototypeScenarioService only fetches once, cached
      // for every consumer (dev banner included).
      this.prototypeScenarioSvc.loadTickets();
    }
  }

  // Apply→navigate→postLand sequence lives in PrototypeScenarioService.openRoute() —
  // shared with the tracker table's row-level "open in prototype" action.
  async openInPrototype(): Promise<void> {
    const route = this.effectivePrototypeRoute();
    if (!route) return;

    this.opening.set(true);
    await this.prototypeScenarioSvc.openRoute(route, this.effectivePrototypeTicketId());
    this.opening.set(false);
  }

  private async load(): Promise<void> {
    await this.trackerService.getTicket(this.jiraKey);
    const ticket = this.trackerService.ticket();
    if (!ticket) return;

    this.designControl.setValue(ticket.state.designStatus, { emitEvent: false });
    this.buildControl.setValue(ticket.state.buildStatus, { emitEvent: false });
    this.handoffControl.setValue(ticket.state.handoffStatus, { emitEvent: false });
    this.blockedByControl.setValue(ticket.state.blockedBy, { emitEvent: false });
    this.blockedNoteControl.setValue(ticket.state.blockedNote ?? '', { emitEvent: false });
    this.prototypeRouteControl.setValue(ticket.state.prototypeRoute ?? '', { emitEvent: false });

    await Promise.all([this.trackerService.getNotes(ticket.id), this.trackerService.getRelations(ticket.id)]);
  }

  private async currentUserEmail(): Promise<string> {
    const { data } = await this.supabase.auth.getUser();
    return data.user?.email ?? 'unknown';
  }

  async onDesignChange(value: TrackerStageStatus): Promise<void> {
    await this.saveState({ designStatus: value });
  }

  async onBuildChange(value: TrackerStageStatus): Promise<void> {
    await this.saveState({ buildStatus: value });
  }

  async onHandoffChange(value: TrackerStageStatus): Promise<void> {
    await this.saveState({ handoffStatus: value });
  }

  async onBlockedByChange(value: BlockedReason): Promise<void> {
    await this.saveState({ blockedBy: value });
  }

  async onBlockedNoteBlur(): Promise<void> {
    await this.saveState({ blockedNote: this.blockedNoteControl.value });
  }

  async onPrototypeRouteBlur(): Promise<void> {
    const value = this.prototypeRouteControl.value.trim();
    await this.saveState({ prototypeRoute: value || null });
  }

  private async saveState(
    partial: Partial<{
      designStatus: TrackerStageStatus;
      buildStatus: TrackerStageStatus;
      handoffStatus: TrackerStageStatus;
      blockedBy: BlockedReason;
      blockedNote: string;
      prototypeRoute: string | null;
    }>,
  ): Promise<void> {
    const ticket = this.trackerService.ticket();
    if (!ticket) return;
    const email = await this.currentUserEmail();
    await this.trackerService.updateTicketState(ticket.id, partial, email);
  }

  async openAddNoteModal(): Promise<void> {
    const ticket = this.trackerService.ticket();
    if (!ticket) return;

    const email = await this.currentUserEmail();
    const ref = this.dialog.open<AddNoteModalComponent, AddNoteModalData, boolean>(AddNoteModalComponent, {
      data: { ticketId: ticket.id, createdBy: email },
      width: '480px',
    });
    // AddNoteModalComponent's own save() already refreshes trackerService.notes()
    // before closing — nothing further to do with the result here.
    await firstValueFrom(ref.afterClosed());
  }

  close(): void {
    this.closed.emit();
  }
}
