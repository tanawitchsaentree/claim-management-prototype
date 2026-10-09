import { Component, inject, signal, computed, OnInit } from '@angular/core';

import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { firstValueFrom } from 'rxjs';
import { MockPolicySearchService } from '../../../core/mock/services/mock-policy-search.service';
import { PolicySearchResult } from '../../../features/fnol/models/fnol-form.model';
import { Claim } from '../../../core/models/claim.model';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

export interface ConvertSkeletonModalData {
  skeleton: Claim;
}

// Result: the eligible policy the user picked to bind the skeleton to (or null on cancel)
export type ConvertSkeletonModalResult = PolicySearchResult | null;

interface PolicyRow {
  policy: PolicySearchResult;
  eligible: boolean;
  reason: string | null; // why ineligible — null when eligible
}

@Component({
  selector: 'app-convert-skeleton-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxModalModule,
    NxButtonModule,
    NxIconModule,
    NxSpinnerModule,
    NxRadioModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule,
    EmptyStateComponent
  ],
  templateUrl: './convert-skeleton-modal.component.html',
  styleUrl: './convert-skeleton-modal.component.scss'
})
export class ConvertSkeletonModalComponent implements OnInit {
  readonly data = inject<ConvertSkeletonModalData>(NX_MODAL_DATA);
  readonly modalRef =
    inject<NxModalRef<ConvertSkeletonModalComponent, ConvertSkeletonModalResult>>(NxModalRef);
  private readonly policySvc = inject(MockPolicySearchService);

  readonly loading = signal(true);
  readonly allPolicies = signal<PolicySearchResult[]>([]);
  readonly selectedNumber = signal<string | null>(null);

  // Same fields and layout as the FNOL "Client and policy search", policy
  // criteria only (no claim number / external ref / date of loss). Searching
  // bypasses the client-name narrowing below: a skeleton exists because
  // someone was unsure which policy applies, so a typo'd or abbreviated
  // client name must not make the right policy unreachable from here.
  readonly years = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];
  readonly searched = signal<PolicySearchResult[] | null>(null);
  readonly searchForm = new FormGroup({
    clientName: new FormControl(''),
    policyNumber: new FormControl(''),
    underwritingYear: new FormControl<string | null>(null),
    broker: new FormControl('')
  });

  get skeleton(): Claim {
    return this.data.skeleton;
  }

  readonly canContinue = computed(() => this.selectedNumber() !== null);

  readonly isSearching = computed(() => this.searched() !== null);

  readonly rows = computed<PolicyRow[]>(() => {
    const found = this.searched();
    // Searched: coverage-period rule still enforced (a real fact), client-name
    // match skipped (the exact thing search exists to route around).
    if (found) {
      return found
        .map(p => this.evaluate(p, false))
        .sort((a, b) => Number(b.eligible) - Number(a.eligible));
    }
    // Default: auto-narrowed to policies relevant to this client.
    return this.allPolicies()
      .filter(p => this.isRelevant(p))
      .map(p => this.evaluate(p, true))
      .sort((a, b) => Number(b.eligible) - Number(a.eligible));
  });

  async onSearch(): Promise<void> {
    const v = this.searchForm.value;
    if (!v.clientName && !v.policyNumber && !v.underwritingYear && !v.broker) {
      this.searched.set(null);
      return;
    }
    this.selectedNumber.set(null);
    this.searched.set(
      await firstValueFrom(
        this.policySvc.searchPolicies({
          clientName: v.clientName ?? '',
          policyNumber: v.policyNumber ?? '',
          underwritingYear: v.underwritingYear ?? '',
          broker: v.broker ?? ''
        })
      )
    );
  }

  onReset(): void {
    this.searchForm.reset();
    this.searched.set(null);
    this.selectedNumber.set(null);
  }

  ngOnInit(): void {
    firstValueFrom(this.policySvc.getAllPolicies()).then(policies => {
      this.allPolicies.set(policies);
      this.loading.set(false);
    });
  }

  // A policy is "relevant" to show if it shares a name token with the
  // skeleton's client (catches exact match + near-matches for demo contrast).
  private isRelevant(policy: PolicySearchResult): boolean {
    const skelTokens = this.tokens(this.skeleton.clientName);
    const polTokens = this.tokens(policy.clientName);
    return polTokens.some(t => t.length > 2 && skelTokens.includes(t));
  }

  private tokens(name: string): string[] {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  // Punctuation/whitespace-insensitive: "Kaufmann's Warehouse GmbH" and
  // "Kaufmann's Warehouse GmbH." must match. A skeleton claim exists precisely
  // because the handler was unsure which policy applies — an exact string
  // match on a freehand-typed client name is too brittle for that use case.
  private normalizeClientName(name: string): string {
    return name.trim().toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');
  }

  // Eligibility: client match (skipped during manual search — see rows()
  // above) + loss date within coverage period (always enforced — a real
  // fact about the policy, not a name-matching heuristic).
  private evaluate(policy: PolicySearchResult, enforceClientMatch: boolean): PolicyRow {
    const clientMatch =
      this.normalizeClientName(policy.clientName) === this.normalizeClientName(this.skeleton.clientName);
    const lossDate = this.skeleton.lossDate;

    if (enforceClientMatch && !clientMatch) {
      return { policy, eligible: false, reason: 'Different client' };
    }
    if (lossDate && (lossDate < policy.effectiveDate || lossDate > policy.expiryDate)) {
      return { policy, eligible: false, reason: 'Loss date outside policy period' };
    }
    return { policy, eligible: true, reason: null };
  }

  select(row: PolicyRow): void {
    if (!row.eligible) return;
    this.selectedNumber.set(row.policy.policyNumber);
  }

  onContinue(): void {
    const sel = this.rows().find(r => r.policy.policyNumber === this.selectedNumber());
    this.modalRef.close(sel?.policy ?? null);
  }

  onCancel(): void {
    this.modalRef.close(null);
  }
}
