import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxAccordionModule } from '@allianz/ng-aquila/accordion';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { StatusChipComponent } from '../status-chip/status-chip.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { AppDatePipe } from '../../pipes/app-date.pipe';
import { MockPolicyOverviewService } from '../../../core/mock/services/mock-policy-overview.service';
import { PolicyOverview } from '../../../core/models/policy-overview.model';
import { PolicySearchResult } from '../../../features/fnol/models/fnol-form.model';

export interface PolicyOverviewModalData {
  policy: PolicySearchResult;
}

@Component({
  selector: 'app-policy-overview-modal',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DecimalPipe,
    NxModalModule,
    NxAccordionModule,
    NxTableModule,
    NxSpinnerModule,
    NxMessageModule,
    StatusChipComponent,
    EmptyStateComponent,
    AppDatePipe
  ],
  templateUrl: './policy-overview-modal.component.html',
  styleUrl: './policy-overview-modal.component.scss'
})
export class PolicyOverviewModalComponent implements OnInit {
  readonly data = inject<PolicyOverviewModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<PolicyOverviewModalComponent>>(NxModalRef);
  private readonly svc = inject(MockPolicyOverviewService);
  private readonly router = inject(Router);

  readonly policy: PolicySearchResult = this.data.policy;

  // Header field grid renders from `policy` immediately (already in hand
  // from the search result — no need to wait). Only the accordion sections
  // below need the async fetch, since coverages/coinsurance/linkedClaims
  // aren't on the search-result row.
  readonly loadingDetails = signal(true);
  readonly overview = signal<PolicyOverview | null>(null);

  // Same rule the claim-scoped Policy overview page enforces — a policy
  // whose coinsurance shares don't total 100% is a data problem to surface,
  // not hide.
  readonly coinsuranceTotal = computed(
    () => this.overview()?.coinsurance.reduce((sum, p) => sum + p.sharePercent, 0) ?? 0
  );
  readonly coinsuranceMismatch = computed(() => {
    const list = this.overview()?.coinsurance ?? [];
    return list.length > 0 && this.coinsuranceTotal() !== 100;
  });

  async ngOnInit(): Promise<void> {
    this.loadingDetails.set(true);
    this.overview.set(await firstValueFrom(this.svc.getByPolicyNumber(this.policy.policyNumber)));
    this.loadingDetails.set(false);
  }

  formatCauseOfLoss(causes: string[] | undefined): string {
    if (!causes?.length) return '—';
    return causes.map(c => c.replace(/[-_]/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())).join(', ');
  }

  openClaim(claimId: string): void {
    this.modalRef.close();
    this.router.navigate(['/claims', claimId, 'overview']);
  }

  onClose(): void {
    this.modalRef.close();
  }
}
