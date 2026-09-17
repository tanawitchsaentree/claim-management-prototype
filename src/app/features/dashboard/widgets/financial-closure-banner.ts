import { Component, Input, signal } from '@angular/core';

import { NxMessageModule } from '@allianz/ng-aquila/message';
import { FinancialClosurePeriod } from '../../../core/models';

@Component({
  selector: 'app-financial-closure-banner',
  standalone: true,
  imports: [NxMessageModule],
  template: `
    @if (period.active && !dismissed()) {
      <div role="status" aria-live="polite">
        <nx-message
          context="warning"
          [closable]="true"
          closeButtonLabel="Dismiss"
          class="closure-banner"
          (close)="dismissed.set(true)"
        >
          {{ period.message }}
        </nx-message>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .closure-banner {
        margin-bottom: 16px;
      }
    `
  ]
})
export class FinancialClosureBannerComponent {
  @Input({ required: true }) period!: FinancialClosurePeriod;
  readonly dismissed = signal(false);
}
