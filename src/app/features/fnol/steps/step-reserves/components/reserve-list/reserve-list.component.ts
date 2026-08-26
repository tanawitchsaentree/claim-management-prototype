import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { MockReservesService } from '../../../../../../core/mock/services/mock-reserves.service';
import { Reserve, ReservesPolicyData, ReserveType, RESERVE_TYPE_LABELS } from '../../../../../../core/models/reserve.model';

export type ReserveListViewMode = 'one' | 'all-flat' | 'all-grouped';

@Component({
  selector: 'app-reserve-list',
  standalone: true,
  imports: [DecimalPipe, NxIconModule, NxButtonModule, NxTableModule, NxContextMenuModule],
  templateUrl: './reserve-list.component.html',
  styleUrl: './reserve-list.component.scss',
})
export class ReserveListComponent implements OnChanges {
  @Input({ required: true }) rows: Reserve[] = [];
  @Input({ required: true }) policyNumber = '';
  @Input({ required: true }) allPolicies: ReservesPolicyData[] = [];
  @Input({ required: true }) isSqueezed = false;
  @Input() selectedReserveId: string | null = null;

  @Output() selected = new EventEmitter<Reserve>();
  @Output() editRequested = new EventEmitter<Reserve>();
  @Output() removeRequested = new EventEmitter<Reserve>();
  @Output() viewModeChanged = new EventEmitter<ReserveListViewMode>();

  private readonly reservesSvc = inject(MockReservesService);

  readonly typeLabels = RESERVE_TYPE_LABELS;
  readonly subTypes: ReserveType[] = ['indemnity', 'expenses', 'recoveries'];

  readonly viewMode     = signal<ReserveListViewMode>('one');
  readonly expandedRows = signal<Set<string>>(new Set());

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedReserveId']) {
      this.expandedRows.set(new Set());   // collapse all — selection just changed
    }
  }

  setViewMode(m: ReserveListViewMode): void {
    this.viewMode.set(m);
    this.viewModeChanged.emit(m);
  }

  // Rows visible in the list (depends on viewMode + squeeze state).
  visibleRows(): Reserve[] {
    if (!this.isSqueezed || this.viewMode() === 'one') return this.rows;
    return this.allPolicies.flatMap(p => p.reserves);
  }

  // Grouped rows for the all-grouped mode.
  groupedRows(): Array<{ policyNumber: string; label: string; rows: Reserve[] }> {
    if (!(this.isSqueezed && this.viewMode() === 'all-grouped')) return [];
    return this.allPolicies.map(p => ({
      policyNumber: p.policyNumber,
      label: this.policyLabel(p.policyNumber),
      rows: p.reserves,
    }));
  }

  private policyLabel(policyNumber: string): string {
    const seed = this.reservesSvc.policySeeds().find(s => s.policyNumber === policyNumber);
    return seed?.policyLabel ?? policyNumber;
  }

  toggleExpand(reserveId: string): void {
    this.expandedRows.update(set => {
      const next = new Set(set);
      if (next.has(reserveId)) next.delete(reserveId);
      else next.add(reserveId);
      return next;
    });
  }

  isExpanded(reserveId: string): boolean {
    return this.expandedRows().has(reserveId);
  }

  reserveTypeLabel(type?: ReserveType): string {
    return type ? RESERVE_TYPE_LABELS[type] : '—';
  }

  trackByReserve(_: number, r: Reserve): string { return r.reserveId; }
}
