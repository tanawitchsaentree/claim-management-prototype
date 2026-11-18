import { Component, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxLinkModule } from '@allianz/ng-aquila/link';
import { NxPopoverModule, NxPopoverTriggerDirective } from '@allianz/ng-aquila/popover';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { GgClaimProblem, GgProblemAction, GgProblemLine } from '../../../../core/models/gg-dashboard.model';
import { MockBookingService } from '../../../../core/mock/services/mock-booking.service';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { BookingLandingToastService } from '../../../../shared/utils/booking-landing-toast.service';
import {
  SendAgainDialogComponent,
  SendAgainDialogData
} from '../../../../shared/components/booking-explanation-panel/send-again-dialog.component';
import { ClaimNumberPipe } from '../../../../shared/pipes/claim-number.pipe';

type LinkAction = Extract<GgProblemAction, { kind: 'link' }>;

/**
 * Red triangle after the Claim ID in the Claims portfolio, with a popover
 * saying what broke in Global Genius and what to do (docs/ux/gg-dashboard.md,
 * DESIGN DECISION GG-DASH-2 in gg-dashboard.model.ts).
 */
@Component({
  selector: 'app-gg-claim-flag',
  standalone: true,
  imports: [RouterLink, NxIconModule, NxLinkModule, NxPopoverModule, ClaimNumberPipe],
  templateUrl: './gg-claim-flag.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './gg-claim-flag.component.scss'
})
export class GgClaimFlagComponent {
  private readonly booking = inject(MockBookingService);
  private readonly dialog = inject(NxDialogService);
  private readonly toast = inject(ToastService);
  private readonly landing = inject(BookingLandingToastService);

  readonly problem = input.required<GgClaimProblem>();

  asLink(a: GgProblemAction): LinkAction | null {
    return a.kind === 'link' ? a : null;
  }

  /** Same retry as the Claim Overview banner (gg-registration-banner.component.ts sendAgain). */
  retryClaim(trigger: NxPopoverTriggerDirective): void {
    trigger.close();
    this.booking.sendClaimAgain(this.problem().claimId);
    this.toast.info('Retrying in Global Genius', "We'll let you know when the claim is set up.");
  }

  /** Same confirm step and toasts as "Send again" on the Payments list (booking-explanation-panel.component.ts:59-76). */
  async retryItem(line: GgProblemLine, trigger: NxPopoverTriggerDirective): Promise<void> {
    const a = line.action;
    if (a.kind !== 'retry-item') return;
    trigger.close();
    const outcome = a.item === 'payment' ? "won't be paid twice" : "won't be booked twice";
    const ref = this.dialog.open(SendAgainDialogComponent, {
      data: {
        title: `Send this ${a.item} to Global Genius again?`,
        message: `${a.summary}. This sends the same ${a.item} again. It is not a new ${a.item} and ${outcome}.`
      } satisfies SendAgainDialogData,
      width: '480px',
      maxWidth: '92vw'
    });
    if (await firstValueFrom(ref.afterClosed())) {
      const claimId = this.problem().claimId;
      this.booking.sendItemAgain(claimId, a.item, a.id);
      this.toast.info('Sent again', "We'll let you know when it's booked.");
      this.landing.watch(claimId, a.item, a.id);
    }
  }
}
