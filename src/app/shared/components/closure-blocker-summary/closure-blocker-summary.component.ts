import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { Blocker } from '../../../core/models/claim-closure.model';
import { AppDatePipe } from '../../pipes/app-date.pipe';

/**
 * BMPCC-22660 — the compact "why this can't close" list under one item of a
 * bulk closure (review step and result step). Every blocker is a line; open
 * tasks are always listed one by one with their type and domain (epic FR2),
 * never folded into a count. The single-item closure modals keep their own
 * expandable blocker cards; this is the per-row version of the same content.
 */
@Component({
  selector: 'app-closure-blocker-summary',
  standalone: true,
  imports: [NxIconModule, AppDatePipe],
  templateUrl: './closure-blocker-summary.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './closure-blocker-summary.component.scss'
})
export class ClosureBlockerSummaryComponent {
  @Input({ required: true }) blockers: readonly Blocker[] = [];

  isTasks(b: Blocker): boolean {
    return b.type === 'tasks' && !!b.items?.length;
  }
}
