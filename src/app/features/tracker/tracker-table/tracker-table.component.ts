import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NxDropdownModule, NxMultiSelectComponent } from '@allianz/ng-aquila/dropdown';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { TrackerService, daysSince } from '../../../core/services/tracker.service';
import { TrackerSyncService } from '../../../core/services/tracker-sync.service';
import type { BlockedReason, TicketFilters, TicketWithDetails } from '../../../core/models/tracker.model';
import { TicketDetailPanelComponent } from '../ticket-detail-panel/ticket-detail-panel.component';

const BLOCKED_BY_OPTIONS: { value: BlockedReason; label: string }[] = [
  { value: 'waiting_product', label: 'Waiting: Product' },
  { value: 'waiting_ba', label: 'Waiting: BA' },
  { value: 'waiting_dev', label: 'Waiting: Dev' },
  { value: 'waiting_other_epic', label: 'Waiting: Other epic' },
  { value: 'scope_unclear', label: 'Scope unclear' },
];

const HAS_ROUTE_OPTIONS: { value: boolean | null; label: string }[] = [
  { value: null, label: 'Any' },
  { value: true, label: 'Has prototype route' },
  { value: false, label: 'No prototype route' },
];

interface EpicGroup {
  epicId: string | null;
  epicTitle: string;
  tickets: TicketWithDetails[];
}

