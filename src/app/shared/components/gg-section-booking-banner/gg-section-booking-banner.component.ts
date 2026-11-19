import { Component, computed, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxLinkModule } from '@allianz/ng-aquila/link';
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

interface SectionBanner {
  context: 'error' | 'info';
  title: string;
  body: string;
  rows: SectionRow[];
}

function sectionsWord(n: number): string {
  return n === 1 ? '1 section' : `${n} sections`;
}

// Same wording rules as the claim-level banner (gg-claim-registration.model.ts),
// counted over all failed sections so there is only ever one banner.
function bannerFor(rows: SectionRow[]): SectionBanner {
  const failed = rows.filter(r => !r.retrying);
  if (!failed.length) {
    return {
      context: 'info',
      title: `Retrying: booking ${sectionsWord(rows.length)} in Global Genius`,
      body: "Your retry has been sent. This usually takes a few seconds. We'll tell you if it works or not.",
      rows
    };
  }
  const allWithFinance = failed.every(r => sectionWithFinance(r.booking));
  const title = allWithFinance
    ? `${sectionsWord(failed.length)} still couldn't be booked in Global Genius: now with Finance`
    : `${sectionsWord(failed.length)} couldn't be booked in Global Genius`;
  const body = `Payments and reserves on ${rows.length === 1 ? 'this section are' : 'these sections are'} not in the books until the booking goes through.`;
  return { context: 'error', title, body, rows };
}

// BMPCC-22661: failed section bookings on Claim Overview, all in ONE
// nx-message (title counts them, one row per section). Sits right under the
// claim-level GG banner and uses the same nx-message layout and "Retry" link,
// so "something is wrong in Global Genius" always looks the same on this page.
// Reads the claim's live state (not the page's view model) so a retry in
// flight survives the Claim Overview reload. See DESIGN DECISION GG-SEC-1 in
// gg-section-booking.model.ts.
@Component({
  selector: 'app-gg-section-booking-banner',
  standalone: true,
  imports: [NxMessageModule, NxLinkModule],
  templateUrl: './gg-section-booking-banner.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './gg-section-booking-banner.component.scss'
})
export class GgSectionBookingBannerComponent {
  private readonly stateSvc = inject(MockStateService);
  private readonly booking = inject(MockBookingService);

  readonly claimId = input.required<string>();

  private readonly claim = computed(() => this.stateSvc.state().overviews[this.claimId()]);

  readonly banner = computed<SectionBanner | null>(() => {
    const claim = this.claim();
    // Hidden while the claim itself is not (yet) in GG: section events follow it.
    const reg = claim?.ggRegistration;
    if (!claim || (reg && reg !== 'registered')) return null;
    const sections = this.stateSvc.state().sections;
    const rows = (claim.ggSectionBookings ?? [])
      .filter(b => b.status !== 'booked')
      .map(b => ({
        booking: b,
        name: sections.find(s => s.id === b.sectionId)?.name ?? b.sectionId,
        hint: sectionBookingHint(b),
        canRetry: sectionCanRetry(b),
        retrying: b.status === 'retrying'
      }));
    return rows.length ? bannerFor(rows) : null;
  });

  retry(sectionId: string): void {
    this.booking.sendSectionAgain(this.claimId(), sectionId);
  }
}
