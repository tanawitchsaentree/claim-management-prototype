import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { trigger, style, animate, transition } from '@angular/animations';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { catchError, switchMap, takeUntil } from 'rxjs/operators';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxTabsModule } from '@allianz/ng-aquila/tabs';
import { NxPaginationModule } from '@allianz/ng-aquila/pagination';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { FnolStateService } from '../../services/fnol-state.service';
import { MockPolicySearchService } from '../../../../core/mock/services/mock-policy-search.service';
import { MockClientSearchService } from '../../../../core/mock/services/mock-client-search.service';
import { MockSkeletonSearchService } from '../../../../core/mock/services/mock-skeleton-search.service';
import { PolicySearchResult, ClientSearchResult } from '../../models/fnol-form.model';
import { SkeletonClaim } from '../../../../core/models/skeleton-claim.model';
import lookupsData from '../../../../core/mock/data/lookups.json';

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; clients: ClientSearchResult[]; policies: PolicySearchResult[]; skeletons: SkeletonClaim[] }
  | { kind: 'error'; message: string };

const UNDERWRITING_YEARS = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];
const PAGE_SIZE = 10;
const BANNER_DISMISSED_KEY = 'dismissed-skeleton-banner';

@Component({
  selector: 'app-step-1-search',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxButtonModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule,
    NxIconModule,
    NxSpinnerModule,
    NxTabsModule,
    NxPaginationModule,
    NxTooltipModule,
    NxMessageModule,
    NxContextMenuModule,
  ],
  templateUrl: './step-1-search.component.html',
  styleUrl: './step-1-search.component.scss',
  animations: [
    trigger('expandCollapse', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-8px)' }),
        animate('180ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      transition(':leave', [
        animate('140ms ease-in', style({ opacity: 0, transform: 'translateY(-8px)' })),
      ]),
    ]),
  ],
})
export class Step1SearchComponent implements OnInit, OnDestroy {
  private fnolState    = inject(FnolStateService);
  private searchSvc    = inject(MockPolicySearchService);
  private clientSvc    = inject(MockClientSearchService);
  private skeletonSvc  = inject(MockSkeletonSearchService);
  private router       = inject(Router);

  readonly years             = UNDERWRITING_YEARS;
  readonly linesOfBusiness   = lookupsData.linesOfBusiness;
  readonly operatingEntities = lookupsData.operatingEntities;
  readonly form: FormGroup   = this.fnolState.getStepGroup('search');
  readonly pageSize          = PAGE_SIZE;

  showSecondaryFilters = false;
  validationError: string | null = null;
  activeTab = 0;
  selectedClientId: string | null = null;
  selectedClientData: ClientSearchResult | null = null;
  selectedPolicyNumber: string | null = null;
  selectedPolicyData: PolicySearchResult | null = null;
  clientPage = 1;
  policyPage = 1;
  hasSearched = false;
  bannerDismissed = localStorage.getItem(BANNER_DISMISSED_KEY) === 'true';

  readonly skeletonDetailedTooltip =
    'Use skeleton claim when:\n' +
    '• Policy not yet issued but loss occurred\n' +
    '• Cannot find policy in system\n' +
    '• Unclear which policy covers this loss\n' +
    '• Need to start investigation immediately\n\n' +
    '⚠ You must match a policy within 3 business days.';

  private readonly trigger$  = new BehaviorSubject<'search' | 'idle'>('idle');
  private readonly destroy$  = new Subject<void>();

