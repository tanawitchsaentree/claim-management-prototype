import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { Bookable, canSendAgain, statusExplanation } from '../../../core/models/gg-booking.model';
import { BookableKind, MockBookingService } from '../../../core/mock/services/mock-booking.service';
import { ToastService } from '../toast/toast.service';
import { BookingLandingToastService } from '../../utils/booking-landing-toast.service';
import { SendAgainDialogComponent, SendAgainDialogData } from './send-again-dialog.component';

const WHO_LINE: Record<'finance' | 'approver' | 'nobody', string> = {
  finance: 'The Finance team is fixing it. There is nothing for you to do.',
  approver: 'This is waiting for the approver.',
  nobody: 'There is nothing for you to do.'
};

/**
 * Expand-row content for any payment / reserve / recovery that isn't
 * self-evident: why, who acts, and (only for "Couldn't be booked") the
 * "Send again" button with its confirm step (DESIGN DECISION GG-2).
 * Used by the Payments, Reserves and Recovery lists and the Recoveries page,
 * so a status never reads differently in two places.
 */
@Component({
  selector: 'app-booking-explanation-panel',
  standalone: true,
  imports: [RouterLink, NxButtonModule],
  templateUrl: './booking-explanation-panel.component.html',
  styleUrl: './booking-explanation-panel.component.scss'
})
export class BookingExplanationPanelComponent {
  private readonly dialog = inject(NxDialogService);
  private readonly booking = inject(MockBookingService);
  private readonly toast = inject(ToastService);
  private readonly landing = inject(BookingLandingToastService);

  readonly claimId = input.required<string>();
  readonly kind = input.required<BookableKind>();
  readonly itemId = input.required<string>();
  readonly approvalStatus = input.required<string>();
  readonly item = input.required<Bookable>();
  /** One line that identifies the item again in the confirm step. */
  readonly summary = input.required<string>();

  readonly explanation = computed(() =>
    statusExplanation(this.approvalStatus(), this.item(), this.kind())
  );
  readonly whoLine = computed(() => {
    const who = this.explanation()?.whoActs;
    return who && who !== 'you' ? WHO_LINE[who] : null;
  });
  readonly sendAgain = computed(() => canSendAgain(this.item()));
  readonly canResubmit = computed(() => this.kind() === 'payment' && this.approvalStatus() === 'Requires amendment');
  readonly taskId = computed(() => this.item().bookingIssue?.taskId);

  async onSendAgain(): Promise<void> {
    const noun = this.kind();
    const outcome = noun === 'payment' ? "won't be paid twice" : "won't be booked twice";
    const ref = this.dialog.open(SendAgainDialogComponent, {
      data: {
        title: `Send this ${noun} to Global Genius again?`,
        message: `${this.summary()}. This sends the same ${noun} again. It is not a new ${noun} and ${outcome}.`,
        confirmFixed: this.explanation()?.confirmFixed
      } satisfies SendAgainDialogData,
      width: '480px',
      maxWidth: '92vw'
    });
    if (await firstValueFrom(ref.afterClosed())) {
      this.booking.sendItemAgain(this.claimId(), noun, this.itemId());
      this.toast.info('Sent again', "We'll let you know when it's booked.");
      this.landing.watch(this.claimId(), noun, this.itemId());
    }
  }
}
