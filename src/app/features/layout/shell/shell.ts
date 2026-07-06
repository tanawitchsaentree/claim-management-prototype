import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { Navbar } from '../navbar/navbar';
import { Sidebar } from '../sidebar/sidebar';
import { ClaimRightStripComponent } from '../claim-right-strip/claim-right-strip.component';
import { ClaimReferencePanelComponent } from '../../claims/claim-reference-panel/claim-reference-panel.component';

// Phase 1 feature flag — OFF by default. Flip to true to enable the reference panel.
// Rollback: set back to false or delete the panel slot in shell.html.
const REFERENCE_PANEL_ENABLED = true;

// Demo: default reference claim shown when panel opens.
const DEMO_REFERENCE_CLAIM_ID = 'CLM-2024-011';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, Navbar, Sidebar, ClaimRightStripComponent, ClaimReferencePanelComponent],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly router = inject(Router);

  private readonly url$ = this.router.events.pipe(
    filter(e => e instanceof NavigationEnd),
    map(e => (e as NavigationEnd).urlAfterRedirects),
    startWith(this.router.url),
  );

  private readonly urlSignal = toSignal(this.url$, { initialValue: this.router.url });

  readonly showRightStrip = computed(() => {
    const match = this.urlSignal().match(/^\/claims\/([^/]+)/);
    return !!match && match[1] !== 'new';
  });

  // Reference panel state — feature-flagged
  readonly refPanelEnabled = REFERENCE_PANEL_ENABLED;
  readonly refClaimId = signal<string | null>(null);
  readonly showRefPanel = computed(() => !!this.refClaimId());

  openRefPanel(): void {
    // Get current primary claim from URL; open a different claim as reference
    const match = this.urlSignal().match(/^\/claims\/([^/]+)/);
    const primaryId = match?.[1];
    const refId = primaryId === DEMO_REFERENCE_CLAIM_ID ? 'CLM-2024-001' : DEMO_REFERENCE_CLAIM_ID;
    this.refClaimId.set(refId);
  }

  closeRefPanel(): void {
    this.refClaimId.set(null);
  }
}
