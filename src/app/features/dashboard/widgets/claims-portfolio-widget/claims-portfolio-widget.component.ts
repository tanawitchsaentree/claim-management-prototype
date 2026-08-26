import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxBadgeModule } from '@allianz/ng-aquila/badge';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { StatusChipComponent } from '../../../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ClaimPreviewDirective } from '../../../../shared/directives/claim-preview.directive';
import { AuthService } from '../../../../core/services/auth';
import { Claim, LossEventSummary } from '../../../../core/models';

const DORMANT_DAYS = 30; // ⚑ PLACEHOLDER — confirm threshold with business

export type ClaimsDateRange = '30' | '90' | 'all';

@Component({
  selector: 'app-claims-portfolio-widget',
  standalone: true,
  imports: [
    DecimalPipe, RouterLink, NxIconModule, NxBadgeModule, NxTableModule,
    StatusChipComponent, EmptyStateComponent, ClaimPreviewDirective,
  ],
  templateUrl: './claims-portfolio-widget.component.html',
  styleUrl: './claims-portfolio-widget.component.scss',
})
export class ClaimsPortfolioWidgetComponent {
  // Already date-range-filtered by the parent (the stats card needs the same
  // filtered set, so the parent computes it once and owns claimsDateRange).
  @Input({ required: true }) claims: Claim[] = [];
  @Input({ required: true }) lossEvents: LossEventSummary[] = [];
  @Input({ required: true }) dateRange: ClaimsDateRange = '30';
  @Output() dateRangeChanged = new EventEmitter<ClaimsDateRange>();

  readonly auth = inject(AuthService);

  portfolioTab: 'claims' | 'loss-events' = 'claims';
  setPortfolioTab(tab: 'claims' | 'loss-events'): void { this.portfolioTab = tab; }

  // Default scope is "My claims" for a Claims Handler (a unified view of claims assigned to
  // them) and "All" for a KCM, who oversees more than their own portfolio.
  readonly claimsScope = signal<'mine' | 'group' | 'all'>(
    (localStorage.getItem('dashboard:claims-scope') as 'mine' | 'group' | 'all')
    ?? (this.auth.isKcm() ? 'all' : 'mine')
  );
  setClaimsScope(scope: 'mine' | 'group' | 'all'): void {
    this.claimsScope.set(scope);
    localStorage.setItem('dashboard:claims-scope', scope);
  }

  // Default view is "Open Claims" per PI 2026.3 UI/UX alignment (BMPCC-15121) — Open/In progress
  // only, with a filter to widen to Closed/Declined or everything.
  readonly claimsStatusFilter = signal<'open' | 'closed' | 'all'>(
    (localStorage.getItem('dashboard:claims-status-filter') as 'open' | 'closed' | 'all') ?? 'open'
  );
  setClaimsStatusFilter(status: 'open' | 'closed' | 'all'): void {
    this.claimsStatusFilter.set(status);
    localStorage.setItem('dashboard:claims-status-filter', status);
  }

  setDateRange(range: ClaimsDateRange): void {
    this.dateRangeChanged.emit(range);
  }

  readonly displayedClaims = computed<Claim[]>(() => {
    const scope  = this.claimsScope();
    const status = this.claimsStatusFilter();
    const user   = this.auth.user();
    let filtered = this.claims;
    if (user) {
      if (scope === 'mine')       filtered = filtered.filter(c => c.assignee === user.name);
      else if (scope === 'group') filtered = filtered.filter(c => c.group === user.group);
    }
    if (status === 'open')        filtered = filtered.filter(c => c.status === 'Open' || c.status === 'In progress');
    else if (status === 'closed') filtered = filtered.filter(c => c.status === 'Closed' || c.status === 'Declined');
    // No fallback to unfiltered claims when a scope/status combination yields zero rows —
    // an empty result is real and must render the empty state, not someone else's claims.
    return filtered.slice(0, 5);
  });

  // "View all claims" carries the widget's current scope onto the claims list, so a handler
  // viewing "My claims" lands on their own filtered list instead of the generic unfiltered one.
  // (Status isn't carried over: the widget's Open/Closed/All is a status *group*, while the
  // claims list filters by one exact ClaimStatus — the two aren't a clean 1:1 mapping.)
  readonly viewAllClaimsParams = computed<Record<string, string>>(() => {
    const params: Record<string, string> = {};
    if (this.claimsScope() === 'mine') params['assignee'] = 'me';
    return params;
  });

  isDormant(dateUpdated: string): boolean {
    if (!dateUpdated) return false;
    const diff = (Date.now() - new Date(dateUpdated).getTime()) / 86400000;
    return diff > DORMANT_DAYS;
  }

  daysSinceUpdate(dateUpdated: string): number {
    return Math.floor((Date.now() - new Date(dateUpdated).getTime()) / 86400000);
  }
}
