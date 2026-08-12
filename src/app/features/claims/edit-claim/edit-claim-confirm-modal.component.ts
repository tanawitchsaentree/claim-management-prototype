import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

export interface EditClaimDiffField {
  label: string;
  original: string;
  updated: string;
}

export interface EditClaimConfirmModalData {
  claimId: string;
  diffs: EditClaimDiffField[];
}

export type EditClaimConfirmModalResult = 'confirmed' | null;

@Component({
  selector: 'app-edit-claim-confirm-modal',
  standalone: true,
  imports: [CommonModule, NxModalModule, NxButtonModule, NxIconModule, EmptyStateComponent],
  templateUrl: './edit-claim-confirm-modal.component.html',
  styleUrl: './edit-claim-confirm-modal.component.scss',
})
export class EditClaimConfirmModalComponent {
  private readonly ref = inject<NxModalRef<EditClaimConfirmModalComponent, EditClaimConfirmModalResult>>(NxModalRef);
  readonly data = inject<EditClaimConfirmModalData>(NX_MODAL_DATA);

  onConfirm(): void { this.ref.close('confirmed'); }
  onCancel():  void { this.ref.close(null); }
}
