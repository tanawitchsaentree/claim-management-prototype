import { Component, computed, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import { MockBookingService } from '../../../core/mock/services/mock-booking.service';
import {
  GgSectionBooking,
  sectionBookingHint,
  sectionCanRetry,
  sectionWithFinance
} from '../../../core/models/gg-section-booking.model';

interface SectionRow {
  booking: GgSectionBooking;
  name: string;
  title: string;
  body: string;
  hint: string;
  canRetry: boolean;
  retrying: boolean;
}

const ON_HOLD = 'Payments and reserves on this section are not in the books until the booking goes through.';

// Same wording rules as the claim-level banner (gg-claim-registration.model.ts).
function messageFor(b: GgSectionBooking, name: string): Pick<SectionRow, 'title' | 'body' | 'hint'> {
  if (b.status === 'retrying') {
    return {
      title: `Retrying: booking ${name} in Global Genius`,
      body: "Your retry has been sent. This usually takes a few seconds. We'll tell you if it works or not.",
      hint: ''
    };
  }
  const title = sectionWithFinance(b)
    ? `${name} still couldn't be booked in Global Genius: now with Finance`
    : `${name} couldn't be booked in Global Genius`;
  return { title, body: ON_HOLD, hint: sectionBookingHint(b) };
}

// BMPCC-22661: failed section bookings on Claim Overview, one nx-message per
// section (the financial-warnings pattern). Sits right under the claim-level
// GG banner and uses the same nx-message layout, and a retry in flight reads
// the claim-level way (info message titled "Retrying: ..."), so "something is
// wrong in Global Genius" always looks the same on this page.
// Reads the claim's live state (not the page's view model) so a retry in
// flight survives the Claim Overview reload. See DESIGN DECISION GG-SEC-1 in
// gg-section-booking.model.ts.
@Component({
  selector: 'app-gg-section-booking-banner',
  standalone: true,
  imports: [NxMessageModule, NxButtonModule],
  templateUrl: './gg-section-booking-banner.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './gg-section-booking-banner.component.scss'
})
export class GgSectionBookingBannerComponent {
  private readonly stateSvc = inject(MockStateService);
  private readonly booking = inject(MockBookingService);

  readonly claimId = input.required<string>();

  private readonly claim = computed(() => this.stateSvc.state().overviews[this.claimId()]);

  readonly rows = computed<SectionRow[]>(() => {
    const claim = this.claim();
    // Hidden while the claim itself is not (yet) in GG: section events follow it.
    const reg = claim?.ggRegistration;
    if (!claim || (reg && reg !== 'registered')) return [];
    const sections = this.stateSvc.state().sections;
    return (claim.ggSectionBookings ?? [])
      .filter(b => b.status !== 'booked')
      .map(b => {
        const name = sections.find(s => s.id === b.sectionId)?.name ?? b.sectionId;
        return { booking: b, name, ...messageFor(b, name), canRetry: sectionCanRetry(b), retrying: b.status === 'retrying' };
      });
  });

  retry(sectionId: string): void {
    this.booking.sendSectionAgain(this.claimId(), sectionId);
  }
}
