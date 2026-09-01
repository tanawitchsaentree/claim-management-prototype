import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { StatusChipComponent } from '../../../../shared/components/status-chip/status-chip.component';
import { AppDatePipe } from '../../../../shared/pipes/app-date.pipe';
import { ImpactedPolicy } from '../../../../core/models/impacted-policy.model';

export interface AddPoliciesModalData {
  basePolicyNumber: string;
  policies:         ImpactedPolicy[];
}

/**
 * Pick which of the impacted policies to pull onto the claim.
 *
 * Presentational only — it returns the chosen policy numbers and lets the
 * caller do the pulling, because the caller is the one that has to refresh the
 * entity tree afterwards.
 */
@Component({
  selector: 'app-add-policies-modal',
  standalone: true,
  imports: [
    CommonModule,
    NxModalModule,
    NxButtonModule,
    NxIconModule,
    NxTableModule,
    NxCheckboxModule,
    StatusChipComponent,
    AppDatePipe,
  ],
  templateUrl: './add-policies-modal.component.html',
  styleUrl: './add-policies-modal.component.scss',
})
export class AddPoliciesModalComponent {
  readonly data     = inject<AddPoliciesModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<AddPoliciesModalComponent, string[]>>(NxModalRef);

  private readonly selected = new Set<string>();

  isSelected(policyNumber: string): boolean {
    return this.selected.has(policyNumber);
  }

  toggle(policyNumber: string): void {
    if (this.selected.has(policyNumber)) this.selected.delete(policyNumber);
    else                                 this.selected.add(policyNumber);
  }

  get selectedCount(): number {
    return this.selected.size;
  }

  /** Entities the handler would gain from the current selection. */
  get selectedEntityCount(): number {
    return this.data.policies
      .filter(p => this.selected.has(p.policyNumber))
      .reduce((sum, p) => sum + p.availableEntityCount, 0);
  }

  onCancel(): void {
    this.modalRef.close([]);
  }

  onAdd(): void {
    if (this.selected.size === 0) return;
    // Preserve the display order rather than Set insertion order — the caller
    // reports "added N entities from M policies" and the order it walks them in
    // should match what the handler just read down the table.
    this.modalRef.close(
      this.data.policies.filter(p => this.selected.has(p.policyNumber)).map(p => p.policyNumber),
    );
  }
}
