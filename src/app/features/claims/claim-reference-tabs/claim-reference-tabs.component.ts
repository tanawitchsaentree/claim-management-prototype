import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
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
  private searchGeneration = 0;

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
  // Keyboard highlight for the results listbox (aria-activedescendant pattern) —
  // the container stays the single tab stop, arrow keys move this index.
  readonly highlightedIndex = signal(0);

  toggleAddPopover(): void {
    const next = !this.showAddPopover();
    this.showAddPopover.set(next);
    if (next) {
      this.searchQuery.set('');
      this.searchResults.set([]);
      this.highlightedIndex.set(0);
    }
  }

  closeAddPopover(): void {
    this.showAddPopover.set(false);
  }

  async onSearchInput(query: string): Promise<void> {
    this.searchQuery.set(query);
    if (query.trim().length < 2) {
      this.searchResults.set([]);
      return;
    }
    this.searching.set(true);
    const generation = ++this.searchGeneration;
    const primary        = this.svc.primaryClaimId();
    const existingRefIds = new Set(this.svc.refTabs().map(t => t.claimId));

    const results = await firstValueFrom(this.claimSvc.getAll({ search: query }));
    if (generation !== this.searchGeneration) return; // stale — a newer search superseded this one
    this.searchResults.set(
      results
        .filter(c => c.claimId !== primary && !existingRefIds.has(c.claimId))
        .slice(0, 5)
    );
    this.highlightedIndex.set(0);
    this.searching.set(false);
  }

  selectResult(claim: Claim): void {
    this.svc.openRefTab(claim.claimId);
    this.router.navigate(['/claims', claim.claimId, 'overview']);
    this.closeAddPopover();
  }

  // Minimal keyboard support for the results listbox: arrows move the
  // highlighted option, Enter/Space activates the same selectResult() the
  // click handler already uses.
  onSearchListKeydown(event: KeyboardEvent): void {
    const results = this.searchResults();
    if (!results.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedIndex.set((this.highlightedIndex() + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedIndex.set((this.highlightedIndex() - 1 + results.length) % results.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectResult(results[this.highlightedIndex()]);
    }
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
