import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { Blocker } from '../../../core/models/claim-closure.model';
import { AppDatePipe } from '../../pipes/app-date.pipe';

/**
 * The "why this can't close" blocker cards, one shared copy for the claim
 * closure modal, the section closure modal and bulk closure (BMPCC-22660).
 * Markup and styles were moved here unchanged from the two single-item modals.
 * Open tasks start expanded so every task with its type and domain is on
 * screen without a click (epic FR2); other blockers start folded.
 *
 * - `blockerLink`: the card's "Go to X" button; the host closes and navigates.
 * - `leave`: an item's own "Go to" link was followed; the host closes itself.
 */
@Component({
  selector: 'app-closure-blocker-summary',
  standalone: true,
  imports: [RouterModule, NxIconModule, NxButtonModule, AppDatePipe],
  templateUrl: './closure-blocker-summary.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './closure-blocker-summary.component.scss'
})
export class ClosureBlockerSummaryComponent {
  readonly blockers = input.required<readonly Blocker[]>();
  /** e.g. 'ccm' keeps the tour target `ccm-go-to-litigation` on the litigation link. */
  readonly tourPrefix = input<string | null>(null);

  readonly blockerLink = output<Blocker>();
  readonly leave = output<void>();

  /** Cards the handler flipped away from their starting state. */
  private readonly toggled = signal<ReadonlySet<string>>(new Set());

  isExpanded(b: Blocker, key: string): boolean {
    return (b.type === 'tasks') !== this.toggled().has(key);
  }

  toggle(key: string): void {
    this.toggled.update(set => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
}
