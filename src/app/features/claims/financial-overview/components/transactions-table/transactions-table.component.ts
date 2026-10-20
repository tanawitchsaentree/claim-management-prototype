import { Component, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { FinancialTransaction } from '../../../../../core/models/financial-overview.model';

@Component({
  selector: 'app-fo-transactions-table',
  standalone: true,
  imports: [CurrencyPipe, NxTableModule],
  templateUrl: './transactions-table.component.html',
  styleUrls: ['../fo-table-shared.scss', './transactions-table.component.scss']
})
export class TransactionsTableComponent {
  readonly rows = input.required<FinancialTransaction[]>();
  readonly currency = input('EUR');
}
