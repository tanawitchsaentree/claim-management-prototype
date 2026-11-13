import { Injectable, inject } from '@angular/core';
import { MockStateService } from '../state/mock-state.service';
import { FinancialOverview } from '../../models/financial-overview.model';
import { Bookable } from '../../models/gg-booking.model';
import { MockNotificationService } from './mock-notification.service';
import { GgSectionBooking, sectionCanRetry } from '../../models/gg-section-booking.model';
import { ToastService } from '../../../shared/components/toast/toast.service';

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
  private readonly toast = inject(ToastService);

  // A resend in flight is saved with an `inFlight` marker, so a page reload
  // during the wait (the timer is lost) resolves it on the next start
  // instead of leaving the row on "Booking in progress" forever.
  constructor() {
    const st = this.stateSvc.state();
    for (const fo of Object.values(st.financialOverviews)) {
      for (const kind of ['payment', 'reserve', 'recovery'] as BookableKind[]) {
        for (const row of fo[LIST[kind]] as (Bookable & object)[]) {
          if (row.bookingStatus === 'booking' && row.bookingIssue?.inFlight) {
            this.resolveItem(fo.claimId, kind, idOf(kind, row));
          }
        }
      }
    }
    for (const o of Object.values(st.overviews)) {
      if (o.ggRegistration === 'registering' && o.ggResendInFlight) this.resolveClaim(o.claimId);
      for (const b of o.ggSectionBookings ?? []) {
        if (b.status === 'retrying') this.resolveSection(o.claimId, b.sectionId);
      }
    }
  }

  /** Section event re-trigger (BMPCC-22661 AC02). Only from a retryable 'failed'. */
  sendSectionAgain(claimId: string, sectionId: string): void {
    const b = this.sectionBooking(claimId, sectionId);
    if (!b || !sectionCanRetry(b)) return;
    this.patchSection(claimId, sectionId, { status: 'retrying' });
    setTimeout(() => this.resolveSection(claimId, sectionId), ANSWER_MS);
  }

  private resolveSection(claimId: string, sectionId: string): void {
    const b = this.sectionBooking(claimId, sectionId);
    if (b?.status !== 'retrying') return;
    const ok = (b.demoResendOutcome ?? 'booked') === 'booked';
    const name = this.sectionName(sectionId);
    this.patchSection(
      claimId,
      sectionId,
      ok ? { status: 'booked', failureMessage: undefined } : { status: 'failed', retryFailures: (b.retryFailures ?? 0) + 1 }
    );
    if (ok) {
      this.toast.success(`${name} is now booked in Global Genius`);
      this.notifySvc.push({
        id: `section-booked-${sectionId}`,
        claimId,
        tone: 'done',
        title: `${claimId}: section ${name} is now booked in Global Genius`,
        link: ['/claims', claimId, 'overview']
      });
    } else {
      this.toast.error(`${name} still couldn't be booked`, 'The message from Global Genius is on Claim Overview.');
    }
  }

  private sectionBooking(claimId: string, sectionId: string): GgSectionBooking | undefined {
    return this.stateSvc.state().overviews[claimId]?.ggSectionBookings?.find(b => b.sectionId === sectionId);
  }

  private sectionName(sectionId: string): string {
    return this.stateSvc.state().sections.find(s => s.id === sectionId)?.name ?? sectionId;
  }

  private patchSection(claimId: string, sectionId: string, patch: Partial<GgSectionBooking>): void {
    const list = this.stateSvc.state().overviews[claimId]?.ggSectionBookings ?? [];
    this.stateSvc.patchOverview(claimId, {
      ggSectionBookings: list.map(b => (b.sectionId === sectionId ? { ...b, ...patch } : b))
    });
  }

  /** Only valid on a 'needs-fixing' row; anything else is ignored. */
  sendItemAgain(claimId: string, kind: BookableKind, id: string): void {
    const row = this.find(claimId, kind, id);
    if (row?.bookingStatus !== 'needs-fixing') return;
    this.patchRow(claimId, kind, id, {
      bookingStatus: 'booking',
      bookingIssue: row.bookingIssue ? { ...row.bookingIssue, inFlight: true } : undefined
    });
    setTimeout(() => this.resolveItem(claimId, kind, id), ANSWER_MS);
  }

  /** Claim-level re-trigger (BMPCC-20232). Only from 'failed'. */
  sendClaimAgain(claimId: string): void {
    const overview = this.stateSvc.state().overviews[claimId];
    if (overview?.ggRegistration !== 'failed') return;
    this.stateSvc.patchOverview(claimId, { ggRegistration: 'registering', ggResendInFlight: true });
    setTimeout(() => this.resolveClaim(claimId), ANSWER_MS);
  }

  private resolveItem(claimId: string, kind: BookableKind, id: string): void {
    const row = this.find(claimId, kind, id);
    const issue = row?.bookingIssue;
    if (row?.bookingStatus !== 'booking' || !issue?.inFlight) return;
    const outcome = issue.demoResendOutcome ?? 'booked';
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
            bookingIssue: { ...issue, inFlight: false, attempts: (issue.attempts ?? 1) + 1 }
          }
    );
  }

  private resolveClaim(claimId: string): void {
    const overview = this.stateSvc.state().overviews[claimId];
    if (overview?.ggRegistration !== 'registering' || !overview.ggResendInFlight) return;
    const ok = (overview.ggResendOutcome ?? 'registered') === 'registered';
    this.stateSvc.patchOverview(claimId, {
      ggRegistration: ok ? 'registered' : 'failed',
      ggResendInFlight: false,
      ggResendFailures: ok ? 0 : (overview.ggResendFailures ?? 0) + 1,
      // AC03 (BMPCC-22661): a successful outcome clears the failure message.
      ...(ok ? { ggFailureMessage: undefined } : {})
    });
    if (ok) {
      this.notifySvc.push({
        id: `claim-ready-${claimId}`,
        claimId,
        tone: 'done',
        title: `${claimId} is now set up in Global Genius: payments and reserves can go ahead`,
        link: ['/claims', claimId, 'overview']
      });
    }
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
