import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { Claim } from '../../../core/models/claim.model';

export interface AbandonSkeletonModalData {
  skeleton: Claim;
}

// Result: the reason, or null on cancel. Required — an abandoned claim with
// no reason on record is the exact unaudited write-off the Recovery
// Potential "No" rule (this session) exists to prevent elsewhere.
export type AbandonSkeletonModalResult = string | null;

@Component({
  selector: 'app-abandon-skeleton-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxInputModule,
    NxButtonModule,
    NxIconModule
  ],
  templateUrl: './abandon-skeleton-modal.component.html',
  styleUrl: './abandon-skeleton-modal.component.scss'
})
export class AbandonSkeletonModalComponent {
  readonly data = inject<AbandonSkeletonModalData>(NX_MODAL_DATA);
  readonly modalRef =
    inject<NxModalRef<AbandonSkeletonModalComponent, AbandonSkeletonModalResult>>(NxModalRef);

  readonly reason = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(300)]
  });
  submitAttempted = false;

  get skeleton(): Claim {
    return this.data.skeleton;
  }

  onAbandon(): void {
    if (this.reason.invalid) {
      this.submitAttempted = true;
      this.reason.markAsTouched();
      return;
    }
    this.modalRef.close(this.reason.value.trim());
  }

  onCancel(): void {
    this.modalRef.close(null);
  }
}
