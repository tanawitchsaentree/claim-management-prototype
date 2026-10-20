import { Component, OnInit, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { FinancialRecovery } from '../../../core/models/financial-overview.model';
import { statusExplanation } from '../../../core/models/gg-booking.model';
import { BookingStatusPillComponent } from '../booking-status-pill/booking-status-pill.component';
import { BookingExplanationPanelComponent } from '../booking-explanation-panel/booking-explanation-panel.component';

/**
 * Recovery postings (money booked against a recovery), with their Global
 * Genius booking status. Shared by Financial > Recovery bookings and the
 * Recoveries page so one posting never shows two different statuses.
 */
@Component({
  selector: 'app-recovery-bookings-table',
  standalone: true,
  imports: [
    CurrencyPipe,
    NxTableModule,
    NxIconModule,
    NxButtonModule,
    BookingStatusPillComponent,
    BookingExplanationPanelComponent
  ],
  templateUrl: './recovery-bookings-table.component.html',
  styleUrl: './recovery-bookings-table.component.scss'
})
export class RecoveryBookingsTableComponent implements OnInit {
  readonly claimId = input.required<string>();
  readonly rows = input.required<FinancialRecovery[]>();
  readonly currency = input('EUR');
  /** Row to show expanded (and scrolled to) on first render. */
  readonly expandId = input<string | null>(null);

  readonly expandedIds = signal<Set<string>>(new Set());

  ngOnInit(): void {
    const id = this.expandId();
    if (id) this.expandedIds.set(new Set([id]));
  }

  explainable(r: FinancialRecovery): boolean {
    return statusExplanation(r.status, r, 'recovery') !== null;
  }

  summary(r: FinancialRecovery): string {
    return [
      `Recovery ${r.recoveryId}`,
      r.party,
      `${r.currency} ${r.amount.toLocaleString('en-US')}`,
      r.section
    ]
      .filter(Boolean)
      .join(' · ');
  }

  toggle(id: string): void {
    const s = new Set(this.expandedIds());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.expandedIds.set(s);
  }
}
