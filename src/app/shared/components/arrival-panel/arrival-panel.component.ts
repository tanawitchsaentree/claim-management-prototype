import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { ArrivalContext } from '../../../core/models/arrival-context.model';
import { StatusChipComponent } from '../status-chip/status-chip.component';

// The answer to "you dropped me on a screen and said nothing".
//
// Renders once at app root next to <app-tour-step-renderer /> and is driven
// entirely by an ArrivalContext, which is derived from ticket + tracker data
// (arrival-context.builder.ts). Nothing about any individual ticket is encoded
// here — this component knows about "a criterion" and "a tour", not about
// closures or sections or any particular screen.
//
// Bottom-LEFT on purpose. ToastStackComponent owns top-right (top: 80px,
// right: 24px) and the tour's narrative card owns dead centre; a third overlay
// in either of those places would cover the thing the reviewer was sent to look
// at, which would be a fairly complete self-own for an orientation panel.
//
// Starts collapsed to a single bar after the tour is launched, and can be
// reopened — the reviewer needs the criteria list while they poke at the screen,
// not only in the two seconds before they start.
@Component({
  selector: 'app-arrival-panel',
  standalone: true,
  imports: [NxButtonModule, NxIconModule, NxMessageModule, StatusChipComponent],
  templateUrl: './arrival-panel.component.html',
  styleUrl: './arrival-panel.component.scss',
})
export class ArrivalPanelComponent {
  @Input({ required: true }) context!: ArrivalContext;
  /** True while the tour started from here is running — swaps the CTA. */
  @Input() tourActive = false;
  /**
   * Where the reviewer is RIGHT NOW, not where the link landed. Measured: opening
   * BMPCC-17157 lands on /fnol/skeleton-parties and the wizard immediately moves on
   * to /fnol/skeleton-create, so a frozen landing route made the panel state the
   * wrong location while the reviewer was looking at another screen.
   */
  @Input() currentRoute: string | null = null;

  @Output() startTour = new EventEmitter<void>();
  @Output() endTour = new EventEmitter<void>();
  @Output() dismissed = new EventEmitter<void>();

  readonly collapsed = signal(false);
  /** Which criterion is expanded, by id. Only one at a time — the panel is small. */
  readonly openCriterion = signal<string | null>(null);

  readonly builtCriteria = computed(() => this.context.criteria.filter((c) => c.buildStatus !== 'todo'));

  get shownRoute(): string {
    return this.currentRoute ?? this.context.route;
  }

  toggleCriterion(id: string): void {
    this.openCriterion.update((current) => (current === id ? null : id));
  }

  onStartTour(): void {
    this.collapsed.set(true);
    this.startTour.emit();
  }
}
