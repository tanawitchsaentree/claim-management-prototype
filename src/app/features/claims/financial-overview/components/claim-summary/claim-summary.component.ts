import { Component, computed, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NxTableModule } from '@allianz/ng-aquila/table';
import {
  FinancialDetails,
  FinancialSummary
} from '../../../../../core/models/financial-overview.model';

/** The five KPI cards and the "Financial details" table of the claim-level overview. */
@Component({
  selector: 'app-fo-claim-summary',
  standalone: true,
  imports: [CurrencyPipe, NxTableModule],
  templateUrl: './claim-summary.component.html',
  styleUrls: ['../fo-table-shared.scss', './claim-summary.component.scss']
})
export class ClaimSummaryComponent {
  readonly summary = input.required<FinancialSummary>();
  readonly details = input.required<FinancialDetails>();
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
