import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NxCardModule } from '@allianz/ng-aquila/card';
import { FinancialSummary, SummaryKpi } from '../../../core/models/financial-overview.model';

/**
 * Row of summary cards. Financial overview passes `summary` (its five claim-level
 * figures); other pages (Recoveries) pass their own `items`.
 * The "Financial details" table is app-fo-financial-details-table.
 */
@Component({
  selector: 'app-fo-claim-summary',
  standalone: true,
  imports: [CurrencyPipe, NxCardModule],
  templateUrl: './claim-summary.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './claim-summary.component.scss'
})
export class ClaimSummaryComponent {
  readonly summary = input<FinancialSummary>();
  readonly items = input<SummaryKpi[]>();
  readonly currency = input('EUR');

  readonly kpis = computed<SummaryKpi[]>(() => {
    const items = this.items();
    if (items) return items;
    const s = this.summary();
    if (!s) return [];
    return [
      { label: 'Outstanding reserves', value: s.outstandingReserves },
      { label: 'Completed payments', value: s.completedPayments },
      { label: 'Pending payments', value: s.pendingPayments },
      { label: 'Recoveries', value: s.recoveries },
      { label: 'Incurred', value: s.incurred }
    ];
  });
}
