import { Component, input, signal, effect, untracked } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { FinancialPayment } from '../../../../../core/models/financial-overview.model';
import { BookingStatusPillComponent } from '../../../../../shared/components/booking-status-pill/booking-status-pill.component';
import { BookingExplanationPanelComponent } from '../../../../../shared/components/booking-explanation-panel/booking-explanation-panel.component';
import { statusExplanation } from '../../../../../core/models/gg-booking.model';

@Component({
  selector: 'app-fo-payments-table',
  standalone: true,
  imports: [
    CurrencyPipe,
    NxTableModule,
    NxIconModule,
    NxButtonModule,
    BookingStatusPillComponent,
    BookingExplanationPanelComponent
  ],
  templateUrl: './payments-table.component.html',
  styleUrl: '../fo-table-shared.scss'
})
export class PaymentsTableComponent {
  readonly rows = input.required<FinancialPayment[]>();
  readonly currency = input('EUR');
  readonly claimId = input.required<string>();
  /** Payment to show expanded on first render (DEV banner, task link). */
  readonly expandId = input<string | null>(null);
  /** Payment to highlight (just submitted). */
  readonly highlightId = input<string | null>(null);

  readonly expandedIds = signal<Set<string>>(new Set());

  constructor() {
    // The DEV banner can change only the query (next AC on the same page): follow it.
    effect(() => {
      const id = this.expandId();
      if (id) untracked(() => this.expandedIds.set(new Set([id])));
    });
  }

  explainable(p: FinancialPayment): boolean {
    return statusExplanation(p.status, p, 'payment') !== null;
  }

  summary(p: FinancialPayment): string {
    return [
      `Payment ${p.paymentId}`,
      p.payee,
      `${p.currency} ${p.amount.toLocaleString('en-US')}`,
      p.sectionType
    ].join(' · ');
  }

  toggle(id: string): void {
    const s = new Set(this.expandedIds());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.expandedIds.set(s);
  }
}
