import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NxModalModule, NxModalRef } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';

export type LossInfoDiscardModalResult = 'discard' | null;

@Component({
  selector: 'app-loss-info-discard-modal',
  standalone: true,
  imports: [NxModalModule, NxButtonModule],
  templateUrl: './loss-info-discard-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './loss-info-discard-modal.component.scss'
})
export class LossInfoDiscardModalComponent {
  readonly ref =
    inject<NxModalRef<LossInfoDiscardModalComponent, LossInfoDiscardModalResult>>(NxModalRef);
}
