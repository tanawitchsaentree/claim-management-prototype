import { Injectable, inject } from '@angular/core';
import { MockStateService } from '../state/mock-state.service';
import { FinancialOverview } from '../../models/financial-overview.model';
import { Bookable } from '../../models/gg-booking.model';
import { MockNotificationService } from './mock-notification.service';

// DESIGN DECISION GG-2 — "Send again" for a failed booking, and for a failed
// claim set-up in Global Genius. Re-sends the SAME item (no new payment, no
// re-approval). The real answer comes back asynchronously; the mock waits
// ANSWER_MS, then lands on the outcome the preset asked for
// (BookingIssue.demoResendOutcome / ClaimOverview.ggResendOutcome).

export type BookableKind = 'payment' | 'reserve' | 'recovery';

const ANSWER_MS = 3000;

const LIST: Record<BookableKind, 'payments' | 'reserves' | 'recoveries'> = {
  payment: 'payments',
  reserve: 'reserves',
  recovery: 'recoveries'
};

function idOf(kind: BookableKind, row: object): string {
  const r = row as Record<string, string>;
  return kind === 'payment' ? r['paymentId'] : kind === 'reserve' ? r['reserveId'] : r['recoveryId'];
}

@Injectable({ providedIn: 'root' })
export class MockBookingService {
  private readonly stateSvc = inject(MockStateService);
  private readonly notifySvc = inject(MockNotificationService);

  /** Only valid on a 'needs-fixing' row; anything else is ignored. */
  sendItemAgain(claimId: string, kind: BookableKind, id: string): void {
    const row = this.find(claimId, kind, id);
    if (row?.bookingStatus !== 'needs-fixing') return;
    const issue = row.bookingIssue;
    this.patchRow(claimId, kind, id, { bookingStatus: 'booking' });
    setTimeout(() => {
      const outcome = issue?.demoResendOutcome ?? 'booked';
      if (outcome === 'booked') {
        const view = kind === 'recovery' ? 'recovery' : `${kind}s`;
        this.notifySvc.push({
          id: `booked-${id}`,
          claimId,
          tone: 'done',
          title: `${claimId}: ${kind} ${id} is now booked`,
          link: ['/claims', claimId, 'financial'],
          queryParams: { view, expand: id }
        });
      }
      this.patchRow(
        claimId,
        kind,
        id,
        outcome === 'booked'
          ? { bookingStatus: 'booked', bookingIssue: undefined }
          : {
              bookingStatus: 'needs-fixing',
              bookingIssue: issue ? { ...issue, attempts: (issue.attempts ?? 1) + 1 } : undefined
            }
      );
    }, ANSWER_MS);
  }

  /** Claim-level re-trigger (BMPCC-20232). Only from 'failed'. */
  sendClaimAgain(claimId: string): void {
    const overview = this.stateSvc.state().overviews[claimId];
    if (overview?.ggRegistration !== 'failed') return;
    this.stateSvc.patchOverview(claimId, { ggRegistration: 'registering' });
    setTimeout(() => {
      const ok = (overview.ggResendOutcome ?? 'registered') === 'registered';
      this.stateSvc.patchOverview(claimId, { ggRegistration: ok ? 'registered' : 'failed' });
      if (ok) {
        this.notifySvc.push({
          id: `claim-ready-${claimId}`,
          claimId,
          tone: 'done',
          title: `${claimId} is now set up in Global Genius: payments and reserves can go ahead`,
          link: ['/claims', claimId, 'overview']
        });
      }
    }, ANSWER_MS);
  }

  private find(claimId: string, kind: BookableKind, id: string): Bookable | undefined {
    const fo = this.stateSvc.state().financialOverviews[claimId];
    return (fo?.[LIST[kind]] as object[] | undefined)?.find(r => idOf(kind, r) === id) as Bookable;
  }

  private patchRow(claimId: string, kind: BookableKind, id: string, patch: Partial<Bookable>): void {
    const fo = this.stateSvc.state().financialOverviews[claimId];
    if (!fo) return;
    const key = LIST[kind];
    const rows = (fo[key] as object[]).map(r => (idOf(kind, r) === id ? { ...r, ...patch } : r));
    this.stateSvc.patchFinancialOverview(claimId, { [key]: rows } as Partial<FinancialOverview>);
  }
}
