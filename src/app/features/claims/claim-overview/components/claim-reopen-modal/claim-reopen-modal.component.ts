import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { firstValueFrom } from 'rxjs';
import { ClaimClosureService } from '../../../../../core/services/claim-closure.service';
import { ClaimOverview } from '../../../../../core/models/claim-overview.model';
import { ReopenPayload } from '../../../../../core/models/claim-closure.model';

export interface ClaimReopenModalData {
  claim: ClaimOverview;
}

export interface ClaimReopenModalResult {
  reopenedClaim: ClaimOverview;
}

@Component({
  selector: 'app-claim-reopen-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxInputModule,
    NxButtonModule,
    NxIconModule,
    NxSpinnerModule,
    NxMessageModule,
  ],
  templateUrl: './claim-reopen-modal.component.html',
  styleUrl: './claim-reopen-modal.component.scss',
})
export class ClaimReopenModalComponent {
  readonly data     = inject<ClaimReopenModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<ClaimReopenModalComponent, ClaimReopenModalResult>>(NxModalRef);
  private readonly fb         = inject(FormBuilder);
  private readonly closureSvc = inject(ClaimClosureService);

  readonly form = this.fb.group({
    reason:        ['', [Validators.required, Validators.minLength(8)]],
    reserveAmount: [0,  [Validators.required, Validators.min(1)]],
    reserveType:   ['Initial reserve', Validators.required],
  });

  saving = false;
  saveError: string | null = null;

  get claim() { return this.data.claim; }

  onCancel(): void { this.modalRef.close(undefined as unknown as ClaimReopenModalResult); }

  async onReopen(): Promise<void> {
    if (this.form.invalid || this.saving) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    this.saveError = null;
    const v = this.form.value;
    const payload: ReopenPayload = {
      reason:        v.reason!,
      reserveAmount: v.reserveAmount ?? 0,
      reserveType:   v.reserveType ?? 'Initial reserve',
      reopenedBy:    { userId: 'usr-current', name: this.claim.assignedHandler },
    };
    try {
      const reopened = await firstValueFrom(this.closureSvc.reopenClaim(this.claim.claimId, payload));
      this.modalRef.close({ reopenedClaim: reopened });
    } catch {
      this.saveError = 'Failed to reopen claim. Please try again.';
      this.saving = false;
    }
  }
}