  ngOnInit(): void {
    this.fnolState.devSearchFill$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ policyNumber, clientName }) => {
        this.form.get('clientName')?.setValue(clientName);
        this.form.get('policyNumber')?.setValue(policyNumber);
        this.validationError = null;
        this.clientPage = 1;
        this.policyPage = 1;
        this.selectedClientId = null;
        this.selectedClientData = null;
        this.selectedPolicyNumber = null;
        this.selectedPolicyData = null;
        this.hasSearched = true;
        this.trigger$.next('search');

        // Auto-select matching policy row after results load
        this.state$.pipe(
          takeUntil(this.destroy$),
          switchMap(state => {
            if (state.kind !== 'results') return of(null);
            const match = state.policies.find(
              p => p.policyNumber.toLowerCase() === policyNumber.toLowerCase(),
            ) ?? state.policies[0] ?? null;
            return of(match);
          }),
        ).subscribe(policy => {
          if (policy) {
            this.selectedPolicyNumber = policy.policyNumber;
            this.selectedPolicyData   = policy;
            this.selectedClientId     = null;
            this.selectedClientData   = null;
            this.activeTab = 1;
          }
        });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  readonly state$: Observable<SearchState> = this.trigger$.pipe(
    switchMap(t => {
      if (t === 'idle') return of<SearchState>({ kind: 'idle' });
      const criteria = this.form.value;
      const clientQuery = criteria.clientName ?? '';
      return this.clientSvc.searchClients(clientQuery).pipe(
        switchMap(clients =>
          this.searchSvc.searchPolicies(criteria).pipe(
            switchMap(policies =>
              this.skeletonSvc.searchSkeletonClaims(criteria).pipe(
                switchMap(skeletons => {
                  this._applyAutoTabSwitch(clients, policies, skeletons);
                  return of<SearchState>({ kind: 'results', clients, policies, skeletons });
                }),
              )
            ),
          )
        ),
        catchError(err => of<SearchState>({
          kind: 'error',
          message: (err as { message?: string })?.message ?? 'Search failed. Please try again.',
        })),
      );
    }),
  );

  private _applyAutoTabSwitch(
    clients: ClientSearchResult[],
    policies: PolicySearchResult[],
    skeletons: SkeletonClaim[],
  ): void {
    const hasAwaiting = skeletons.some(s => s.status === 'awaiting-policy');
    const hasClientsOrPolicies = clients.length > 0 || policies.length > 0;

    if (hasAwaiting && !hasClientsOrPolicies) {
      this.activeTab = 2; // auto-switch to Skeleton Claims
    } else if (!hasClientsOrPolicies && skeletons.length > 0) {
      this.activeTab = 2; // only skeletons found (all matched/abandoned)
    } else if (clients.length === 0 && policies.length > 0) {
      this.activeTab = 1; // no clients but policies
    } else {
      this.activeTab = 0; // default: clients
    }
  }

  // ── Banner helpers ───────────────────────────────────────────────

  showBanner(state: SearchState): boolean {
    if (state.kind !== 'results') return false;
    if (this.bannerDismissed) return false;
    const hasClientsOrPolicies = state.clients.length > 0 || state.policies.length > 0;
    return hasClientsOrPolicies && state.skeletons.some(s => s.status === 'awaiting-policy');
  }

  bannerAwaitingSkeletons(state: SearchState): SkeletonClaim[] {
    if (state.kind !== 'results') return [];
    return state.skeletons.filter(s => s.status === 'awaiting-policy');
  }

  dismissBanner(): void {
    this.bannerDismissed = true;
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
  }

  viewSkeletonTab(): void {
    this.activeTab = 2;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Skeleton table helpers ───────────────────────────────────────

  hasSkeletonBadge(state: SearchState): boolean {
    return state.kind === 'results' && state.skeletons.some(s => s.status === 'awaiting-policy');
  }

  getSkeletonRowClass(skeleton: SkeletonClaim): string {
    if (skeleton.status === 'awaiting-policy') return 'skeleton-awaiting';
    if (skeleton.status === 'matched')         return 'skeleton-matched';
    return 'skeleton-abandoned';
  }

  getDaysSinceLabel(skeleton: SkeletonClaim): string {
    const days = skeleton.daysSinceCreation;
    const remaining = skeleton.slaDeadlineDays - days;
    if (skeleton.status !== 'awaiting-policy') return `${days}d`;
    if (remaining < 0) return `${days}d (overdue ${Math.abs(remaining)}d)`;
    if (remaining === 0) return `${days}d (due today)`;
    return `${days}d (${remaining}d left)`;
  }

  isDaySlaUrgent(skeleton: SkeletonClaim): boolean {
    return skeleton.status === 'awaiting-policy' &&
           (skeleton.slaDeadlineDays - skeleton.daysSinceCreation) <= 1;
  }

  onViewClaim(claimId: string): void {
    this.router.navigate(['/claims', claimId]);
  }

  onComingSoon(): void {
    // Phase 2 actions — silently ignore for now
  }

  // BMPCC-11006: convert skeleton → regular claim
  // Prefills loss-information from the skeleton record, drops the user back
  // into the standard FNOL flow (search → policy → loss-info → ... → summary).
  onConvertSkeleton(skeleton: SkeletonClaim): void {
    if (skeleton.status !== 'awaiting-policy') return;
    this.fnolState.prefillFromSkeleton(skeleton);
    this.router.navigate(['/fnol/search']);
  }

  convertingSkeletonId(): string | null {
    return this.fnolState.path === 'standard' ? this.fnolState.skeletonClaimId : null;
  }

  cancelConvert(): void {
    this.fnolState.reset();
  }

  // ── Client helpers ───────────────────────────────────────────────

  isBroker(client: ClientSearchResult): boolean {
    return client.role?.toLowerCase() === 'broker';
  }

  isSelectableClient(client: ClientSearchResult): boolean {
    return !this.isBroker(client);
  }

  // ── Button visibility/state ──────────────────────────────────────

  isEmptyResults(state: SearchState): boolean {
    return state.kind === 'results' &&
           state.clients.length === 0 &&
           state.policies.length === 0 &&
           state.skeletons.length === 0;
  }

  showRegisterClaim(state: SearchState): boolean {
    if (state.kind !== 'results') return false;
    return state.clients.length > 0 || state.policies.length > 0;
  }

  registerClaimDisabled(_state: SearchState): boolean {
    return !this.selectedClientId && !this.selectedPolicyNumber;
  }

  registerClaimTooltip(_state: SearchState): string {
    if (!this.selectedClientId && !this.selectedPolicyNumber) return 'Select a client or policy';
    if (this.selectedClientId && !this.selectedPolicyNumber) return 'Select a policy or use skeleton claim';
    return '';
  }

  showRegisterSkeleton(state: SearchState): boolean {
    if (state.kind !== 'results') return false;
    if (this.selectedPolicyNumber) return false;
    if (state.clients.length === 0 && state.policies.length === 0) return false;
    return true;
  }

  registerSkeletonDisabled(state: SearchState): boolean {
    if (state.kind !== 'results') return true;
    const hasResults = state.clients.length > 0 || state.policies.length > 0;
    return hasResults && !this.selectedClientId && !this.selectedPolicyNumber;
  }

  registerSkeletonTooltip(state: SearchState): string {
    if (!this.selectedClientId && !this.selectedPolicyNumber) return 'Select a client first';
    const client = this.selectedClientData;
    if (!client) return '';
    if (client.activePolicyCount === 0) return 'This client has no active policies';
    return this.skeletonDetailedTooltip;
  }

  getSkeletonButtonLabel(): string {
    if (this.selectedClientData && this.selectedClientData.activePolicyCount === 0) {
      return `Create claim for ${this.selectedClientData.legalName}`;
    }
    return 'Register a skeleton claim';
  }

  // ── Actions ─────────────────────────────────────────────────────

  get hasAnyCriteria(): boolean {
    return Object.values(this.form.value).some(v => v !== null && v !== undefined && v !== '');
  }

  onSelectPolicy(policy: PolicySearchResult): void {
    this.selectedPolicyNumber = policy.policyNumber;
    this.selectedPolicyData = policy;
    this.selectedClientId = null;
    this.selectedClientData = null;
  }

  onSearch(): void {
    this.validationError = null;
    if (!this.hasAnyCriteria) {
      this.validationError = 'Please enter at least one search criterion.';
      return;
    }
    this.clientPage = 1;
    this.policyPage = 1;
    this.selectedClientId = null;
    this.selectedClientData = null;
    this.selectedPolicyNumber = null;
    this.selectedPolicyData = null;
    this.hasSearched = true;
    this.trigger$.next('search');
  }

  onReset(): void {
    this.form.reset();
    this.validationError = null;
    this.hasSearched = false;
    this.selectedClientId = null;
    this.selectedClientData = null;
    this.selectedPolicyNumber = null;
    this.selectedPolicyData = null;
    this.trigger$.next('idle');
  }

  onCancel(): void {
    this.router.navigate(['/dashboard']);
  }

  onSelectClient(partyId: string, client: ClientSearchResult): void {
    if (!this.isSelectableClient(client)) return;
    this.selectedClientId = partyId;
    this.selectedClientData = client;
    this.selectedPolicyNumber = null;
  }

  onRegisterClaim(): void {
    if (this.selectedPolicyNumber) {
      this.fnolState.setSelectedPolicy(
        { policyId: this.selectedPolicyNumber, policyNumber: this.selectedPolicyNumber },
        this.selectedPolicyData ?? undefined,
      );
      this.fnolState.path = 'standard';
    } else if (this.selectedClientId) {
      this.fnolState.setSelectedClient({ clientId: this.selectedClientId, clientName: this.selectedClientData?.legalName ?? '' });
      this.fnolState.path = 'standard';
    }
    this.router.navigate(['/fnol/loss-information']);
  }

  onRegisterSkeleton(state: SearchState): void {
    if (this.selectedClientId && state.kind === 'results') {
      const client = state.clients.find(c => c.partyId === this.selectedClientId);
      this.fnolState.setSelectedClient({ clientId: this.selectedClientId, clientName: client?.legalName ?? '' });
    }
    this.fnolState.path = 'orphan';
    this.router.navigate(['/fnol/skeleton-create']);
  }

  onRefineSearch(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleSecondaryFilters(): void {
    this.showSecondaryFilters = !this.showSecondaryFilters;
  }

  switchToTab(index: number): void {
    this.activeTab = index;
  }

  pagedClients(clients: ClientSearchResult[]): ClientSearchResult[] {
    const start = (this.clientPage - 1) * PAGE_SIZE;
    return clients.slice(start, start + PAGE_SIZE);
  }

  pagedPolicies(policies: PolicySearchResult[]): PolicySearchResult[] {
    const start = (this.policyPage - 1) * PAGE_SIZE;
    return policies.slice(start, start + PAGE_SIZE);
  }
}
