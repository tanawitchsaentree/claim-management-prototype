import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { ReferenceViewService } from '../claim-reference-panel/reference-view.service';

@Component({
  selector: 'app-claim-reference-tabs',
  standalone: true,
  imports: [CommonModule, NxIconModule],
  templateUrl: './claim-reference-tabs.component.html',
  styleUrl:    './claim-reference-tabs.component.scss',
})
export class ClaimReferenceTabsComponent {
  readonly svc    = inject(ReferenceViewService);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  // Which tab is visually active — derived from current URL
  readonly activeTab = computed<'primary' | 'ref'>(() => {
    const refId = this.svc.refClaimId();
    if (refId && this.url().includes(refId)) return 'ref';
    return 'primary';
  });

  goToPrimary(): void {
    const id = this.svc.primaryClaimId();
    if (id) this.router.navigate(['/claims', id, 'overview']);
  }

  goToRef(): void {
    const id = this.svc.refClaimId();
    if (id) this.router.navigate(['/claims', id, 'overview']);
  }

  closeRef(): void {
    // Navigate back to primary before closing
    const primary = this.svc.primaryClaimId();
    this.svc.close();
    if (primary) this.router.navigate(['/claims', primary, 'overview']);
  }
}
