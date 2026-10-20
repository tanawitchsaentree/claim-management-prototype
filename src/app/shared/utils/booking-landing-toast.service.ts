import { Injectable, Injector, effect, inject } from '@angular/core';
import { MockStateService } from '../../core/mock/state/mock-state.service';
import { BookableKind } from '../../core/mock/services/mock-booking.service';
import { effectiveOwner } from '../../core/models/gg-booking.model';
import { ToastService } from '../components/toast/toast.service';

const LIST = { payment: 'payments', reserve: 'reserves', recovery: 'recoveries' } as const;
const ID = { payment: 'paymentId', reserve: 'reserveId', recovery: 'recoveryId' } as const;

/**
 * After "Send again" the answer comes back later. Watch the item in state (not a
 * timer) and tell the handler when it lands, on whatever page they are on.
 */
@Injectable({ providedIn: 'root' })
export class BookingLandingToastService {
  private readonly state = inject(MockStateService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);

  watch(claimId: string, kind: BookableKind, id: string): void {
    const label = `${kind.charAt(0).toUpperCase()}${kind.slice(1)} ${id}`;
    let sentAgain = false;
    const ref = effect(
      () => {
        const fo = this.state.state().financialOverviews[claimId];
        const rows = (fo?.[LIST[kind]] ?? []) as unknown as Record<string, unknown>[];
        const row = rows.find(r => r[ID[kind]] === id) as
          | { bookingStatus?: string; bookingIssue?: Parameters<typeof effectiveOwner>[0] & { inFlight?: boolean } }
          | undefined;
        if (!row) return;
        if (row.bookingIssue?.inFlight || row.bookingStatus === 'booking') {
          sentAgain = true;
          return;
        }
        if (!sentAgain) return;
        if (row.bookingStatus === 'booked') this.toast.success(`${label} is now booked`);
        else if (row.bookingStatus === 'needs-fixing') {
          const finance = effectiveOwner(row.bookingIssue) === 'finance';
          this.toast.warning(
            `${label} still couldn't be booked`,
            finance ? "It's now with the Finance team." : undefined
          );
        }
        ref.destroy();
      },
      { injector: this.injector, manualCleanup: true }
    );
  }
}
