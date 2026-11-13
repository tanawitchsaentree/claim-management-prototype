import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FinancialSummary } from '../../../../../core/models/financial-overview.model';

/** The five KPI cards of the claim-level overview. The "Financial details" table is app-fo-financial-details-table. */
@Component({
  selector: 'app-fo-claim-summary',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './claim-summary.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './claim-summary.component.scss'
})
export class ClaimSummaryComponent {
  readonly summary = input.required<FinancialSummary>();
  readonly currency = input('EUR');

  readonly kpis = computed(() => {
    const s = this.summary();
    return [
      { label: 'Outstanding reserves', value: s.outstandingReserves },
      { label: 'Completed payments', value: s.completedPayments },
      { label: 'Pending payments', value: s.pendingPayments },
      { label: 'Recoveries', value: s.recoveries },
      { label: 'Incurred', value: s.incurred }
    ];
  });
}
