import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
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
    NxDropdownModule,
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

  // Common reopening reasons — analytics-friendly enum so the activity log
  // can group by reason instead of free-text. "Other" stays as the escape
  // hatch; the optional note field captures specifics.
  readonly reopenReasons: string[] = [
    'New evidence received',
    'Additional damage discovered',
    'Settlement disputed by claimant',
    'Recovery / subrogation opportunity',
    'Court ruling / litigation outcome',
    'Other',
  ];

  readonly form = this.fb.group({
    reason: [null as string | null, Validators.required],
    note:   [''],
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
    const reason = v.note?.trim() ? `${v.reason} — ${v.note!.trim()}` : v.reason!;
    const payload: ReopenPayload = {
      reason,
      reserveAmount: 0,
      reserveType:   'Initial reserve',
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
