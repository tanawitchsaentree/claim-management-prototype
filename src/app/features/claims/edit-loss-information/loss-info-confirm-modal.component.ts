import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ImpactedSectionsWarningComponent } from './impacted-sections-warning.component';
import { SectionImpact } from './impacted-sections';
import { LossInfoDiffField } from './loss-info-diff';

export interface LossInfoConfirmModalData {
  claimId: string;
  diffs: LossInfoDiffField[];
  /** Sections these updates hit — see impacted-sections.ts. */
  impacts: SectionImpact[];
}

export type LossInfoConfirmModalResult = 'confirmed' | null;

@Component({
  selector: 'app-loss-info-confirm-modal',
  standalone: true,
  imports: [
    CommonModule, NxModalModule, NxButtonModule, NxIconModule, NxMessageModule,
    EmptyStateComponent, ImpactedSectionsWarningComponent,
  ],
  templateUrl: './loss-info-confirm-modal.component.html',
  styleUrl: './loss-info-confirm-modal.component.scss',
})
export class LossInfoConfirmModalComponent {
  private readonly ref  = inject<NxModalRef<LossInfoConfirmModalComponent, LossInfoConfirmModalResult>>(NxModalRef);
  readonly data = inject<LossInfoConfirmModalData>(NX_MODAL_DATA);

  // Fallback for a damage-type update that names no section — e.g. the claim
  // has no open sections yet, or the selection was only reordered. The
  // impacted-sections warning covers every other case with actual names.
  readonly damageChanged = computed(() => this.data.diffs.some(d => d.label.endsWith(' damages')));

  onConfirm(): void { this.ref.close('confirmed'); }
  onCancel():  void { this.ref.close(null); }
}
