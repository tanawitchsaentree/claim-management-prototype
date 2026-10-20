import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import {
  GgClaimRegistration,
  claimRegistrationMessage
} from '../../../core/models/gg-booking.model';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import { MockBookingService } from '../../../core/mock/services/mock-booking.service';

// Claim-level Global Genius message. Shows only when something is wrong. A
// handler-triggered retry shows "Retrying…" while it runs; when it works the
// banner turns into a short green confirmation (dismissible, gone on the next
// visit) so the good news is on the page, not only in the bell.
@Component({
  selector: 'app-gg-registration-banner',
  standalone: true,
  imports: [NxMessageModule, NxButtonModule],
  templateUrl: './gg-registration-banner.component.html',
  styleUrl: './gg-registration-banner.component.scss'
})
export class GgRegistrationBannerComponent {
  private readonly booking = inject(MockBookingService);
  private readonly stateSvc = inject(MockStateService);

  readonly claimId = input('');
  readonly registration = input<GgClaimRegistration | undefined>();

  // Everything comes from the claim's own state, never from a local busy flag:
  // the state, the failure count and whether a retry is waiting for GG.
  private readonly liveClaim = computed(() =>
    this.claimId() ? this.stateSvc.state().overviews[this.claimId()] : undefined
  );
  private readonly current = computed(() => this.liveClaim()?.ggRegistration ?? this.registration());
  readonly message = computed(() =>
    claimRegistrationMessage(
      this.current(),
      this.liveClaim()?.ggResendFailures ?? 0,
      this.liveClaim()?.ggResendInFlight ?? false
    )
  );

  // True once, right after a retry this handler started has worked.
  readonly justReady = signal(false);
  private wasRetrying = false;
  private readonly watch = effect(() => {
    const retrying = this.current() === 'registering' && !!this.liveClaim()?.ggResendInFlight;
    const registered = this.current() === 'registered';
    untracked(() => {
      if (this.wasRetrying && registered) this.justReady.set(true);
      if (retrying) this.justReady.set(false);
      this.wasRetrying = retrying;
    });
  });

  sendAgain(): void {
    this.booking.sendClaimAgain(this.claimId());
  }
}
