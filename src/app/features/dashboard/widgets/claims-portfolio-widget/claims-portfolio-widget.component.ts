import {
  Component,
  EventEmitter,
  Output,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxBadgeModule } from '@allianz/ng-aquila/badge';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
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
    DecimalPipe,
    RouterLink,
    NxIconModule,
    NxBadgeModule,
    NxTableModule,
    NxDropdownModule,
    StatusChipComponent,
    EmptyStateComponent,
    ClaimPreviewDirective
  ],
  templateUrl: './claims-portfolio-widget.component.html',
  styleUrl: './claims-portfolio-widget.component.scss'
})
export class ClaimsPortfolioWidgetComponent {
  // Already date-range-filtered by the parent (the stats card needs the same
  // filtered set, so the parent computes it once and owns claimsDateRange).
  // Signal inputs, not the @Input() decorator — displayedClaims()/
  // canWidenDateRange() below are computed()s that only reactively track
  // signal reads. With decorator @Input(), computed() had no way to notice
  // claims/dateRange changing (only claimsScope was a signal it could see),
  // so switching the date-range dropdown updated the label and the stats
  // card but silently never touched this widget's own filtered list —
  // exactly the "control looks like it works but doesn't" bug this session
  // is already two levels deep into. Caught by actually clicking the new
  // dropdown after adding it, not by re-reading the diff.
  readonly claims = input.required<Claim[]>();
  readonly lossEvents = input.required<LossEventSummary[]>();
  readonly dateRange = input.required<ClaimsDateRange>();
  @Output() dateRangeChanged = new EventEmitter<ClaimsDateRange>();

  readonly auth = inject(AuthService);

  portfolioTab: 'claims' | 'loss-events' = 'claims';
  setPortfolioTab(tab: 'claims' | 'loss-events'): void {
    this.portfolioTab = tab;
  }

  // Default scope is "My claims" for a Claims Handler (a unified view of claims assigned to
  // them) and "All" for a KCM, who oversees more than their own portfolio.
  readonly claimsScope = signal<'mine' | 'group' | 'all'>(
    (localStorage.getItem('dashboard:claims-scope') as 'mine' | 'group' | 'all') ??
      (this.auth.isKcm() ? 'all' : 'mine')
  );
  setClaimsScope(scope: 'mine' | 'group' | 'all'): void {
    this.claimsScope.set(scope);
    localStorage.setItem('dashboard:claims-scope', scope);
  }

  setDateRange(range: ClaimsDateRange): void {
    this.dateRangeChanged.emit(range);
  }

  // Both controls below existed as plumbing (this input/output pair, the
  // claimsScope signal) with no way to actually reach them from the UI —
  // date range was permanently stuck at whatever the parent's default was.
  // Demo claims carry fixed historical dates (2024, a few 2026) that this
  // filter compares against the real wall-clock date, so as real time moves
  // on, claims silently age out of "Last 30/90 days" with no way back to
  // them short of clearing localStorage. Exposing both here is the fix.
  readonly dateRangeOptions: { value: ClaimsDateRange; label: string }[] = [
    { value: '30', label: 'Last 30 days' },
    { value: '90', label: 'Last 90 days' },
    { value: 'all', label: 'All time' }
  ];

  readonly scopeOptions: { value: 'mine' | 'group' | 'all'; label: string }[] = [
    { value: 'mine', label: 'My claims' },
    { value: 'group', label: 'My group' },
    { value: 'all', label: 'All claims' }
  ];

  readonly displayedClaims = computed<Claim[]>(() => {
    const scope = this.claimsScope();
    const user = this.auth.user();
    // 'Matched'/'Abandoned' are terminal skeleton-only bookkeeping states — the
    // skeleton record that produced them is dead weight once resolved (either
    // superseded by a real claim, or dropped). They don't belong in a claims
    // handler's portfolio overview; FNOL Search's Claims tab is where an orphan
    // claim's full lifecycle (including these terminal states) is meant to be
    // reviewed. Every other status (including 'Awaiting policy') shows.
    let filtered = this.claims().filter(c => c.status !== 'Matched' && c.status !== 'Abandoned');
    if (user) {
      if (scope === 'mine') filtered = filtered.filter(c => c.assignee === user.name);
      else if (scope === 'group') filtered = filtered.filter(c => c.group === user.group);
    }
    // No fallback to unfiltered claims when a scope yields zero rows — an empty
    // result is real and must render the empty state, not someone else's claims.
    // Most-recently-touched first — without this, claims.json's raw array order decided
    // what showed, so anything appended to the end of that file (e.g. orphan claims) was
    // structurally invisible in a "top 5" no matter which scope was picked.
    const sorted = [...filtered].sort((a, b) => b.dateUpdated.localeCompare(a.dateUpdated));
    return sorted.slice(0, 5);
  });

  // `claims` arrives already date-filtered by the parent (dashboard.ts owns
  // dateRangedClaims() so the stats card and this widget can't drift), so
  // this widget has no way to tell "empty because of scope" apart from
  // "empty because the date window is too narrow" — it never receives the
  // claims outside that window to check against. Rather than guess, the
  // empty state always offers a one-click way out to a wider range whenever
  // one exists; harmless to show even when scope was the real reason.
  readonly canWidenDateRange = computed<boolean>(() => this.dateRange() !== 'all');

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
