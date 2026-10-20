import { Component, computed, input } from '@angular/core';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import {
  GgClaimRegistration,
  claimRegistrationMessage
} from '../../../../../core/models/gg-booking.model';

// Claim-level Global Genius message. Shows only when something is wrong; no
// Retry on purpose (DESIGN DECISION GG-1), the banner says who is fixing it.
@Component({
  selector: 'app-gg-registration-banner',
  standalone: true,
  imports: [NxMessageModule],
  templateUrl: './gg-registration-banner.component.html',
  styleUrl: './gg-registration-banner.component.scss'
})
export class GgRegistrationBannerComponent {
  readonly registration = input<GgClaimRegistration | undefined>();
  readonly message = computed(() => claimRegistrationMessage(this.registration()));
}
