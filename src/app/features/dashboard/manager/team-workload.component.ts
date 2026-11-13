import {
  Component,
  EventEmitter,
  Output,
  computed,
  input,
  ChangeDetectionStrategy
} from '@angular/core';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { CaseFlagKind, ManagedCase, TeamMemberSummary } from '../../../core/models/team.model';
import { ManagerCaseTableComponent } from './manager-case-table.component';

export interface TeamFilters {
  member: string | null;
  status: 'Open' | 'Closed' | 'all';
  flag: 'all' | 'any' | CaseFlagKind;
}

// BMPCC-22395 AC1 / AC3: per-member summary, drill-down into one member's
// claims, and filters by member, status and flag.
// DESIGN DECISION CM-SUM-1 (open question 5): counts yes, charts no. A
// manager needs "who has how much and what needs me", which numbers answer
// faster than a chart; every count is also a filter.
@Component({
  selector: 'app-team-workload',
  standalone: true,
  imports: [
    NxTableModule,
    NxDropdownModule,
    NxIconModule,
    NxButtonModule,
    NxMessageModule,
    EmptyStateComponent,
    ManagerCaseTableComponent
  ],
  templateUrl: './team-workload.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './team-workload.component.scss'
})
export class TeamWorkloadComponent {
  readonly members = input.required<TeamMemberSummary[]>();
  readonly cases = input.required<ManagedCase[]>();
  readonly filters = input.required<TeamFilters>();
  @Output() filtersChange = new EventEmitter<Partial<TeamFilters>>();
  @Output() reassign = new EventEmitter<ManagedCase>();

  // audit-exempt: UI filter labels for this widget, not lookup data.
  readonly statusOptions: { value: TeamFilters['status']; label: string }[] = [
    { value: 'Open', label: 'Open' },
    { value: 'Closed', label: 'Closed' },
    { value: 'all', label: 'All statuses' }
  ];

  // audit-exempt: UI filter labels (flag kinds are defined in team.model.ts).
  readonly flagOptions: { value: TeamFilters['flag']; label: string }[] = [
    { value: 'all', label: 'All claims' },
    { value: 'any', label: 'Needs attention' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'high-value', label: 'High value' },
    { value: 'review', label: 'For review' }
  ];

  readonly people = computed(() => this.members().filter(m => !m.isQueue));
  readonly missing = computed(() => this.members().filter(m => m.missing));

  readonly filtered = computed(() => {
    const f = this.filters();
    return this.cases().filter(
      mc =>
        (!f.member || mc.owner === f.member) &&
        (f.status === 'all' || mc.claim.status === f.status) &&
        (f.flag === 'all' ||
          (f.flag === 'any' ? mc.flags.length > 0 : mc.flags.some(x => x.kind === f.flag)))
    );
  });

  readonly heading = computed(() => {
    const m = this.filters().member;
    if (!m) return 'All team claims';
    return m === 'Team queue' ? 'Claims in the team queue' : `${m}'s claims`;
  });

  readonly emptyMessage = computed(() => {
    const f = this.filters();
    if (f.member && f.status === 'Open' && f.flag === 'all') {
      return f.member === 'Team queue'
        ? 'The team queue is empty.'
        : `${f.member} has no open claims.`;
    }
    return 'No claims match these filters.';
  });

  drillDown(name: string): void {
    this.filtersChange.emit({ member: name });
    document.getElementById('mgr-team-cases')?.focus();
  }
}
