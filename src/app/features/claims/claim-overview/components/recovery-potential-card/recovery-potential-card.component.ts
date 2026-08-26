import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { NxLinkModule } from '@allianz/ng-aquila/link';
import { StatusChipComponent } from '../../../../../shared/components/status-chip/status-chip.component';
import { ToastService } from '../../../../../shared/components/toast/toast.service';
import { ClaimOverview, ClaimActivity } from '../../../../../core/models/claim-overview.model';
import {
  RecoveryPotentialModalComponent,
  RecoveryPotentialModalData,
  RecoveryPotentialModalResult,
} from '../recovery-potential-modal/recovery-potential-modal.component';

export interface RecoveryPotentialUpdated {
  claim: ClaimOverview;
  activity: ClaimActivity;
}

@Component({
  selector: 'app-recovery-potential-card',
  standalone: true,
  imports: [NxModalModule, NxLinkModule, StatusChipComponent],
  templateUrl: './recovery-potential-card.component.html',
  styleUrl: './recovery-potential-card.component.scss',
})
export class RecoveryPotentialCardComponent {
  @Input({ required: true }) claim!: ClaimOverview;
  @Output() updated = new EventEmitter<RecoveryPotentialUpdated>();

  private readonly dialogSvc = inject(NxDialogService);
  private readonly toast = inject(ToastService);

  async openRecoveryPotentialModal(): Promise<void> {
    const claim = this.claim;
    const current = claim.recoveryPotential ?? null;
    const ref = this.dialogSvc.open(RecoveryPotentialModalComponent, {
      data: { current } satisfies RecoveryPotentialModalData,
      width: '400px',
      maxWidth: '92vw',
    });
    const result = await firstValueFrom(ref.afterClosed()) as RecoveryPotentialModalResult | null | undefined;
    if (!result || result.value === current) return;

    const note = result.value === 'no' ? result.note : undefined;
    const activity: ClaimActivity = {
      id: `act-${Date.now()}`,
      claimId: claim.claimId,
      user: claim.assignedHandler,
      timestamp: new Date().toISOString(),
      objectType: 'Claim',
      attribute: 'Recovery potential',
      valueOld: current,
      valueNew: note ? `${result.value} — ${note}` : result.value,
    };
    this.updated.emit({
      claim: { ...claim, recoveryPotential: result.value, recoveryPotentialNote: note },
      activity,
    });

    if (result.value === 'yes') {
      this.toast.success('Recovery potential set to Yes', 'A task has been created for recovery analysis.');
    } else {
      this.toast.success('Recovery potential set to No');
    }
  }
}
