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
import { NxTabsModule } from '@allianz/ng-aquila/tabs';
import { firstValueFrom } from 'rxjs';
import lookupsData from '../../../core/mock/data/lookups.json';
import { MockClientSearchService } from '../../../core/mock/services/mock-client-search.service';
import { StatusChipComponent } from '../status-chip/status-chip.component';
import { MockPolicySearchService } from '../../../core/mock/services/mock-policy-search.service';
import { ClientSearchResult, PolicySearchResult } from '../../../features/fnol/models/fnol-form.model';
import { Claim } from '../../../core/models/claim.model';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

export interface ConvertSkeletonModalData {
  skeleton: Claim;
  // Called when a policy is picked. Resolve true to close the picker (the caller
  // has taken over), false to stay on the list. Without it, picking just closes
  // the picker with the policy.
  onPick?: (policy: PolicySearchResult) => Promise<boolean>;
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
    NxTabsModule,
    StatusChipComponent,
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

  readonly selectedNumber = signal<string | null>(null);

  // Same search as FNOL "Client and policy search": the general fields, then the
  // result tabs. Client name starts pre-filled with the skeleton's client and
  // the search runs on open, so the filter in force is visible and editable.
  readonly years = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];
  readonly linesOfBusiness = lookupsData.linesOfBusiness;
  readonly showMore = signal(false);
  readonly searching = signal(true);
  readonly activeTab = signal(1); // 0 = Clients, 1 = Policies
  readonly policies = signal<PolicySearchResult[]>([]);
  readonly clients = signal<ClientSearchResult[]>([]);
  private readonly clientSvc = inject(MockClientSearchService);
  readonly searchForm = new FormGroup({
    clientName: new FormControl(''),
    policyNumber: new FormControl(''),
    underwritingYear: new FormControl<string | null>(null),
    broker: new FormControl(''),
    lineOfBusiness: new FormControl<string | null>(null)
  });
  private readonly appliedClientName = signal('');

  get skeleton(): Claim {
    return this.data.skeleton;
  }

  // Name left as the skeleton typed it: a non-matching client shows greyed as
  // "Different client". Name edited by the handler: that rule is skipped, since
  // overriding the name is them saying the typed one was wrong.
  readonly rows = computed<PolicyRow[]>(() => {
    const untouched =
      this.normalizeClientName(this.appliedClientName()) ===
      this.normalizeClientName(this.skeleton.clientName);
    return this.policies()
      .map(p => this.evaluate(p, untouched))
      .sort((a, b) => Number(b.eligible) - Number(a.eligible));
  });

  async onSearch(): Promise<void> {
    const v = this.searchForm.getRawValue();
    this.searching.set(true);
    this.selectedNumber.set(null);
    const [policies, clients] = await Promise.all([
      firstValueFrom(
        this.policySvc.searchPolicies({
          clientName: v.clientName ?? '',
          policyNumber: v.policyNumber ?? '',
          underwritingYear: v.underwritingYear ?? '',
          broker: v.broker ?? ''
        })
      ),
      firstValueFrom(this.clientSvc.searchClients({ clientName: v.clientName ?? '' }))
    ]);
    this.policies.set(
      policies.filter(p => !v.lineOfBusiness || p.lineOfBusiness === v.lineOfBusiness)
    );
    this.clients.set(clients);
    this.appliedClientName.set(v.clientName ?? '');
    this.activeTab.set(this.policies().length > 0 || clients.length === 0 ? 1 : 0);
    this.searching.set(false);
  }

  onReset(): void {
    this.searchForm.reset({ clientName: this.skeleton.clientName });
    void this.onSearch();
  }

  // Choosing a client narrows the policy list to theirs, like picking a result
  // and searching again.
  onSelectClient(client: ClientSearchResult): void {
    this.searchForm.patchValue({ clientName: client.legalName });
    void this.onSearch();
  }

  ngOnInit(): void {
    this.searchForm.patchValue({ clientName: this.skeleton.clientName });
    void this.onSearch();
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

  readonly picking = signal(false);

  // Picking a policy goes straight on to the "Link policy" confirm: no separate
  // Continue click between the two, and the list stays open underneath it.
  async select(row: PolicyRow): Promise<void> {
    if (!row.eligible || this.picking()) return;
    this.selectedNumber.set(row.policy.policyNumber);
    if (!this.data.onPick) {
      this.modalRef.close(row.policy);
      return;
    }
    this.picking.set(true);
    try {
      if (await this.data.onPick(row.policy)) {
        // The next sheet is taking over: leave without sliding away.
        this.modalRef.addPanelClass('bottom-sheet-modal-panel--instant');
        this.modalRef.close(row.policy);
      } else {
        this.selectedNumber.set(null);
      }
    } finally {
      this.picking.set(false);
    }
  }

  onCancel(): void {
    this.modalRef.close(null);
  }
}
