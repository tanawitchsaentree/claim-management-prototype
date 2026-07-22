import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { Claim } from '../../../core/models';
import { MockClaimService } from '../../../core/mock/services/mock-claim.service';

export interface ClaimSearchModalData {
  excludeClaimIds?: string[];
}

export type ClaimSearchModalResult = { claim: Claim } | null;

@Component({
  selector: 'app-claim-search-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxInputModule,
    NxButtonModule,
    NxIconModule,
    NxRadioModule,
    NxTableModule,
  ],
  templateUrl: './claim-search-modal.component.html',
  styleUrl: './claim-search-modal.component.scss',
})
export class ClaimSearchModalComponent implements OnInit {
  readonly data     = inject<ClaimSearchModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<ClaimSearchModalComponent, ClaimSearchModalResult>>(NxModalRef);
  private readonly claimSvc = inject(MockClaimService);

  readonly searchForm = new FormGroup({
    query: new FormControl(''),
  });

  readonly results      = signal<Claim[]>([]);
  readonly selectedId   = signal<string | null>(null);
  readonly hasSelection = computed(() => this.selectedId() !== null);

  async ngOnInit(): Promise<void> {
    await this.runSearch();
  }

  async onSearch(): Promise<void> {
    await this.runSearch();
  }

  async onReset(): Promise<void> {
    this.searchForm.reset();
    await this.runSearch();
  }

  private async runSearch(): Promise<void> {
    const { query } = this.searchForm.value;
    const found = await firstValueFrom(this.claimSvc.getAll({ search: query || undefined }));
    const excluded = new Set(this.data.excludeClaimIds ?? []);
    this.results.set(found.filter(c => !excluded.has(c.claimId)));
  }

  isSelected(id: string): boolean { return this.selectedId() === id; }

  selectRow(id: string): void {
    this.selectedId.set(id);
  }

  onCancel(): void { this.modalRef.close(null); }

  onConfirm(): void {
    const id = this.selectedId();
    if (!id) return;
    const claim = this.results().find(c => c.claimId === id);
    if (!claim) return;
    this.modalRef.close({ claim });
  }
}
