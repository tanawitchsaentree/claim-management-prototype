import { Component, computed, inject, input } from '@angular/core';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import {
  GgClaimRegistration,
  claimRegistrationMessage
} from '../../../../../core/models/gg-booking.model';
import { MockStateService } from '../../../../../core/mock/state/mock-state.service';
import { MockBookingService } from '../../../../../core/mock/services/mock-booking.service';

// Claim-level Global Genius message. Shows only when something is wrong. When
// the claim can be sent again (DESIGN DECISION GG-2) the button is here; while
// it runs the banner turns into the "still being set up" note, then disappears.
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
  // "Send again" changes the claim's state in the background; read it live
  // when we know the claim, else fall back to what the page passed in.
  private readonly live = computed(() =>
    this.claimId() ? (this.stateSvc.state().overviews[this.claimId()]?.ggRegistration ?? this.registration()) : this.registration()
  );
  readonly message = computed(() => claimRegistrationMessage(this.live()));

  sendAgain(): void {
    this.booking.sendClaimAgain(this.claimId());
  }
}
