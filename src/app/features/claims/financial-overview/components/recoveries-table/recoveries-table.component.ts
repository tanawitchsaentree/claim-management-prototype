import { Component, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { FinancialRecovery } from '../../../../../core/models/financial-overview.model';
import { BookingStatusPillComponent } from '../../../../../shared/components/booking-status-pill/booking-status-pill.component';

@Component({
  selector: 'app-fo-recoveries-table',
  standalone: true,
  imports: [CurrencyPipe, NxTableModule, BookingStatusPillComponent],
  templateUrl: './recoveries-table.component.html',
  styleUrl: '../fo-table-shared.scss'
})
export class RecoveriesTableComponent {
  readonly rows = input.required<FinancialRecovery[]>();
  readonly currency = input('EUR');
}
