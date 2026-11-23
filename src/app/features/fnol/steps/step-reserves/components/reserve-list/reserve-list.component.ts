import {
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import {
  Reserve,
  RESERVE_TYPES,
  RESERVE_TYPE_LABELS,
  ReserveType
} from '../../../../../../core/models/reserve.model';

/**
 * One claim's reserve lines. Each line shows its total first, then one row
 * per reserve type, as production's table (ReservesPage.ts
 * verifyReserveValuesInTable: total row, then Indemnity, Expense, Recovery).
 * Tree rows copy BLESSED.md "Tree child rows in a table". Lines start open so
 * the breakdown is in view right after the editor closes.
 */
@Component({
  selector: 'app-reserve-list',
  standalone: true,
  imports: [DecimalPipe, NxIconModule, NxButtonModule, NxTableModule, NxContextMenuModule],
  templateUrl: './reserve-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './reserve-list.component.scss'
})
export class ReserveListComponent {
  @Input({ required: true }) rows: Reserve[] = [];

  @Output() editRequested = new EventEmitter<Reserve>();
  @Output() removeRequested = new EventEmitter<Reserve>();

  readonly typeLabels = RESERVE_TYPE_LABELS;
  readonly subTypes = RESERVE_TYPES;
  private readonly collapsed = signal<Set<string>>(new Set());

  toggleExpand(reserveId: string): void {
    this.collapsed.update(set => {
      const next = new Set(set);
      if (next.has(reserveId)) next.delete(reserveId);
      else next.add(reserveId);
      return next;
    });
  }

  isExpanded(reserveId: string): boolean {
    return !this.collapsed().has(reserveId);
  }

  // Recoveries are shown as minus: they reduce the total.
  typeAmount(reserve: Reserve, type: ReserveType): number {
    const v = reserve.subAmounts?.[type] ?? 0;
    return type === 'recoveries' ? -v : v;
  }
}
