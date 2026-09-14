import { Component, inject, effect, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { trigger, style, animate, transition } from '@angular/animations';
import { Router } from '@angular/router';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
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
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { firstValueFrom } from 'rxjs';
import { FnolStateService } from '../../../../core/services/fnol-state.service';
import {
  ConvertSkeletonModalComponent,
  ConvertSkeletonModalData,
  ConvertSkeletonModalResult,
} from '../../../../shared/components/convert-skeleton-modal/convert-skeleton-modal.component';
import { MockPolicySearchService } from '../../../../core/mock/services/mock-policy-search.service';
import { MockClaimService } from '../../../../core/mock/services/mock-claim.service';
import { PolicySearchResult } from '../../models/fnol-form.model';
import { Claim } from '../../../../core/models/claim.model';
import { StatusChipComponent } from '../../../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import lookupsData from '../../../../core/mock/data/lookups.json';

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; claims: Claim[]; policies: PolicySearchResult[] }
  | { kind: 'error'; message: string };

const UNDERWRITING_YEARS = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];
const PAGE_SIZE = 10;

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
    StatusChipComponent,
    EmptyStateComponent,
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
export class Step1SearchComponent {
  private fnolState = inject(FnolStateService);
  private searchSvc = inject(MockPolicySearchService);
  private claimSvc  = inject(MockClaimService);
  private router     = inject(Router);
  private dialogSvc  = inject(NxDialogService);
  private readonly live = inject(LiveAnnouncer);

  readonly years             = UNDERWRITING_YEARS;
  readonly linesOfBusiness   = lookupsData.linesOfBusiness;
  readonly operatingEntities = lookupsData.operatingEntities;
  readonly form: FormGroup   = this.fnolState.getStepGroup('search');
  readonly pageSize          = PAGE_SIZE;

  showSecondaryFilters = false;
  validationError: string | null = null;
  activeTab = 0; // 0 = Claims, 1 = Policies
  selectedPolicyNumber: string | null = null;
  selectedPolicyData: PolicySearchResult | null = null;
  claimPage = 1;
  policyPage = 1;
  hasSearched = false;

  readonly skeletonDetailedTooltip =
    'Use skeleton claim when:\n' +
    '• Policy not yet issued but loss occurred\n' +
    '• Cannot find policy in system\n' +
    '• Unclear which policy covers this loss\n' +
    '• Need to start investigation immediately\n\n' +
    '⚠ You must match a policy within 3 business days.';

  private readonly trigger$  = new BehaviorSubject<'search' | 'idle'>('idle');

  private readonly devSearchFill = toSignal(this.fnolState.devSearchFill$);
  private pendingAutoSelectPolicyNumber: string | null = null;

  /** Set when a skeleton-conversion fill fires — drives the "Converting
   *  from…" banner. Not just devSearchFill() itself, since that's a Subject
   *  emission (fires once, doesn't stay true) and the banner needs to stay
   *  visible for the rest of the page's lifetime until cancelled. */
  readonly convertingFromSkeletonId = signal<string | null>(null);

  constructor() {
    // Dev-banner triggered fill: set search fields, run the search, then
    // auto-select the matching policy once results land (handled by the
    // state$ effect below — search results resolve asynchronously).
    effect(() => {
      const fill = this.devSearchFill();
      if (!fill) return;
      const { policyNumber, clientName } = fill;
      this.form.get('clientName')?.setValue(clientName);
      this.form.get('policyNumber')?.setValue(policyNumber);
      this.validationError = null;
      this.claimPage = 1;
      this.policyPage = 1;
      this.selectedPolicyNumber = null;
      this.selectedPolicyData = null;
      this.hasSearched = true;
      this.pendingAutoSelectPolicyNumber = policyNumber;
      this.convertingFromSkeletonId.set(this.fnolState.skeletonClaimId);
      if (this.fnolState.skeletonClaimId) {
        this.live.announce(`Converting from ${this.fnolState.skeletonClaimId}`, 'polite');
      }
      this.trigger$.next('search');
    });

    // Auto-select matching policy row once a dev-triggered search resolves.
    effect(() => {
      const state = this.searchState();
      const policyNumber = this.pendingAutoSelectPolicyNumber;
      if (!policyNumber || !state || state.kind !== 'results') return;
      this.pendingAutoSelectPolicyNumber = null;
      const policy = state.policies.find(
        p => p.policyNumber.toLowerCase() === policyNumber.toLowerCase(),
      ) ?? state.policies[0] ?? null;
      if (policy) {
        this.selectedPolicyNumber = policy.policyNumber;
        this.selectedPolicyData   = policy;
        this.activeTab = 1;
      }
    });
  }

  readonly state$: Observable<SearchState> = this.trigger$.pipe(
    switchMap(t => {
      if (t === 'idle') return of<SearchState>({ kind: 'idle' });
      const criteria = this.form.value;
      return this.claimSvc.searchClaims({
        clientName:   criteria.clientName ?? '',
        policyNumber: criteria.policyNumber ?? '',
      }).pipe(
        switchMap(claims =>
          this.searchSvc.searchPolicies(criteria).pipe(
            switchMap(policies => {
              this._applyAutoTabSwitch(claims, policies);
              return of<SearchState>({ kind: 'results', claims, policies });
            }),
          )
        ),
        catchError(err => of<SearchState>({
          kind: 'error',
          message: (err as { message?: string })?.message ?? 'Search failed. Please try again.',
        })),
      );
    }),
  );

  private readonly searchState = toSignal(this.state$);

  private _applyAutoTabSwitch(claims: Claim[], policies: PolicySearchResult[]): void {
    this.activeTab = (claims.length === 0 && policies.length > 0) ? 1 : 0;
  }

