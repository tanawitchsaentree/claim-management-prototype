import { Component, computed, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
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
  hint: string;
  canRetry: boolean;
  retrying: boolean;
}

// BMPCC-22661: failed section bookings on Claim Overview, one message for all
// of them (a stack of banners per section would push the claim off screen).
// Sits right under the claim-level GG banner and uses the same nx-message, so
// "something is wrong in Global Genius" always looks the same on this page.
// Reads the claim's live state (not the page's view model) so a retry in
// flight survives the Claim Overview reload. See DESIGN DECISION GG-SEC-1 in
// gg-section-booking.model.ts.
@Component({
  selector: 'app-gg-section-booking-banner',
  standalone: true,
  imports: [NxMessageModule, NxButtonModule, NxSpinnerModule],
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
      .map(b => ({
        booking: b,
        name: sections.find(s => s.id === b.sectionId)?.name ?? b.sectionId,
        hint: sectionBookingHint(b),
        canRetry: sectionCanRetry(b),
        retrying: b.status === 'retrying'
      }));
  });

  // Error while any section still needs the handler or Finance; info while
  // every remaining one is only retrying.
  readonly context = computed(() => (this.rows().some(r => !r.retrying) ? 'error' : 'info'));

  readonly title = computed(() => {
    const rows = this.rows();
    const n = rows.length;
    const count = n === 1 ? '1 section' : `${n} sections`;
    if (rows.every(r => r.retrying)) return `Retrying ${count} in Global Genius`;
    if (rows.every(r => sectionWithFinance(r.booking))) {
      return `${count} still couldn't be booked in Global Genius: now with Finance`;
    }
    return `${count} couldn't be booked in Global Genius`;
  });

  retry(sectionId: string): void {
    this.booking.sendSectionAgain(this.claimId(), sectionId);
  }
}
