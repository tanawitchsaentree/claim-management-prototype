import { Component, input, signal, ChangeDetectionStrategy } from '@angular/core';

import { NxMessageModule } from '@allianz/ng-aquila/message';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { GgDowntimeBanner } from '../../../core/models/gg-dashboard.model';

/**
 * Global Genius downtime: before (planned) and during. Same nx-message, spot
 * and style as financial-closure-banner.ts (critique 7 in
 * docs/ux/gg-dashboard.md). Gone = no banner. Waiting items are only counted
 * here, never shown as red rows (critique 1).
 */
@Component({
  selector: 'app-gg-downtime-banner',
  standalone: true,
  imports: [NxMessageModule, AppDatePipe],
  template: `
    @if (banner(); as b) {
      @if (!dismissed()) {
        <div role="status" aria-live="polite">
          <nx-message
            context="warning"
            [closable]="true"
            closeButtonLabel="Dismiss"
            class="closure-banner"
            (close)="dismissed.set(true)"
          >
            @if (b.phase === 'planned') {
              Global Genius will be unavailable on {{ b.date | appDate }} from {{ b.from }} to
              {{ b.to }}. Payments and reserves you approve then will be sent automatically
              afterwards. Nothing to do.
            } @else if (b.waiting > 0) {
              Global Genius is unavailable. {{ b.waiting }}
              {{ b.waiting === 1 ? 'item is' : 'items are' }} waiting and will be sent
              automatically when it's back. Nothing to do.
            } @else {
              Global Genius is unavailable. Anything you approve now will be sent automatically
              when it's back. Nothing to do.
            }
          </nx-message>
        </div>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      :host {
        display: block;
      }
      .closure-banner {
        margin-bottom: var(--space-base);
      }
    `
  ]
})
export class GgDowntimeBannerComponent {
  readonly banner = input.required<GgDowntimeBanner | null>();
  readonly dismissed = signal(false);
}
