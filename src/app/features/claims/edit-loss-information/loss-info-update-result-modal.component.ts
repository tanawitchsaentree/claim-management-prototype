import { Component, inject } from '@angular/core';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { LossInfoDiffField } from './loss-info-diff';

export interface LossInfoUpdateResultModalData {
  claimId: string;
  diffs: LossInfoDiffField[];
  impacted: boolean;
}

export type LossInfoUpdateResultModalResult = 'stay' | 'overview' | 'sections' | null;

@Component({
  selector: 'app-loss-info-update-result-modal',
  standalone: true,
  imports: [NxModalModule, NxButtonModule, NxIconModule, NxMessageModule],
  templateUrl: './loss-info-update-result-modal.component.html',
  styleUrl: './loss-info-update-result-modal.component.scss'
})
export class LossInfoUpdateResultModalComponent {
  private readonly ref =
    inject<NxModalRef<LossInfoUpdateResultModalComponent, LossInfoUpdateResultModalResult>>(
      NxModalRef
    );
  readonly data = inject<LossInfoUpdateResultModalData>(NX_MODAL_DATA);

  stay(): void {
    this.ref.close('stay');
  }
  goToOverview(): void {
    this.ref.close('overview');
  }
  goToSections(): void {
    this.ref.close('sections');
  }
}
