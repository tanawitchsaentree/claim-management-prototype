import { Injectable, computed, inject } from '@angular/core';
import { MockStateService } from '../state/mock-state.service';
import { Bookable, canSendAgain, needsHandler, withFinance } from '../../models/gg-booking.model';
import { sectionCanRetry } from '../../models/gg-section-booking.model';
import { GgAttentionItem, GgDowntimeBanner } from '../../models/gg-dashboard.model';

// Dashboard "Global Genius: needs your action" list and the downtime banner
// (docs/ux/gg-dashboard.md, DESIGN DECISION GG-DASH-1 in gg-dashboard.model.ts).
// Same shape as MockRecoveryAttentionService (one list for the dashboard), but
// signals over state, as MockNotificationService, so a DEV banner Apply or a
// "Send again" elsewhere updates the list without a reload. Uses the same
// rules as the bell and the Financial Overview count (needsHandler /
// canSendAgain / sectionCanRetry), so the numbers never disagree.

interface Row {
  kind: 'payment' | 'reserve' | 'recovery';
  view: 'payments' | 'reserves' | 'recovery';
  id: string;
  status: string;
  what: string;
  item: Bookable;
}

const FIX_LABEL: Record<Row['kind'], string> = {
  payment: 'Fix payment',
  reserve: 'Fix reserve',
  recovery: 'Fix recovery'
};

/** GG's reason reads as the second half of the row sentence. */
function afterColon(reason: string): string {
  if (reason.startsWith('Global Genius')) return reason;
  return reason.charAt(0).toLowerCase() + reason.slice(1);
}

function waitingForGg(r: Row): boolean {
  return (
    r.item.bookingStatus === 'needs-fixing' &&
    r.item.bookingIssue?.cause === 'gg-unavailable' &&
    !r.item.bookingIssue.inFlight &&
    (needsHandler(r.status, r.item) || withFinance(r.status, r.item))
  );
}

@Injectable({ providedIn: 'root' })
export class MockGgAttentionService {
  private readonly stateSvc = inject(MockStateService);

  /** Approved items on every open claim, with the words the row needs. */
  private readonly rows = computed(() => {
    const st = this.stateSvc.state();
    const open = new Map(st.claims.filter(c => c.status !== 'Closed').map(c => [c.claimId, c]));
    return Object.values(st.financialOverviews)
      .filter(fo => open.has(fo.claimId))
      .map(fo => ({
        claimId: fo.claimId,
        rows: [
          ...fo.payments.map<Row>(p => ({ kind: 'payment', view: 'payments', id: p.paymentId, status: p.status, what: `Payment to ${p.payee}`, item: p })),
          ...fo.reserves.map<Row>(r => ({ kind: 'reserve', view: 'reserves', id: r.reserveId, status: r.status, what: `${r.reserveType} reserve for ${r.party}`, item: r })),
          ...fo.recoveries.map<Row>(r => ({ kind: 'recovery', view: 'recovery', id: r.recoveryId, status: r.status, what: `Recovery from ${r.party}`, item: r }))
        ]
      }));
  });

  readonly items = computed<GgAttentionItem[]>(() => {
    const st = this.stateSvc.state();
    const out: GgAttentionItem[] = [];
    for (const claim of st.claims) {
      if (claim.status === 'Closed') continue;
      const base = { claimId: claim.claimId, clientName: claim.clientName };
      const overviewLink = ['/claims', claim.claimId, 'overview'];
      const o = st.overviews[claim.claimId];
      // Claim not set up: the retry is on Claim Overview (critique 5). After
      // two failed retries Finance owns it, so it leaves the list.
      if (o?.ggRegistration === 'failed' && (o.ggResendFailures ?? 0) < 2) {
        out.push({ ...base, key: `claim-${claim.claimId}`, reason: 'Claim not set up in Global Genius: payments and reserves are on hold.', linkLabel: 'Retry on claim', link: overviewLink });
      }
      for (const r of this.rows().find(x => x.claimId === claim.claimId)?.rows ?? []) {
        if (!needsHandler(r.status, r.item) || !canSendAgain(r.item)) continue;
        if (r.item.bookingIssue?.cause === 'gg-unavailable') continue;
        const reason = afterColon(r.item.bookingIssue?.reason ?? 'Global Genius did not accept it.');
        out.push({ ...base, key: `${r.kind}-${r.id}`, reason: `${r.what} not booked: ${reason}`, linkLabel: FIX_LABEL[r.kind], link: ['/claims', claim.claimId, 'financial'], queryParams: { view: r.view, expand: r.id } });
      }
      // Section events only go to GG once the claim is in GG (as the bell).
      if (o && (!o.ggRegistration || o.ggRegistration === 'registered')) {
        for (const b of (o.ggSectionBookings ?? []).filter(sectionCanRetry)) {
          const name = st.sections.find(s => s.id === b.sectionId)?.name ?? b.sectionId;
          const reason = b.failureMessage ?? 'Global Genius did not accept it.';
          out.push({ ...base, key: `section-${b.sectionId}`, reason: `Section "${name}" not booked: ${reason}`, linkLabel: 'Retry on claim', link: overviewLink });
        }
      }
    }
    return out;
  });

  /** Before / during downtime. Gone = no ggDowntime in state = no banner. */
  readonly banner = computed<GgDowntimeBanner | null>(() => {
    const d = this.stateSvc.state().ggDowntime;
    if (!d) return null;
    if (d.phase === 'during') {
      const waiting = this.rows().reduce((n, c) => n + c.rows.filter(waitingForGg).length, 0);
      return { phase: 'during', waiting };
    }
    const day = new Date();
    day.setDate(day.getDate() + d.inDays);
    return { phase: 'planned', date: day.toISOString().split('T')[0], from: d.from, to: d.to };
  });
}
