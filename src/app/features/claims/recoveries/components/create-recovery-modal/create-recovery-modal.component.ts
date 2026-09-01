import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NX_MODAL_DATA, NxModalModule, NxModalRef } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NewRecoveryCase, RECOVERY_ROUTES, RecoveryRoute } from '../../../../../core/models/recovery.model';

export interface CreateRecoveryModalData {
  claimId: string;
  currency: string;
  sections: { id: string; name: string }[];
  /** Used only to warn when a case is being opened on a "No recovery" claim. */
  recoveryPotential: 'yes' | 'no' | null;
}

export interface CreateRecoveryModalResult {
  input: NewRecoveryCase;
}

@Component({
  selector: 'app-create-recovery-modal',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, NxModalModule,
    NxFormfieldModule, NxInputModule, NxDropdownModule, NxDatefieldModule,
    NxButtonModule, NxIconModule, NxMessageModule,
  ],
  templateUrl: './create-recovery-modal.component.html',
  styleUrl: './create-recovery-modal.component.scss',
})
export class CreateRecoveryModalComponent {
  readonly data     = inject<CreateRecoveryModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<CreateRecoveryModalComponent, CreateRecoveryModalResult>>(NxModalRef);
  private readonly fb = inject(FormBuilder);

  readonly routes = RECOVERY_ROUTES;

  readonly form = this.fb.group({
    route:           [null as RecoveryRoute | null, Validators.required],
    counterparty:    ['', [Validators.required, Validators.maxLength(120)]],
    sectionRef:      [null as string | null],
    estimatedAmount: [null as number | null, [Validators.required, Validators.min(1)]],
    expectedDate:    [null as string | null],
    note:            [''],
  });

  /**
   * Opening a recovery case on a claim recorded as "no recovery expected" is
   * allowed — new information arrives — but it contradicts what is on record,
   * so it is said out loud rather than silently accepted.
   */
  readonly contradictsClaim = computed(() => this.data.recoveryPotential === 'no');

  onCancel(): void {
    this.modalRef.close(undefined as unknown as CreateRecoveryModalResult);
  }

  onCreate(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.modalRef.close({
      input: {
        route:           v.route!,
        counterparty:    (v.counterparty ?? '').trim(),
        sectionRef:      v.sectionRef ?? undefined,
        estimatedAmount: v.estimatedAmount!,
        expectedDate:    v.expectedDate ?? undefined,
        note:            v.note?.trim() || undefined,
      },
    });
  }
}
