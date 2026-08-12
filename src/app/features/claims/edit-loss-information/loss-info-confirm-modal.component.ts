import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

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
  imports: [CommonModule, NxModalModule, NxButtonModule, NxIconModule, NxMessageModule, EmptyStateComponent],
  templateUrl: './loss-info-confirm-modal.component.html',
  styleUrl: './loss-info-confirm-modal.component.scss',
})
export class LossInfoConfirmModalComponent {
  private readonly ref  = inject<NxModalRef<LossInfoConfirmModalComponent, LossInfoConfirmModalResult>>(NxModalRef);
  readonly data = inject<LossInfoConfirmModalData>(NX_MODAL_DATA);

  readonly damageChanged = computed(() => this.data.diffs.some(d => d.label.endsWith(' damages')));

  onConfirm(): void { this.ref.close('confirmed'); }
  onCancel():  void { this.ref.close(null); }
}
