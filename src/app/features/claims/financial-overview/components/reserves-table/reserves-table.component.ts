import { Component, OnInit, input, output, signal } from '@angular/core';
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
import { BookingExplanationPanelComponent } from '../../../../../shared/components/booking-explanation-panel/booking-explanation-panel.component';
import { statusExplanation } from '../../../../../core/models/gg-booking.model';

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
    BookingExplanationPanelComponent
  ],
  templateUrl: './reserves-table.component.html',
  styleUrls: ['../fo-table-shared.scss', './reserves-table.component.scss']
})
export class ReservesTableComponent implements OnInit {
  readonly claimId = input.required<string>();
  readonly expandId = input<string | null>(null);
  readonly highlightId = input<string | null>(null);
  readonly rows = input.required<FinancialReserve[]>();
  readonly actionsDisabled = input(false);
  readonly updateReserve = output<FinancialReserve>();

  readonly expandedIds = signal<Set<string>>(new Set());

  /** "Peter Pane | PD": party, then the section's short code. */
  sectionLabel(r: FinancialReserve): string {
    return [r.party, r.sectionCode].filter(Boolean).join(' | ');
  }

  ngOnInit(): void {
    const id = this.expandId();
    if (id) this.expandedIds.set(new Set([id]));
  }

  explainable(r: FinancialReserve): boolean {
    return statusExplanation(r.status, r, 'reserve') !== null;
  }

  summary(r: FinancialReserve): string {
    return [
      `Reserve ${r.reserveId}`,
      r.party,
      `${r.currency} ${r.reserveValue.toLocaleString('en-US')}`,
      r.section
    ]
      .filter(Boolean)
      .join(' · ');
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