@Component({
  selector: 'app-tracker-table',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxDropdownModule,
    NxMultiSelectComponent,
    NxFormfieldModule,
    NxInputModule,
    NxButtonModule,
    NxCheckboxModule,
    NxTableModule,
    NxSpinnerModule,
    NxIconModule,
    NxMessageModule,
    PageHeaderComponent,
    EmptyStateComponent,
    StatusChipComponent,
    AppDatePipe,
    TicketDetailPanelComponent,
  ],
  templateUrl: './tracker-table.component.html',
  styleUrl: './tracker-table.component.scss',
})
export class TrackerTableComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly trackerService = inject(TrackerService);
  readonly syncService = inject(TrackerSyncService);

  readonly blockedByOptions = BLOCKED_BY_OPTIONS;
  readonly hasRouteOptions = HAS_ROUTE_OPTIONS;
  readonly groupByEpic = signal(true);

  // Filters are seeded from TrackerService.filters() — set there, not here,
  // so they survive this component being destroyed/recreated when
  // navigating '' <-> 'ticket/:key' (different route configs, same
  // component class — Angular does not reuse the instance).
  private readonly initialFilters = this.trackerService.filters();

  readonly piControl = new FormControl<string | null>(this.initialFilters.piId ?? null);
  readonly statusControl = new FormControl<string[]>(this.initialFilters.jiraStatus ?? [], { nonNullable: true });
  readonly epicControl = new FormControl<string | null>(this.initialFilters.epicId ?? null);
  readonly blockedControl = new FormControl<BlockedReason | null>(this.initialFilters.blockedBy ?? null);
  readonly assigneeControl = new FormControl<string | null>(this.initialFilters.assignee ?? null);
  readonly hasRouteControl = new FormControl<boolean | null>(this.initialFilters.hasPrototypeRoute ?? null);
  readonly showArchivedControl = new FormControl<boolean>(this.initialFilters.showArchived ?? false, { nonNullable: true });

  private readonly piSignal = toSignal(this.piControl.valueChanges, { initialValue: this.piControl.value });
  private readonly statusSignal = toSignal(this.statusControl.valueChanges, { initialValue: this.statusControl.value });
  private readonly epicSignal = toSignal(this.epicControl.valueChanges, { initialValue: this.epicControl.value });
  private readonly blockedSignal = toSignal(this.blockedControl.valueChanges, { initialValue: this.blockedControl.value });
  private readonly assigneeSignal = toSignal(this.assigneeControl.valueChanges, { initialValue: this.assigneeControl.value });
  private readonly hasRouteSignal = toSignal(this.hasRouteControl.valueChanges, { initialValue: this.hasRouteControl.value });
  private readonly showArchivedSignal = toSignal(this.showArchivedControl.valueChanges, { initialValue: this.showArchivedControl.value });

  private readonly paramMap = toSignal(this.route.paramMap);
  readonly selectedKey = computed(() => this.paramMap()?.get('key') ?? null);

  readonly jiraStatusOptions = computed(() => {
    const values = new Set(this.trackerService.tickets().map((t) => t.jiraStatus).filter((v): v is string => !!v));
    return Array.from(values).sort();
  });

  // Shape NxMultiSelectComponent's [options]/selectValue/selectLabel expects
  // (BLESSED pattern: add-section-entity-modal.component.html:17).
  readonly jiraStatusSelectOptions = computed(() => this.jiraStatusOptions().map((s) => ({ value: s, label: s })));

  readonly assigneeOptions = computed(() => {
    const values = new Set(this.trackerService.tickets().map((t) => t.assignee).filter((v): v is string => !!v));
    return Array.from(values).sort();
  });

  readonly epicOptions = computed(() => {
    const map = new Map<string, string>();
    for (const t of this.trackerService.tickets()) {
      if (t.epic) map.set(t.epic.id, t.epic.title);
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));
  });

  readonly sortedTickets = computed(() => {
    return [...this.trackerService.tickets()].sort((a, b) => {
      const daysDiff = daysSince(b.state.blockedSince) - daysSince(a.state.blockedSince);
      if (daysDiff !== 0) return daysDiff;
      return (a.epic?.title ?? '').localeCompare(b.epic?.title ?? '');
    });
  });

  readonly groupedTickets = computed<EpicGroup[]>(() => {
    const groups = new Map<string, EpicGroup>();
    for (const ticket of this.sortedTickets()) {
      const epicId = ticket.epicId ?? '__none__';
      if (!groups.has(epicId)) {
        groups.set(epicId, { epicId: ticket.epicId, epicTitle: ticket.epic?.title ?? 'No epic', tickets: [] });
      }
      groups.get(epicId)!.tickets.push(ticket);
    }
    return Array.from(groups.values()).sort((a, b) => a.epicTitle.localeCompare(b.epicTitle));
  });

  // Single shape the template iterates regardless of groupByEpic — flat mode
  // is just one unlabelled "group" containing every ticket in sorted order.
  readonly groupsToRender = computed<EpicGroup[]>(() => {
    return this.groupByEpic()
      ? this.groupedTickets()
      : [{ epicId: null, epicTitle: '', tickets: this.sortedTickets() }];
  });

  readonly lastSyncedAt = computed(() => {
    const log = this.trackerService.syncLog();
    return log.find((s) => s.status === 'success')?.finishedAt ?? null;
  });

  daysBlocked(ticket: TicketWithDetails): number {
    return daysSince(ticket.state.blockedSince);
  }

  constructor() {
    this.trackerService.getPis();
    this.trackerService.getSyncLog();

    effect(() => {
      const filters: TicketFilters = {
        piId: this.piSignal() ?? undefined,
        jiraStatus: this.statusSignal(),
        epicId: this.epicSignal() ?? undefined,
        blockedBy: this.blockedSignal() ?? undefined,
        assignee: this.assigneeSignal() ?? undefined,
        hasPrototypeRoute: this.hasRouteSignal() ?? undefined,
        showArchived: this.showArchivedSignal(),
      };
      this.trackerService.setFilters(filters);
      this.trackerService.getTickets(filters);
    });
  }

  openTicket(ticket: TicketWithDetails): void {
    this.router.navigate(['/tracker/ticket', ticket.jiraKey]);
  }

  closeDetail(): void {
    this.router.navigate(['/tracker']);
  }

  sync(): void {
    this.syncService.triggerSync();
  }
}
