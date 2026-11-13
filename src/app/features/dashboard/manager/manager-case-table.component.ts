import {
  Component,
  EventEmitter,
  Output,
  computed,
  input,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NxTableModule, SortEvent } from '@allianz/ng-aquila/table';
import { NxBadgeModule } from '@allianz/ng-aquila/badge';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { CaseFlagKind, ManagedCase } from '../../../core/models/team.model';
import { CaseSortKey, sortCases } from './manager-cases.builder';

const BADGE_TYPE: Record<CaseFlagKind, string> = {
  overdue: 'critical',
  'high-value': 'warning',
  review: 'info'
};

// Top rows only, like the handler dashboard's widgets; "View all" in the
// card header opens the full list.
const PAGE = 8;

// BMPCC-22395 AC2 / AC3: one case table for "My cases" and the team view.
// DESIGN DECISION CM-FIELDS-1 (open question 2): the fields a manager
// prioritises by: claim, client, handler, status, priority, flags with the
// reason, last updated, loss amount, line of business. Same table look as
// the handler dashboard's Claims portfolio (dash-table).
@Component({
  selector: 'app-manager-case-table',
  standalone: true,
  imports: [
    DecimalPipe,
    RouterLink,
    NxTableModule,
    NxBadgeModule,
    NxIconModule,
    NxContextMenuModule,
    NxTooltipModule,
    StatusChipComponent,
    EmptyStateComponent,
    AppDatePipe
  ],
  templateUrl: './manager-case-table.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './manager-case-table.component.scss'
})
export class ManagerCaseTableComponent {
  readonly cases = input.required<ManagedCase[]>();
  readonly showOwner = input(false);
  readonly emptyMessage = input('No claims to show.');
  readonly emptyHint = input<string | undefined>(undefined);
  // Screen-reader caption for the table.
  readonly caption = input.required<string>();
  @Output() reassign = new EventEmitter<ManagedCase>();

  readonly sortKey = signal<CaseSortKey>('flags');
  readonly sortDir = signal<'asc' | 'desc'>('desc');

  readonly sorted = computed(() => sortCases(this.cases(), this.sortKey(), this.sortDir()));
  readonly visible = computed(() => this.sorted().slice(0, PAGE));

  badgeType(kind: CaseFlagKind): string {
    return BADGE_TYPE[kind];
  }

  // NDBX nxSort owns the header buttons, arrows and aria-sort.
  onSort(e: SortEvent): void {
    this.sortKey.set(e.active as CaseSortKey);
    this.sortDir.set(e.direction);
  }

}
