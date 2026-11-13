import { Injectable, computed, inject, signal } from '@angular/core';
import { MockStateService } from '../state/mock-state.service';
import { AuthService } from '../../services/auth';
import { Bookable, needsHandler, withFinance } from '../../models/gg-booking.model';
import { sectionCanRetry, sectionWithFinance } from '../../models/gg-section-booking.model';

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
  // BMPCC-22666: only this person sees it (claim reassigned to / away from
  // them). Unset = everyone, as before.
  recipient?: string;
}

@Injectable({ providedIn: 'root' })
export class MockNotificationService {
  private readonly stateSvc = inject(MockStateService);
  private readonly auth = inject(AuthService);
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
      // BMPCC-22350: the large loss threshold was reached. Shown until the
      // handler opens the Heads-Up (notified once, never repeated).
      const t = o.headsUp?.threshold;
      if (t && !t.seen) {
        out.push({
          id: `heads-up-${o.claimId}`,
          claimId: o.claimId,
          tone: 'action',
          title:
            t.notice === 'new-draft'
              ? `${o.claimId}: incurred reached 1M, a draft Heads-Up is ready for you to complete`
              : `${o.claimId}: incurred reached 1M, check the Heads-Up that already exists`,
          link: ['/claims', o.claimId, 'heads-up']
        });
      }
      // BMPCC-22661: failed section events (only once the claim is in GG,
      // same rule as the Claim Overview section banner).
      if (!o.ggRegistration || o.ggRegistration === 'registered') {
        for (const b of o.ggSectionBookings ?? []) {
          const name = st.sections.find(s => s.id === b.sectionId)?.name ?? b.sectionId;
          if (sectionCanRetry(b) || sectionWithFinance(b)) {
            out.push({
              id: `section-${b.sectionId}`,
              claimId: o.claimId,
              tone: sectionCanRetry(b) ? 'action' : 'info',
              title: sectionCanRetry(b)
                ? `${o.claimId}: section ${name} couldn't be booked in Global Genius`
                : `${o.claimId}: section ${name} couldn't be booked, the Finance team is fixing it`,
              link: ['/claims', o.claimId, 'overview']
            });
          }
        }
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

  // A "now booked" event is dropped while the same item is failing again
  // (review round 4: the bell showed one payment as both needs-you and done).
  readonly all = computed(() => {
    const live = this.live();
    const failing = new Set(live.map(n => n.id.replace(/^(item|claim|section)-/, '')));
    const me = this.auth.user().name;
    const events = this.events().filter(
      e =>
        (!e.recipient || e.recipient === me) &&
        !failing.has(e.id.replace(/^(booked|claim-ready|section-booked)-/, ''))
    );
    return [...live, ...events];
  });
  readonly actionCount = computed(() => this.all().filter(n => n.tone === 'action').length);

  push(n: AppNotification): void {
    this.events.update(list => [n, ...list.filter(x => x.id !== n.id)]);
  }

  dismiss(id: string): void {
    this.events.update(list => list.filter(x => x.id !== id));
  }
}
