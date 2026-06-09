import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';

export interface LossInfoDiffField {
  label: string;
  original: string;
  updated: string;
}

export interface LossInfoConfirmModalData {
  claimId: string;
  diffs: LossInfoDiffField[];
}

export type LossInfoConfirmModalResult = 'confirmed' | null;

@Component({
  selector: 'app-loss-info-confirm-modal',
  standalone: true,
  imports: [CommonModule, NxModalModule, NxButtonModule, NxIconModule],
  templateUrl: './loss-info-confirm-modal.component.html',
  styleUrl: './loss-info-confirm-modal.component.scss',
})
export class LossInfoConfirmModalComponent {
  private readonly ref  = inject<NxModalRef<LossInfoConfirmModalComponent, LossInfoConfirmModalResult>>(NxModalRef);
  readonly data = inject<LossInfoConfirmModalData>(NX_MODAL_DATA);

  onConfirm(): void { this.ref.close('confirmed'); }
  onCancel():  void { this.ref.close(null); }
}