  // ── Claims table helpers (also covers orphan-claim statuses) ────────

  getSkeletonRowClass(claim: Claim): string {
    if (claim.status === 'Awaiting policy') return 'skeleton-awaiting';
    if (claim.status === 'Matched')         return 'skeleton-matched';
    if (claim.status === 'Abandoned')       return 'skeleton-abandoned';
    return '';
  }

  private daysSince(dateCreated: string): number {
    return Math.floor((Date.now() - new Date(dateCreated).getTime()) / (1000 * 60 * 60 * 24));
  }

  getDaysSinceLabel(claim: Claim): string {
    const days = this.daysSince(claim.dateCreated);
    if (claim.status !== 'Awaiting policy') return `${days}d`;
    const remaining = (claim.slaDeadlineDays ?? 0) - days;
    if (remaining < 0) return `${days}d (overdue ${Math.abs(remaining)}d)`;
    if (remaining === 0) return `${days}d (due today)`;
    return `${days}d (${remaining}d left)`;
  }

  isDaySlaUrgent(claim: Claim): boolean {
    return claim.status === 'Awaiting policy' &&
           ((claim.slaDeadlineDays ?? 0) - this.daysSince(claim.dateCreated)) <= 1;
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
  async onConvertSkeleton(skeleton: Claim): Promise<void> {
    if (skeleton.status !== 'Awaiting policy') return;

    const data: ConvertSkeletonModalData = { skeleton };
    const ref = this.dialogSvc.open(ConvertSkeletonModalComponent, {
      data,
      width: '960px',
      maxWidth: '92vw',
    });
    const policy = await firstValueFrom(ref.afterClosed()) as ConvertSkeletonModalResult;
    if (!policy) return;   // cancelled

    // Seed convert state + selected policy, then go straight into the wizard.
    this.fnolState.prefillFromSkeleton(skeleton);
    this.fnolState.setSelectedPolicy(
      { policyId: policy.policyNumber, policyNumber: policy.policyNumber },
      policy,
    );
    this.fnolState.path = 'standard';
    this.router.navigate(['/fnol/loss-information']);
  }

  // ── Button visibility/state ──────────────────────────────────────

  isEmptyResults(state: SearchState): boolean {
    return state.kind === 'results' && state.claims.length === 0 && state.policies.length === 0;
  }

  showRegisterClaim(state: SearchState): boolean {
    return state.kind === 'results' && state.policies.length > 0;
  }

  registerClaimDisabled(): boolean {
    return !this.selectedPolicyNumber;
  }

  registerClaimTooltip(): string {
    return this.selectedPolicyNumber ? '' : 'Select a policy to continue';
  }

  showRegisterSkeleton(state: SearchState): boolean {
    if (state.kind !== 'results') return false;
    if (this.selectedPolicyNumber) return false;
    // Mutually exclusive with isEmptyResults() — that state renders its own
    // "Register a skeleton claim" CTA inside the empty-state body, so this
    // footer button must not also render or the footer shows it twice.
    return state.claims.length > 0 || state.policies.length > 0;
  }

  registerSkeletonDisabled(): boolean {
    return !(this.form.get('clientName')?.value as string)?.trim();
  }

  registerSkeletonTooltip(): string {
    return this.registerSkeletonDisabled()
      ? 'Enter a client name to register a skeleton claim'
      : this.skeletonDetailedTooltip;
  }

  // ── Actions ─────────────────────────────────────────────────────

  get hasAnyCriteria(): boolean {
    return Object.values(this.form.value).some(v => v !== null && v !== undefined && v !== '');
  }

  onSelectPolicy(policy: PolicySearchResult): void {
    this.selectedPolicyNumber = policy.policyNumber;
    this.selectedPolicyData = policy;
  }

  onSearch(): void {
    this.validationError = null;
    if (!this.hasAnyCriteria) {
      this.validationError = 'Please enter at least one search criterion.';
      return;
    }
    this.claimPage = 1;
    this.policyPage = 1;
    this.selectedPolicyNumber = null;
    this.selectedPolicyData = null;
    this.hasSearched = true;
    this.trigger$.next('search');
  }

  onReset(): void {
    this.form.reset();
    this.validationError = null;
    this.hasSearched = false;
    this.selectedPolicyNumber = null;
    this.selectedPolicyData = null;
    this.trigger$.next('idle');
  }

  onCancel(): void {
    this.router.navigate(['/dashboard']);
  }

  onCancelConversion(): void {
    this.fnolState.reset();
    this.convertingFromSkeletonId.set(null);
    this.onReset();
  }

  onRegisterClaim(): void {
    if (this.selectedPolicyNumber) {
      this.fnolState.setSelectedPolicy(
        { policyId: this.selectedPolicyNumber, policyNumber: this.selectedPolicyNumber },
        this.selectedPolicyData ?? undefined,
      );
      this.fnolState.path = 'standard';
    }
    this.router.navigate(['/fnol/loss-information']);
  }

  onRegisterSkeleton(): void {
    const clientName = (this.form.get('clientName')?.value as string)?.trim() ?? '';
    if (clientName) {
      this.fnolState.setSelectedClient({ clientId: '', clientName });
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

  pagedClaims(claims: Claim[]): Claim[] {
    const start = (this.claimPage - 1) * PAGE_SIZE;
    return claims.slice(start, start + PAGE_SIZE);
  }

  pagedPolicies(policies: PolicySearchResult[]): PolicySearchResult[] {
    const start = (this.policyPage - 1) * PAGE_SIZE;
    return policies.slice(start, start + PAGE_SIZE);
  }
}
