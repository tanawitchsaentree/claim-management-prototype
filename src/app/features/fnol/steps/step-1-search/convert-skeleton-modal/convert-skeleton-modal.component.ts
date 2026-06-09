import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { firstValueFrom } from 'rxjs';
import { MockPolicySearchService } from '../../../../../core/mock/services/mock-policy-search.service';
import { PolicySearchResult } from '../../../models/fnol-form.model';
import { SkeletonClaim } from '../../../../../core/models/skeleton-claim.model';

export interface ConvertSkeletonModalData {
  skeleton: SkeletonClaim;
}

// Result: the eligible policy the user picked to bind the skeleton to (or null on cancel)
export type ConvertSkeletonModalResult = PolicySearchResult | null;

interface PolicyRow {
  policy: PolicySearchResult;
  eligible: boolean;
  reason: string | null;   // why ineligible — null when eligible
}

@Component({
  selector: 'app-convert-skeleton-modal',
  standalone: true,
  imports: [CommonModule, NxModalModule, NxButtonModule, NxIconModule, NxSpinnerModule],
  templateUrl: './convert-skeleton-modal.component.html',
  styleUrl: './convert-skeleton-modal.component.scss',
})
export class ConvertSkeletonModalComponent implements OnInit {
  readonly data     = inject<ConvertSkeletonModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<ConvertSkeletonModalComponent, ConvertSkeletonModalResult>>(NxModalRef);
  private readonly policySvc = inject(MockPolicySearchService);

  readonly loading      = signal(true);
  readonly rows         = signal<PolicyRow[]>([]);
  readonly selectedNumber = signal<string | null>(null);

  get skeleton(): SkeletonClaim { return this.data.skeleton; }

  readonly canContinue = computed(() => this.selectedNumber() !== null);

  ngOnInit(): void {
    // Pull all policies, then flag eligibility against this skeleton.
    firstValueFrom(this.policySvc.getAllPolicies()).then(policies => {
      // Narrow to policies relevant to this client: exact client match, or a
      // shared surname token (so a "different client" near-match like
      // "Kaufmann's Warehouse GmbH" surfaces as a visible ineligible example
      // rather than burying the user under every unrelated policy).
      const relevant = policies.filter(p => this.isRelevant(p));
      const evaluated = relevant
        .map(p => this.evaluate(p))
        // Eligible first, ineligible after
        .sort((a, b) => Number(b.eligible) - Number(a.eligible));
      this.rows.set(evaluated);
      this.loading.set(false);
    });
  }

  // A policy is "relevant" to show if it shares a name token with the
  // skeleton's client (catches exact match + near-matches for demo contrast).
  private isRelevant(policy: PolicySearchResult): boolean {
    const skelTokens = this.tokens(this.skeleton.clientName);
    const polTokens  = this.tokens(policy.clientName);
    return polTokens.some(t => t.length > 2 && skelTokens.includes(t));
  }

  private tokens(name: string): string[] {
    return name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  }

  // Eligibility: client match + loss date within coverage period.
  private evaluate(policy: PolicySearchResult): PolicyRow {
    const clientMatch = policy.clientName.trim().toLowerCase()
      === this.skeleton.clientName.trim().toLowerCase();
    const lossDate = this.skeleton.lossDate;

    if (!clientMatch) {
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
