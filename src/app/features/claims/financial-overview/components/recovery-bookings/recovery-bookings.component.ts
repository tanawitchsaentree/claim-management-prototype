import { Component, Input, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { FinancialRecovery } from '../../../../../core/models/financial-overview.model';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';

interface RecoveryGroup {
  party: string;
  rows: FinancialRecovery[];
  total: number;
}

@Component({
  selector: 'app-recovery-bookings',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, NxTableModule, NxButtonModule, EmptyStateComponent],
  templateUrl: './recovery-bookings.component.html',
  styleUrl: './recovery-bookings.component.scss',
})
export class RecoveryBookingsComponent {
  @Input({ required: true }) rows: FinancialRecovery[] = [];
  @Input({ required: true }) currency = 'EUR';

  readonly groupByParty = signal(false);

  toggleGroupByParty(): void {
    this.groupByParty.set(!this.groupByParty());
  }

  get groups(): RecoveryGroup[] {
    const groups = new Map<string, FinancialRecovery[]>();
    for (const r of this.rows) {
      const key = r.party || 'Unknown party';
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    return Array.from(groups.entries()).map(([party, groupRows]) => ({
      party,
      rows: groupRows,
      total: groupRows.reduce((sum, r) => sum + r.amount, 0),
    }));
  }
}
