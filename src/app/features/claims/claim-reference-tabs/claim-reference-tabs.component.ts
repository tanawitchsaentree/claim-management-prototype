import { Component, inject, computed, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { ReferenceViewService, RefTab } from '../claim-reference-panel/reference-view.service';
import { MockClaimService } from '../../../core/mock/services/mock-claim.service';
import { Claim } from '../../../core/models/claim.model';

@Component({
  selector: 'app-claim-reference-tabs',
  standalone: true,
  imports: [CommonModule, FormsModule, NxIconModule],
  templateUrl: './claim-reference-tabs.component.html',
  styleUrl:    './claim-reference-tabs.component.scss',
})
export class ClaimReferenceTabsComponent {
  readonly svc      = inject(ReferenceViewService);
  private readonly router    = inject(Router);
  private readonly claimSvc  = inject(MockClaimService);
  private readonly destroyRef = inject(DestroyRef);

  // ── URL tracking ──────────────────────────────────────────────────────────
  private readonly url = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  // Active tab: 'primary' or a tab.id — derived purely from current URL
  readonly activeTabId = computed<string | 'primary'>(() => {
    const currentUrl = this.url();
    for (const tab of this.svc.refTabs()) {
      if (currentUrl.includes(tab.claimId)) return tab.id;
    }
    return 'primary';
  });

  // ── Add-tab popover ───────────────────────────────────────────────────────
  readonly showAddPopover = signal(false);
  readonly searchQuery    = signal('');
  readonly searchResults  = signal<Claim[]>([]);
  readonly searching      = signal(false);

  toggleAddPopover(): void {
    const next = !this.showAddPopover();
    this.showAddPopover.set(next);
    if (next) {
      this.searchQuery.set('');
      this.searchResults.set([]);
    }
  }

  closeAddPopover(): void {
    this.showAddPopover.set(false);
  }

  onSearchInput(query: string): void {
    this.searchQuery.set(query);
    if (query.trim().length < 2) {
      this.searchResults.set([]);
      return;
    }
    this.searching.set(true);
    const primary        = this.svc.primaryClaimId();
    const existingRefIds = new Set(this.svc.refTabs().map(t => t.claimId));

    this.claimSvc.getAll({ search: query })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(results => {
        this.searchResults.set(
          results
            .filter(c => c.claimId !== primary && !existingRefIds.has(c.claimId))
            .slice(0, 5)
        );
        this.searching.set(false);
      });
  }

  selectResult(claim: Claim): void {
    this.svc.openRefTab(claim.claimId);
    this.router.navigate(['/claims', claim.claimId, 'overview']);
    this.closeAddPopover();
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  goToPrimary(): void {
    const id = this.svc.primaryClaimId();
    if (id) this.router.navigate(['/claims', id, 'overview']);
  }

  goToRef(tab: RefTab): void {
    this.svc.activeRefTabId.set(tab.id);
    this.router.navigate(['/claims', tab.claimId, 'overview']);
  }

  closeRef(tab: RefTab): void {
    const wasOnThisTab = this.url().includes(tab.claimId);
    this.svc.closeRefTab(tab.id);
    if (wasOnThisTab) {
      const newActive = this.svc.activeRefTab();
      const primary   = this.svc.primaryClaimId();
      if (newActive) {
        this.router.navigate(['/claims', newActive.claimId, 'overview']);
      } else if (primary) {
        this.router.navigate(['/claims', primary, 'overview']);
      }
    }
  }
}
