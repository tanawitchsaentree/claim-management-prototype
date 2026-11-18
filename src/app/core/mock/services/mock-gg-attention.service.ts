import { Injectable, computed, inject } from '@angular/core';
import { MockStateService } from '../state/mock-state.service';
import { Bookable, canSendAgain, needsHandler, withFinance } from '../../models/gg-booking.model';
import { sectionCanRetry, sectionWithFinance } from '../../models/gg-section-booking.model';
import {
  GgClaimProblem,
  GgDowntimeBanner,
  GgProblemLine
} from '../../models/gg-dashboard.model';

// Global Genius problems per claim for the Claims portfolio triangle + popover,
// and the downtime banner (docs/ux/gg-dashboard.md, DESIGN DECISION GG-DASH-2
// in gg-dashboard.model.ts). Signals over state, as MockNotificationService,
// so a DEV banner Apply or a "Send again" elsewhere updates the dashboard
// without a reload. Same rules as the bell and the Financial Overview count
// (needsHandler / canSendAgain / withFinance / sectionCanRetry), so the
// numbers never disagree.

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

const FINANCE_LINE = 'with Finance, nothing for you to do.';

/** GG's reason reads as the second half of the line. */
function afterColon(reason: string): string {
  if (reason.startsWith('Global Genius')) return reason;
  return reason.charAt(0).toLowerCase() + reason.slice(1);
}

function ggUnavailable(r: Row): boolean {
  return r.item.bookingStatus === 'needs-fixing' && r.item.bookingIssue?.cause === 'gg-unavailable';
}

function waitingForGg(r: Row): boolean {
  return (
    ggUnavailable(r) &&
    !r.item.bookingIssue?.inFlight &&
    (needsHandler(r.status, r.item) || withFinance(r.status, r.item))
  );
}

/** One popover line for a payment / reserve / recovery, or null if it is fine. */
function itemLine(claimId: string, r: Row): GgProblemLine | null {
  const key = `${r.kind}-${r.id}`;
  if (withFinance(r.status, r.item)) {
    return { key, text: `${r.what} not booked: ${FINANCE_LINE}`, action: { kind: 'none' } };
  }
  if (!needsHandler(r.status, r.item) || !canSendAgain(r.item)) return null;
  const text = `${r.what} not booked: ${afterColon(r.item.bookingIssue?.reason ?? 'Global Genius did not accept it.')}`;
  if (ggUnavailable(r)) {
    return { key, text, action: { kind: 'retry-item', item: r.kind, id: r.id, summary: r.what } };
  }
  return {
    key,
    text,
    action: { kind: 'link', label: FIX_LABEL[r.kind], link: ['/claims', claimId, 'financial'], queryParams: { view: r.view, expand: r.id } }
  };
}

@Injectable({ providedIn: 'root' })
export class MockGgAttentionService {
  private readonly stateSvc = inject(MockStateService);

  /** Approved items on every open claim, with the words the line needs. */
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

  /** Claims with a GG problem, by claim id. Claims without one are absent. */
  readonly problems = computed<Record<string, GgClaimProblem>>(() => {
    const st = this.stateSvc.state();
    // Change 4: while GG is down, items it couldn't take wait for it: no triangle.
    const ggDown = st.ggDowntime?.phase === 'during';
    const out: Record<string, GgClaimProblem> = {};
    for (const claim of st.claims) {
      if (claim.status === 'Closed') continue;
      const o = st.overviews[claim.claimId];
      const setupFailed = o?.ggRegistration === 'failed';
      const lines: GgProblemLine[] = [];
      for (const r of this.rows().find(x => x.claimId === claim.claimId)?.rows ?? []) {
        if (ggDown && ggUnavailable(r)) continue;
        const line = itemLine(claim.claimId, r);
        if (line) lines.push(line);
      }
      // Section events only go to GG once the claim is in GG (as the bell).
      if (o && (!o.ggRegistration || o.ggRegistration === 'registered')) {
        for (const b of o.ggSectionBookings ?? []) {
          const name = st.sections.find(s => s.id === b.sectionId)?.name ?? b.sectionId;
          const key = `section-${b.sectionId}`;
          if (sectionWithFinance(b)) {
            lines.push({ key, text: `Section "${name}" not booked: ${FINANCE_LINE}`, action: { kind: 'none' } });
          } else if (sectionCanRetry(b)) {
            const reason = b.failureMessage ?? 'Global Genius did not accept it.';
            lines.push({ key, text: `Section "${name}" not booked: ${reason}`, action: { kind: 'link', label: 'Retry on claim', link: ['/claims', claim.claimId, 'overview'] } });
          }
        }
      }
      if (!setupFailed && !lines.length) continue;
      out[claim.claimId] = {
        claimId: claim.claimId,
        setupFailed,
        rootCause: setupFailed ? o?.ggFailureMessage?.trim().replace(/\.$/, '') : undefined,
        setupWithFinance: setupFailed && (o?.ggResendFailures ?? 0) >= 2,
        lines
      };
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
