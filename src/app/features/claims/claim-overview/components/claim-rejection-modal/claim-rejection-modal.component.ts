import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { ClaimActivity, ClaimOverview } from '../../../../../core/models/claim-overview.model';
import { ClaimNumberPipe } from '../../../../../shared/pipes/claim-number.pipe';
import { ClaimClosureModalResult } from '../claim-closure-modal/claim-closure-modal.component';

export interface ClaimRejectionModalData {
  claim: ClaimOverview;
}

type RejectionType = 'coverage' | 'liability';

/**
 * Reject Claim: its own trigger on the Claim Overview, not a reason inside the
 * Close Claim flow (team call; Functional Design BMPCC-17630). The handler
 * classifies the rejection and gives the reason. Either type is sent for
 * approval: the claim stays Open and the request is decided from
 * Approvals > Claims, which closes the claim as Claim Rejected. No closing
 * checks apply: a handler can reject at any time (team, 2026-10-22). Returns
 * the same result shape as the closure modal so the overview applies it alike.
 */
@Component({
  selector: 'app-claim-rejection-modal',
  standalone: true,
  imports: [
    ClaimNumberPipe,
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxInputModule,
    NxRadioModule,
    NxButtonModule,
    NxIconModule
  ],
  templateUrl: './claim-rejection-modal.component.html',
  styleUrl: './claim-rejection-modal.component.scss'
})
export class ClaimRejectionModalComponent {
  readonly data = inject<ClaimRejectionModalData>(NX_MODAL_DATA);
  readonly modalRef =
    inject<NxModalRef<ClaimRejectionModalComponent, ClaimClosureModalResult>>(NxModalRef);
  private readonly fb = inject(FormBuilder);

  readonly claim = this.data.claim;

  readonly form = this.fb.group({
    rejectionType: [null as RejectionType | null, Validators.required],
    reason: ['', [Validators.required, Validators.maxLength(500)]]
  });

  private readonly formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status
  });

  readonly canSubmit = computed(() => this.formStatus() === 'VALID');

  onCancel(): void {
    this.modalRef.close(undefined);
  }

  onSubmit(): void {
    if (!this.canSubmit()) return;
    const { rejectionType, reason } = this.form.getRawValue();
    const claim = this.claim;
    const now = new Date().toISOString();
    const base = {
      claimId: claim.claimId,
      user: claim.assignedHandler,
      timestamp: now,
      objectType: 'Claim'
    };
    const reasonActivity: ClaimActivity = {
      ...base,
      id: `act-${Date.now()}-r`,
      attribute: 'Rejection reason',
      valueOld: '',
      valueNew: `${rejectionType === 'coverage' ? 'Coverage related' : 'Liability related'}: ${reason}`
    };

    // Every rejection goes to approval; the claim stays Open until it is decided.
    const pendingClaim: ClaimOverview = {
      ...claim,
      rejectionRequestedAt: now,
      rejectionRequestedBy: claim.assignedHandler,
      rejectionType: rejectionType ?? undefined,
      rejectionReason: reason ?? undefined
    };
    const activity: ClaimActivity = {
      ...base,
      id: `act-${Date.now()}`,
      attribute: 'Rejection approval',
      valueOld: 'None',
      valueNew: 'Requested'
    };
    this.modalRef.close({
      closedClaim: pendingClaim,
      activity,
      extraActivities: [reasonActivity],
      pendingApproval: true
    });
  }
}
