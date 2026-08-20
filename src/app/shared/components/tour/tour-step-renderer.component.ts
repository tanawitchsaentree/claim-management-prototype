import { Component, ViewChild, effect, inject, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { NxPopoverModule, NxPopoverTriggerDirective } from '@allianz/ng-aquila/popover';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { TourService } from '../../../core/services/tour.service';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Renders once at app root (like ToastStackComponent) — a tour points at
// elements owned by OTHER components purely via `document.querySelector`
// on their `data-tour-id` attribute + getBoundingClientRect(). This is
// deliberate: the constraint for this feature is "never modify existing
// claim/FNOL/section components except to add data-tour-id attributes", so
// this renderer cannot wire NxPopoverTriggerDirective onto the target
// components' own templates (the directive is compile-time bound to its
// host element). Instead the trigger lives HERE, on a synthetic zero-size
// anchor span that this component repositions to sit exactly on the real
// target's bounding rect — genuinely using NxPopoverComponent +
// Title/MainContent/Actions, just anchored indirectly.
@Component({
  selector: 'app-tour-step-renderer',
  standalone: true,
  imports: [NxPopoverModule, NxButtonModule],
  templateUrl: './tour-step-renderer.component.html',
  styleUrl: './tour-step-renderer.component.scss',
})
export class TourStepRendererComponent {
  readonly tourSvc = inject(TourService);
  private readonly router = inject(Router);

  @ViewChild('anchorTrigger') private anchorTrigger?: NxPopoverTriggerDirective;

  readonly rect = signal<TargetRect | null>(null);

  private readonly navigationEnd = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)),
    { initialValue: null },
  );

  constructor() {
    // Re-locate the target whenever the step changes OR navigation completes
    // (a cross-route step's target only exists in the DOM after the new
    // page renders — same "settle" concern ScenarioStageService already
    // handles for postLand hooks).
    effect(() => {
      const step = this.tourSvc.currentStep();
      this.navigationEnd();
      if (!step) {
        this.rect.set(null);
        this.anchorTrigger?.close();
        return;
      }
      this.locateAndOpen(step.targetId);
    });
  }

  private async locateAndOpen(targetId: string, attempt = 0): Promise<void> {
    const el = document.querySelector<HTMLElement>(`[data-tour-id="${targetId}"]`);
    if (!el) {
      if (attempt >= 20) return; // ~2s of retrying, then give up silently
      await new Promise((r) => setTimeout(r, 100));
      // Bail if the step moved on while we were waiting.
      if (this.tourSvc.currentStep()?.targetId !== targetId) return;
      return this.locateAndOpen(targetId, attempt + 1);
    }

    const box = el.getBoundingClientRect();
    this.rect.set({ top: box.top, left: box.left, width: box.width, height: box.height });

    // Force a fresh open so the popover re-measures against the anchor's
    // new position rather than assuming its previous-step placement.
    this.anchorTrigger?.close();
    await new Promise((r) => setTimeout(r, 0));
    this.anchorTrigger?.open();
  }

  get anchorTop(): number {
    const r = this.rect();
    return r ? r.top + r.height : 0;
  }

  get anchorLeft(): number {
    const r = this.rect();
    return r ? r.left + r.width / 2 : 0;
  }
}
