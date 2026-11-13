import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { MockPolicySearchService } from '../../../../core/mock/services/mock-policy-search.service';
import { PolicySearchResult } from '../../models/fnol-form.model';
import { StatusChipComponent } from '../../../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { AppDatePipe } from '../../../../shared/pipes/app-date.pipe';

export interface FindPolicyModalData {
  /** Prefilled: the coverage check works on one client's policies. */
  clientName: string;
  /** Policies already on the Policies step, shown but not pickable twice. */
  inList: string[];
}

/**
 * BMPCC-22665 AC04: "the right policy isn't in the list". Same search the
 * FNOL Search step runs (MockPolicySearchService), in the modal shape of
 * add-policies-modal. Returns the picked policy numbers; the step adds them
 * to its list, ticked.
 *
 * DESIGN DECISION IMP-4: the policy search is a modal on the Policies step,
 * not a jump back to Search. Going back to Search would start a new FNOL on
 * another policy and drop what was entered; adding from here keeps the loss
 * information and lets the found policy sit next to the suggestions.
 */
@Component({
  selector: 'app-find-policy-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxModalModule,
    NxButtonModule,
    NxIconModule,
    NxTableModule,
    NxCheckboxModule,
    NxFormfieldModule,
    NxInputModule,
    NxSpinnerModule,
    StatusChipComponent,
    EmptyStateComponent,
    AppDatePipe
  ],
  templateUrl: './find-policy-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './find-policy-modal.component.scss'
})
export class FindPolicyModalComponent {
  readonly data = inject<FindPolicyModalData>(NX_MODAL_DATA);
  private readonly modalRef = inject<NxModalRef<FindPolicyModalComponent, string[]>>(NxModalRef);
  private readonly searchSvc = inject(MockPolicySearchService);

  readonly form = new FormGroup({
    policyNumber: new FormControl('', { nonNullable: true }),
    clientName: new FormControl(this.data.clientName, { nonNullable: true })
  });

  readonly searching = signal(false);
  readonly searched = signal(false);
  readonly failed = signal(false);
  readonly results = signal<PolicySearchResult[]>([]);
  readonly picked = signal<ReadonlySet<string>>(new Set());

  async onSearch(): Promise<void> {
    this.searching.set(true);
    this.failed.set(false);
    try {
      const rows = await firstValueFrom(this.searchSvc.searchPolicies(this.form.getRawValue()));
      this.results.set(rows);
    } catch {
      this.failed.set(true);
      this.results.set([]);
    } finally {
      this.searching.set(false);
      this.searched.set(true);
    }
  }

  inList(p: string): boolean {
    return this.data.inList.includes(p);
  }

  isPicked(p: string): boolean {
    return this.picked().has(p);
  }

  toggle(p: string): void {
    const next = new Set(this.picked());
    if (next.has(p)) next.delete(p);
    else next.add(p);
    this.picked.set(next);
  }

  onCancel(): void {
    this.modalRef.close([]);
  }

  onAdd(): void {
    this.modalRef.close(this.results().map(r => r.policyNumber).filter(p => this.picked().has(p)));
  }
}
