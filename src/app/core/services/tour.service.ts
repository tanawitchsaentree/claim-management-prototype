import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

// Popover direction re-declared here (not imported from ng-aquila) to keep
// this service decoupled from the popover module — the renderer maps it.
export type TourStepDirection = 'top' | 'bottom' | 'left' | 'right';

export interface TourStep {
  /** Matches a `data-tour-id` attribute already present in the DOM.
   *  Omitted for narrative-only steps (no single element to point at) —
   *  the renderer shows these as a centered card with no highlight ring. */
  targetId?: string;
  title?: string;
  body: string;
  /** "What to expect to appear after clicking" — shown under the body. */
  expectedAfterClick?: string;
  /** Navigate here before showing this step, if different from the current route. */
  route?: string;
  direction?: TourStepDirection;
}

// DevTicket.walkthroughSteps entries are `string | TourStep` — a plain
// string used to be filtered out before ever reaching TourService,
// silently dropping most of the authored narrative. This normalizes both
// shapes into a real TourStep (string → untargeted, centered step).
export function toTourStep(entry: string | TourStep): TourStep {
  return typeof entry === 'string' ? { body: entry } : entry;
}

// Cross-route survival follows RightStripService's pattern: plain signals on
// a providedIn:'root' singleton, requester calls a method, a renderer
// elsewhere reacts via the signals — no direct component coupling, so it
// keeps working across navigation for free.
//
// FNOL fragility (tour-system audit, stage 4): FnolStateService overrides
// are in-memory only and do not survive a refresh, unlike the sessionStorage-
// backed general ScenarioOverrides. Decision: FNOL tours are scoped to a
// single screen (no route change between FNOL steps) rather than adding
// refresh-detection/restart machinery — a cross-route FNOL tour would lose
// its seeded state on any accidental refresh mid-tour. Enforce this when
// authoring tour content, not in this service.
@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly router = inject(Router);

  private readonly _steps = signal<TourStep[]>([]);
  private readonly _index = signal(0);

  readonly currentStep = computed<TourStep | null>(() => this._steps()[this._index()] ?? null);
  readonly isLastStep = computed(() => this._index() >= this._steps().length - 1);
  readonly stepNumber = computed(() => this._index() + 1);
  readonly totalSteps = computed(() => this._steps().length);
  readonly active = computed(() => this._steps().length > 0);

  async start(steps: TourStep[]): Promise<void> {
    if (!steps.length) return;
    this._steps.set(steps);
    this._index.set(0);
    await this.gotoStepRoute(steps[0]);
  }

  async next(): Promise<void> {
    if (this.isLastStep()) {
      this.end();
      return;
    }
    const nextIndex = this._index() + 1;
    this._index.set(nextIndex);
    await this.gotoStepRoute(this._steps()[nextIndex]);
  }

  /** Skippable at any step — never traps the reviewer. */
  skip(): void {
    this.end();
  }

  end(): void {
    this._steps.set([]);
    this._index.set(0);
  }

  private async gotoStepRoute(step: TourStep): Promise<void> {
    if (step.route && this.router.url !== step.route) {
      await this.router.navigateByUrl(step.route);
    }
  }
}
