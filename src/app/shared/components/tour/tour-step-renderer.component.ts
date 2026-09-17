import { Component, ViewChild, effect, inject, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NxPopoverModule,
  NxPopoverTriggerDirective,
  NxPopoverTitleDirective,
  NxPopoverMainContentDirective,
  NxPopoverActionsDirective
} from '@allianz/ng-aquila/popover';
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
//
// Three real bugs found via automated browser verification (Playwright) —
// this had never been visually verified since it was first built:
//
// 1. NxPopoverTitleDirective/NxPopoverMainContentDirective/NxPopoverActions-
//    Directive are plain ATTRIBUTE directives (they just add a host CSS
//    class — check the library source, not just the .d.ts). The original
//    template used them with a structural `*` prefix (`*nxPopoverTitle`
//    etc.), which wraps the content in an implicit <ng-template> that
//    nothing ever embeds — so the popover's title/body/actions never
//    rendered at all, silently, regardless of whether the directives were
//    imported. Fixed by using them as plain attributes on real elements
//    (`<span nxPopoverTitle>`, not `<ng-container *nxPopoverTitle>` — an
//    ng-container has no host element for an attribute directive to class).
//
// 2. Narrative-only steps (no targetId) do NOT go through this popover/
//    anchor mechanism at all — see the template's plain `.tour-centered-card`
//    branch. Opening this exact nx-popover (manual trigger, closeable=false,
//    modal=false) anchored to a synthetic fixed-position point with nothing
//    real to measure crashed the renderer outright — bisected down to "no
//    measured rect" specifically (not content, not trigger config, not
//    anchor size). A targeted step (real rect from a real element) never
//    crashed. Rather than depend on the exact CDK internals, narrative steps
//    render as a plain, non-overlay centered card — architecturally correct
//    anyway for "nothing to anchor to", and sidesteps the crash entirely.
//
// 3. Targeted steps whose target is below the fold self-closed within ~50ms
//    of opening. CDK's default popover scroll strategy is `close()` — and
//    the popover's own focus-trap auto-focuses its first tabbable button on
//    open, which triggers the browser's native scroll-into-view for an
//    off-screen element, which the close-scroll-strategy reads as "the user
//    scrolled" and detaches the overlay. Fixed by scrolling the target into
//    view *before* opening (also just better UX — the user should see what's
//    being pointed at without having to scroll first) and by setting
//    `nxPopoverScrollStrategy="reposition"` so a genuine user scroll moves
//    the popover instead of closing it.
@Component({
  selector: 'app-tour-step-renderer',
  standalone: true,
  imports: [
    NxPopoverModule,
    NxPopoverTitleDirective,
    NxPopoverMainContentDirective,
    NxPopoverActionsDirective,
    NxButtonModule
  ],
  templateUrl: './tour-step-renderer.component.html',
  styleUrl: './tour-step-renderer.component.scss'
})
export class TourStepRendererComponent {
  readonly tourSvc = inject(TourService);
  private readonly router = inject(Router);

  @ViewChild('anchorTrigger') private anchorTrigger?: NxPopoverTriggerDirective;

  readonly rect = signal<TargetRect | null>(null);

  // Continuous re-measure loop, running only while a targeted step is active
  // — see startTracking(). getBoundingClientRect() is a snapshot at the
  // instant it's called; without re-measuring, the highlight ring and the
  // popover's anchor point stay frozen at wherever the target was when the
  // step opened. Any scroll (window OR an internal scroll container — e.g.
  // Sections' tree pane, a modal body) or layout shift (an accordion
  // expanding above the target) then leaves the popover visually detached
  // from the thing it's supposed to be pointing at.
  private trackingHandle: number | null = null;
  private trackedTargetId: string | null = null;

  private readonly navigationEnd = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)),
    { initialValue: null }
  );

  constructor() {
    // Re-locate the target whenever the step changes OR navigation completes
    // (a cross-route step's target only exists in the DOM after the new
    // page renders — same "settle" concern ScenarioStageService already
    // handles for postLand hooks).
    effect(() => {
      const step = this.tourSvc.currentStep();
      this.navigationEnd();
      this.stopTracking();
      this.anchorTrigger?.close();
      if (!step?.targetId) {
        // No step, or a narrative-only step — nothing to point the CDK
        // popover at. The template's plain centered-card branch handles
        // narrative steps; just make sure no stale highlight rect lingers.
        this.rect.set(null);
        return;
      }
      this.locateAndOpen(step.targetId);
    });
  }

  private async locateAndOpen(targetId: string, attempt = 0): Promise<void> {
    const el = document.querySelector<HTMLElement>(`[data-tour-id="${targetId}"]`);
    if (!el) {
      if (attempt >= 20) return; // ~2s of retrying, then give up silently
      await new Promise(r => setTimeout(r, 100));
      // Bail if the step moved on while we were waiting.
      if (this.tourSvc.currentStep()?.targetId !== targetId) return;
      return this.locateAndOpen(targetId, attempt + 1);
    }

    // Bring the target into view before opening — see header comment (2).
    // Without this, an off-screen target's auto-focused button causes a
    // native scroll-into-view that the popover's own scroll strategy used
    // to read as "the user scrolled" and self-close within ~50ms.
    el.scrollIntoView({ block: 'center' });
    this.measure(el);

    // Force a fresh open so the popover re-measures against the anchor's
    // new position rather than assuming its previous-step placement.
    this.anchorTrigger?.close();
    await new Promise(r => setTimeout(r, 0));
    this.anchorTrigger?.open();

    this.startTracking(targetId, el);
  }

  private measure(el: HTMLElement): void {
    const box = el.getBoundingClientRect();
    this.rect.set({ top: box.top, left: box.left, width: box.width, height: box.height });
  }

  // rAF loop rather than individual scroll/resize listeners — this app has
  // enough independently-scrollable containers (right-strip panels, modal
  // bodies, the Sections tree pane) that enumerating every ancestor to
  // attach a capture-phase scroll listener to is more fragile than just
  // re-measuring every frame for the short time a tour step is on screen.
  private startTracking(targetId: string, el: HTMLElement): void {
    this.trackedTargetId = targetId;
    const loop = () => {
      if (this.trackedTargetId !== targetId) return; // step moved on, or stopped
      if (!el.isConnected) {
        // Target left the DOM mid-step (e.g. the modal it was in closed) —
        // stop tracking and clear the highlight rather than keep pointing
        // at a detached element's stale last-known position.
        this.rect.set(null);
        this.anchorTrigger?.close();
        this.trackedTargetId = null;
        return;
      }
      this.measure(el);
      this.trackingHandle = requestAnimationFrame(loop);
    };
    this.trackingHandle = requestAnimationFrame(loop);
  }

  private stopTracking(): void {
    if (this.trackingHandle !== null) {
      cancelAnimationFrame(this.trackingHandle);
      this.trackingHandle = null;
    }
    this.trackedTargetId = null;
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
