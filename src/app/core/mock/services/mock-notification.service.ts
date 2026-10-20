import { Injectable, computed, inject, signal } from '@angular/core';
import { MockStateService } from '../state/mock-state.service';
import { Bookable, needsHandler, withFinance } from '../../models/gg-booking.model';

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
  // action = needs you; info = someone else is on it; done = fixed.
  tone: 'action' | 'info' | 'done';
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
        const canRetry = o.ggRegistration === 'failed' && (o.ggResendFailures ?? 0) < 2;
        out.push({
          id: `claim-${o.claimId}`,
          claimId: o.claimId,
          tone: canRetry ? 'action' : 'info',
          title: `${o.claimId}: payments and reserves are on hold (claim not in Global Genius)`,
          link: ['/claims', o.claimId, 'overview']
        });
      }
    }
    // Same rules as the list counts and the Financial Overview line
    // (needsHandler / withFinance), so the bell never disagrees with them.
    for (const fo of Object.values(st.financialOverviews)) {
      const rows: { kind: string; view: string; id: string; status: string; item: Bookable }[] = [
        ...fo.payments.map(p => ({ kind: 'Payment', view: 'payments', id: p.paymentId, status: p.status, item: p })),
        ...fo.reserves.map(r => ({ kind: 'Reserve', view: 'reserves', id: r.reserveId, status: r.status, item: r })),
        ...fo.recoveries.map(r => ({ kind: 'Recovery', view: 'recovery', id: r.recoveryId, status: r.status, item: r }))
      ];
      for (const r of rows) {
        const link = ['/claims', fo.claimId, 'financial'];
        const queryParams = { view: r.view, expand: r.id };
        if (r.status === 'Requires amendment') {
          out.push({ id: `item-${r.id}`, claimId: fo.claimId, tone: 'action', title: `${fo.claimId}: ${r.kind} ${r.id} was sent back to you by the approver`, link, queryParams });
        } else if (r.status === 'Rejected') {
          // Review round 3: a rejection is the handler's to close, not "someone else is on it".
          out.push({ id: `item-${r.id}`, claimId: fo.claimId, tone: 'action', title: `${fo.claimId}: ${r.kind} ${r.id} was rejected by the approver: let the payee know`, link, queryParams });
        } else if (needsHandler(r.status, r.item)) {
          out.push({ id: `item-${r.id}`, claimId: fo.claimId, tone: 'action', title: `${fo.claimId}: ${r.kind} ${r.id} couldn't be booked and needs you`, link, queryParams });
        } else if (withFinance(r.status, r.item)) {
          out.push({ id: `item-${r.id}`, claimId: fo.claimId, tone: 'info', title: `${fo.claimId}: ${r.kind} ${r.id} couldn't be booked, the Finance team is fixing it`, link, queryParams });
        }
      }
    }
    return out;
  });

  readonly all = computed(() => [...this.live(), ...this.events()]);
  readonly actionCount = computed(() => this.live().filter(n => n.tone === 'action').length);

  push(n: AppNotification): void {
    this.events.update(list => [n, ...list.filter(x => x.id !== n.id)]);
  }

  dismiss(id: string): void {
    this.events.update(list => list.filter(x => x.id !== id));
  }
}
