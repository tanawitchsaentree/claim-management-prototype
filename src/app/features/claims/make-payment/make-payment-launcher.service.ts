import { Injectable, inject } from '@angular/core';
import { NavigationEnd, NavigationSkipped, ParamMap, Router } from '@angular/router';
import { NxDialogService, NxModalRef } from '@allianz/ng-aquila/modal';
import { filter, firstValueFrom, of, take, timeout } from 'rxjs';
import type { MakePaymentModalComponent, MakePaymentModalData } from './make-payment-modal.component';

/** What can be pre-filled, as in the link: ?section=&type=&payee=&amount=&currency=&premiumMode=&confirm=1&edit=<paymentId> */
export type MakePaymentPrefill = Partial<
  Record<'section' | 'type' | 'payee' | 'amount' | 'currency' | 'premiumMode' | 'confirm' | 'edit', string>
>;

/**
 * Opens the Make Payment sheet. From a button: `launcher.open(claimId)` or
 * `launcher.open(claimId, { edit: '123456-5' })`. A second call closes the
 * first sheet and opens a fresh one with the new pre-fill.
 */
@Injectable({ providedIn: 'root' })
export class MakePaymentLauncher {
  private readonly dialogSvc = inject(NxDialogService);
  private readonly router = inject(Router);
  private current: NxModalRef<MakePaymentModalComponent> | null = null;

  async open(claimId: string, prefill: MakePaymentPrefill = {}): Promise<void> {
    if (this.current) {
      const old = this.current;
      old.close();
      await firstValueFrom(old.afterClosed());
    }
    // Loaded on first use: the sheet is big and most visits never open it.
    const { MakePaymentModalComponent: Sheet } = await import('./make-payment-modal.component');
    const ref = this.dialogSvc.open(Sheet, {
      data: { claimId, prefill } satisfies MakePaymentModalData,
      panelClass: 'bottom-sheet-modal-panel',
      showCloseIcon: false
    });
    this.current = ref;
    void firstValueFrom(ref.afterClosed()).then(() => {
      if (this.current === ref) this.current = null;
    });
  }

  /** For the deep link: open once the redirect to the Payments list has settled. */
  openAfterNavigation(claimId: string, q: ParamMap): void {
    const prefill: MakePaymentPrefill = {};
    for (const key of ['section', 'type', 'payee', 'amount', 'currency', 'premiumMode', 'confirm', 'edit'] as const) {
      const v = q.get(key);
      if (v) prefill[key] = v;
    }
    firstValueFrom(
      this.router.events.pipe(
        filter(e => e instanceof NavigationEnd || e instanceof NavigationSkipped),
        take(1),
        timeout({ first: 2000, with: () => of(null) })
      )
    ).then(() => this.open(claimId, prefill));
  }
}
