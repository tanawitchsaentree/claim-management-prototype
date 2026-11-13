import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { FnolAckLetter } from '../../../core/models/fnol-acknowledgement.model';
import { AppDatePipe } from '../../pipes/app-date.pipe';

export interface FnolAckPreviewData {
  documentName: string;
  generatedAt: string;
  letter: FnolAckLetter;
}

// BMPCC-22635: "open the generated document". The real PDF comes from AOMS;
// this mock shows the letter with the claim and policy data it was filled
// with (epic BMPCC-22600 AC2), as they were when it was generated.
@Component({
  selector: 'app-fnol-acknowledgement-preview',
  standalone: true,
  imports: [NxModalModule, NxButtonModule, NxIconModule, AppDatePipe],
  templateUrl: './fnol-acknowledgement-preview.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './fnol-acknowledgement-preview.component.scss'
})
export class FnolAcknowledgementPreviewComponent {
  readonly data = inject<FnolAckPreviewData>(NX_MODAL_DATA);
  private readonly modalRef = inject<NxModalRef<FnolAcknowledgementPreviewComponent>>(NxModalRef);

  close(): void {
    this.modalRef.close();
  }
}
