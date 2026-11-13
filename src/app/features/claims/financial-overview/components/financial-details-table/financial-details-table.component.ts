import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { FinancialDetails } from '../../../../../core/models/financial-overview.model';

/** The "Financial details" table (Gross / Gross net / Net) of the claim-level overview. */
@Component({
  selector: 'app-fo-financial-details-table',
  standalone: true,
  imports: [CurrencyPipe, NxTableModule],
  templateUrl: './financial-details-table.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: '../fo-table-shared.scss'
})
export class FinancialDetailsTableComponent {
  readonly rows = input.required<FinancialDetails['rows']>();
  readonly currency = input('EUR');
}
