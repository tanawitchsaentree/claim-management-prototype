import { Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { FinancialSectionSummaryRow } from '../../../../../core/models/financial-overview.model';

@Component({
  selector: 'app-fo-section-summary-table',
  standalone: true,
  imports: [DecimalPipe, NxTableModule],
  templateUrl: './section-summary-table.component.html',
  styleUrls: ['../fo-table-shared.scss', './section-summary-table.component.scss']
})
export class SectionSummaryTableComponent {
  readonly rows = input.required<FinancialSectionSummaryRow[]>();
}
