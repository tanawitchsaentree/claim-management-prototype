import { Injectable, computed, inject, signal } from '@angular/core';
import { MockStateService } from '../state/mock-state.service';

// Navbar bell. Usability review, top issue: booking failures happen hours or
// days after Submit, while the handler is on another claim, so a status on a
// page they don't have open is not visibility. Two sources:
// - live: every claim that isn't set up in GG and every item that couldn't be
//   booked, derived from state (always current, nothing to keep in sync);
// - events: things that changed and are now fine ("now booked"), pushed by
//   MockBookingService, so the handler hears about fixes too.

export interface AppNotification {
  id: string;
  claimId: string;
  tone: 'action' | 'done';
  title: string;
  // Router link + query params to the exact row / banner.
  link: string[];
  queryParams?: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class MockNotificationService {
  private readonly stateSvc = inject(MockStateService);
  private readonly events = signal<AppNotification[]>([]);

  private readonly live = computed<AppNotification[]>(() => {
    const st = this.stateSvc.state();
    const out: AppNotification[] = [];
    for (const o of Object.values(st.overviews)) {
      if (o.ggRegistration === 'failed' || o.ggRegistration === 'policy-missing') {
        out.push({
          id: `claim-${o.claimId}`,
          claimId: o.claimId,
          tone: 'action',
          title: `${o.claimId}: payments and reserves are on hold (claim not in Global Genius)`,
          link: ['/claims', o.claimId, 'overview']
        });
      }
    }
    for (const fo of Object.values(st.financialOverviews)) {
      const rows: { kind: string; view: string; id: string; failed: boolean }[] = [
        ...fo.payments.map(p => ({ kind: 'Payment', view: 'payments', id: p.paymentId, failed: p.bookingStatus === 'needs-fixing' })),
        ...fo.reserves.map(r => ({ kind: 'Reserve', view: 'reserves', id: r.reserveId, failed: r.bookingStatus === 'needs-fixing' })),
        ...fo.recoveries.map(r => ({ kind: 'Recovery', view: 'recovery', id: r.recoveryId, failed: r.bookingStatus === 'needs-fixing' }))
      ];
      for (const r of rows.filter(x => x.failed)) {
        out.push({
          id: `item-${r.id}`,
          claimId: fo.claimId,
          tone: 'action',
          title: `${fo.claimId}: ${r.kind} ${r.id} couldn't be booked`,
          link: ['/claims', fo.claimId, 'financial'],
          queryParams: { view: r.view, expand: r.id }
        });
      }
    }
    return out;
  });

  readonly all = computed(() => [...this.live(), ...this.events()]);
  readonly actionCount = computed(() => this.live().length);

  push(n: AppNotification): void {
    this.events.update(list => [n, ...list.filter(x => x.id !== n.id)]);
  }

  dismiss(id: string): void {
    this.events.update(list => list.filter(x => x.id !== id));
  }
}
