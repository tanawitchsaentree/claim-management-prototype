import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  ChangeDetectionStrategy
} from '@angular/core';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxLinkModule } from '@allianz/ng-aquila/link';
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
  imports: [NxMessageModule, NxLinkModule],
  templateUrl: './gg-registration-banner.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
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
  private readonly current = computed(
    () => this.liveClaim()?.ggRegistration ?? this.registration()
  );
  readonly message = computed(() =>
    claimRegistrationMessage(
      this.current(),
      this.liveClaim()?.ggResendFailures ?? 0,
      this.liveClaim()?.ggResendInFlight ?? false,
      this.liveClaim()?.ggFailureMessage
    )
  );

  // BMPCC-22661 AC01: the failure message from the booking outcome, shown as
  // GG wrote it under the plain-language text. DESIGN DECISION GG-MSG-1: GG-2
  // kept GG's raw text away from the handler; the story now asks for it, so it
  // is shown, but second and labelled as GG's words, so the plain line still
  // says what it means for the handler. Not while a retry is running (it is
  // the old answer then).
  readonly failureMessage = computed(() => {
    const m = this.message();
    return m?.severity === 'error' && !m.causeInBody ? this.liveClaim()?.ggFailureMessage : undefined;
  });

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
