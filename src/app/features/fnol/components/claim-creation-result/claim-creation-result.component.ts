import { Component, computed, input, output, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxLinkModule } from '@allianz/ng-aquila/link';
import { PolicyClaimResult } from '../../../../core/models';

/**
 * BMPCC-22665 AC05: what came out of Submit, per policy. One message says
 * the overall outcome (all created / some failed / none created), then a row
 * per policy with its claim number (a link) or why it failed and a Retry.
 * Failures never hide the claims that were created.
 *
 * DESIGN DECISION IMP-6 (grouping): claims created together are listed
 * together here and share the loss information. A lasting link between them
 * ("open as a group") is not added: the Loss event is the app's existing way
 * to group claims of one event, and attaching them to one is the follow-up.
 */
@Component({
  selector: 'app-claim-creation-result',
  standalone: true,
  imports: [RouterLink, NxButtonModule, NxMessageModule, NxTableModule, NxLinkModule],
  templateUrl: './claim-creation-result.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './claim-creation-result.component.scss'
})
export class ClaimCreationResultComponent {
  readonly results = input.required<PolicyClaimResult[]>();
  readonly retrying = input<string | null>(null);
  readonly retry = output<string>();

  readonly created = computed(() => this.results().filter(r => r.status === 'created'));
  readonly failed = computed(() => this.results().filter(r => r.status === 'failed'));

  readonly context = computed<'success' | 'warning' | 'error'>(() =>
    !this.failed().length ? 'success' : this.created().length ? 'warning' : 'error'
  );

  readonly headline = computed(() => {
    const total = this.results().length;
    const ok = this.created().length;
    const word = (n: number) => (n === 1 ? 'claim' : 'claims');
    if (ok === total) return `${ok} ${word(ok)} created`;
    if (ok === 0) return `No claims created`;
    return `${ok} of ${total} claims created`;
  });
}
