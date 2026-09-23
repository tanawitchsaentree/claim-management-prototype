import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { StatusChipComponent } from '../status-chip/status-chip.component';
import { AppDatePipe } from '../../pipes/app-date.pipe';
import { PolicySearchResult } from '../../../features/fnol/models/fnol-form.model';

export interface PolicyOverviewModalData {
  policy: PolicySearchResult;
}

@Component({
  selector: 'app-policy-overview-modal',
  standalone: true,
  imports: [CommonModule, NxModalModule, StatusChipComponent, AppDatePipe],
  templateUrl: './policy-overview-modal.component.html',
  styleUrl: './policy-overview-modal.component.scss'
})
export class PolicyOverviewModalComponent {
  readonly data = inject<PolicyOverviewModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<PolicyOverviewModalComponent>>(NxModalRef);

  get policy(): PolicySearchResult {
    return this.data.policy;
  }

  onClose(): void {
    this.modalRef.close();
  }
}
