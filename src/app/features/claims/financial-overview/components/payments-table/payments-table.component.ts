import { Component, OnInit, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { FinancialPayment } from '../../../../../core/models/financial-overview.model';
import { BookingStatusPillComponent } from '../../../../../shared/components/booking-status-pill/booking-status-pill.component';
import { BookingIssuePanelComponent } from '../booking-issue-panel/booking-issue-panel.component';

@Component({
  selector: 'app-fo-payments-table',
  standalone: true,
  imports: [
    CurrencyPipe,
    NxTableModule,
    NxIconModule,
    NxButtonModule,
    BookingStatusPillComponent,
    BookingIssuePanelComponent
  ],
  templateUrl: './payments-table.component.html',
  styleUrl: '../fo-table-shared.scss'
})
export class PaymentsTableComponent implements OnInit {
  readonly rows = input.required<FinancialPayment[]>();
  readonly currency = input('EUR');
  /** Payment to show expanded on first render (link from a task). */
  readonly openId = input<string | null>(null);

  readonly expandedIds = signal<Set<string>>(new Set());

  ngOnInit(): void {
    const id = this.openId();
    if (id) this.expandedIds.set(new Set([id]));
  }

  needsFixing(p: FinancialPayment): boolean {
    return p.bookingStatus === 'needs-fixing' && !!p.bookingIssue;
  }

  toggle(id: string): void {
    const s = new Set(this.expandedIds());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.expandedIds.set(s);
  }
}
