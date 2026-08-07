import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { animate, style, transition, trigger } from '@angular/animations';
import { firstValueFrom } from 'rxjs';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { MockSectionService } from '../../../core/mock/services/mock-section.service';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import { MockClaimService } from '../../../core/mock/services/mock-claim.service';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ClaimOverview } from '../../../core/models/claim-overview.model';
import { ClaimSection } from '../../../core/models/section.model';
import { Claim } from '../../../core/models/claim.model';
import { ReferenceViewService, RefTab, MAX_REF_TABS } from './reference-view.service';

interface RefVM {
  claim: ClaimOverview | null;
  sections: ClaimSection[];
  notFound: boolean;
  loading: boolean;
}

const EMPTY_VM: RefVM = { claim: null, sections: [], notFound: false, loading: true };

@Component({
  selector: 'app-claim-reference-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NxIconModule, NxButtonModule, NxTooltipModule, StatusChipComponent, EmptyStateComponent],
  templateUrl: './claim-reference-panel.component.html',
  styleUrl: './claim-reference-panel.component.scss',
  animations: [
    trigger('refPanelSlide', [
      transition(':enter', [
        style({ width: 0, opacity: 0 }),
        animate('220ms cubic-bezier(0.2, 0, 0, 1)', style({ width: '360px', opacity: 1 })),
      ]),
      transition(':leave', [
        style({ width: '360px', opacity: 1, overflow: 'hidden' }),
        animate('180ms cubic-bezier(0.4, 0, 1, 1)', style({ width: 0, opacity: 0 })),
      ]),
    ]),
  ],
})
export class ClaimReferencePanelComponent {
  readonly svc = inject(ReferenceViewService);
  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly sectionSvc  = inject(MockSectionService);
  private readonly stateSvc    = inject(MockStateService);
  private readonly claimSvc    = inject(MockClaimService);
  private searchGeneration = 0;

  readonly maxTabs = MAX_REF_TABS;
  readonly vm = signal<RefVM>(EMPTY_VM);

  // ── Search popover ──────────────────────────────────────────────────────────
  readonly showSearch    = signal(false);
  readonly searchQuery   = signal('');
  readonly searchResults = signal<Claim[]>([]);
  readonly searching     = signal(false);

  constructor() {
    // Reload content whenever the active ref tab changes
    effect(() => {
      const tab = this.svc.activeRefTab();
      if (tab) {
        this.load(tab.claimId);
      } else {
        this.vm.set(EMPTY_VM);
      }
    });
  }

  private async load(claimId: string): Promise<void> {
    this.vm.set(EMPTY_VM);
    const knownIds = Object.keys(this.stateSvc.state().overviews);
    if (!knownIds.includes(claimId)) {
      this.vm.set({ claim: null, sections: [], notFound: true, loading: false });
      return;
    }
    try {
      const [{ claim }, sections] = await Promise.all([
        firstValueFrom(this.overviewSvc.getOverviewWithActivities(claimId)),
        firstValueFrom(this.sectionSvc.getByClaimId(claimId)),
      ]);
      this.vm.set({ claim, sections, notFound: false, loading: false });
    } catch {
      this.vm.set({ claim: null, sections: [], notFound: true, loading: false });
    }
  }

  // ── Tab actions ─────────────────────────────────────────────────────────────
  selectTab(tab: RefTab): void {
    this.svc.activeRefTabId.set(tab.id);
  }

  closeTab(tab: RefTab, event: MouseEvent): void {
    event.stopPropagation();
    this.svc.closeRefTab(tab.id);
  }

  // ── Search popover ──────────────────────────────────────────────────────────
  toggleSearch(): void {
    const next = !this.showSearch();
    this.showSearch.set(next);
    if (next) {
      this.searchQuery.set('');
      this.searchResults.set([]);
    }
  }

  closeSearch(): void {
    this.showSearch.set(false);
  }

  async onSearchInput(query: string): Promise<void> {
    this.searchQuery.set(query);
    if (query.trim().length < 2) { this.searchResults.set([]); return; }
    this.searching.set(true);
    const generation = ++this.searchGeneration;
    const primary = this.svc.primaryClaimId();
    const open    = new Set(this.svc.refTabs().map(t => t.claimId));
    const results = await firstValueFrom(this.claimSvc.getAll({ search: query }));
    if (generation !== this.searchGeneration) return; // stale — a newer search superseded this one
    this.searchResults.set(
      results.filter(c => c.claimId !== primary && !open.has(c.claimId)).slice(0, 5)
    );
    this.searching.set(false);
  }

  selectClaim(claim: Claim): void {
    this.svc.openRefTab(claim.claimId);
    this.closeSearch();
  }

  sectionsSummary(sections: ClaimSection[]): string {
    const open   = sections.filter(s => s.status !== 'Closed').length;
    const closed = sections.filter(s => s.status === 'Closed').length;
    const total  = sections.length;
    if (total === 0) return 'No sections';
    return `${closed}/${total} closed${open > 0 ? ` · ${open} open` : ''}`;
  }
}
