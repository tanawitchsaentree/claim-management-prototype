import { Component, input, output, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import {
  FinancialReserve,
  FinancialReserveWithHistory
} from '../../../../../core/models/financial-overview.model';
import { BookingStatusPillComponent } from '../../../../../shared/components/booking-status-pill/booking-status-pill.component';
import { BookingIssuePanelComponent } from '../booking-issue-panel/booking-issue-panel.component';

@Component({
  selector: 'app-fo-reserves-table',
  standalone: true,
  imports: [
    CurrencyPipe,
    NxTableModule,
    NxButtonModule,
    NxIconModule,
    NxTooltipModule,
    NxContextMenuModule,
    BookingStatusPillComponent,
    BookingIssuePanelComponent
  ],
  templateUrl: './reserves-table.component.html',
  styleUrls: ['../fo-table-shared.scss', './reserves-table.component.scss']
})
export class ReservesTableComponent {
  readonly rows = input.required<FinancialReserve[]>();
  readonly actionsDisabled = input(false);
  readonly updateReserve = output<FinancialReserve>();

  readonly expandedIds = signal<Set<string>>(new Set());

  /** "Peter Pane | PD": party, then the section's short code. */
  sectionLabel(r: FinancialReserve): string {
    return [r.party, r.sectionCode].filter(Boolean).join(' | ');
  }

  history(r: FinancialReserve): FinancialReserveWithHistory['history'] {
    return (r as FinancialReserveWithHistory).history;
  }

  toggle(id: string): void {
    const s = new Set(this.expandedIds());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.expandedIds.set(s);
  }
}
