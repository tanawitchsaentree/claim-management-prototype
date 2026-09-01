import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { NX_MODAL_DATA, NxModalModule, NxModalRef } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { RecoveryCase, RecoveryResolution } from '../../../../../core/models/recovery.model';

export interface ResolveRecoveryModalData {
  recovery: RecoveryCase;
}

export interface ResolveRecoveryModalResult {
  resolution: RecoveryResolution;
}

type Outcome = 'Recovered' | 'Written off';

@Component({
  selector: 'app-resolve-recovery-modal',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, NxModalModule,
    NxFormfieldModule, NxInputModule, NxRadioModule, NxButtonModule, NxIconModule,
  ],
  templateUrl: './resolve-recovery-modal.component.html',
  styleUrl: './resolve-recovery-modal.component.scss',
})
export class ResolveRecoveryModalComponent {
  readonly data     = inject<ResolveRecoveryModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<ResolveRecoveryModalComponent, ResolveRecoveryModalResult>>(NxModalRef);
  private readonly fb = inject(FormBuilder);

  /**
   * `recoveredAmount` carries `required` so the field renders as required and
   * shows its own error, but required-ness is enforced by hand in onConfirm()
   * for the Recovered branch only — an always-on validator would keep the form
   * invalid on the Written off branch, where the field is not even shown.
   */
  readonly form = this.fb.group({
    outcome:         [null as Outcome | null, Validators.required],
    recoveredAmount: [null as number | null, [Validators.required, Validators.min(1)]],
    outcomeNote:     ['', [Validators.required, Validators.maxLength(300)]],
  });

  private readonly outcomeSig = toSignal(this.form.controls.outcome.valueChanges, { initialValue: null });

  readonly isRecovered = computed(() => this.outcomeSig() === 'Recovered');

  readonly noteLabel = computed(() =>
    this.isRecovered() ? 'How was it settled?' : 'Why is it being written off?');

  readonly canConfirm = computed(() => {
    const outcome = this.outcomeSig();
    if (!outcome) return false;
    if (this.form.controls.outcomeNote.invalid) return false;
    return outcome === 'Written off' || this.form.controls.recoveredAmount.valid;
  });

  get recovery(): RecoveryCase { return this.data.recovery; }

  onCancel(): void {
    this.modalRef.close(undefined as unknown as ResolveRecoveryModalResult);
  }

  onConfirm(): void {
    if (!this.canConfirm()) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.modalRef.close({
      resolution: {
        status:          v.outcome!,
        // Dropped, not just hidden, on the Written off branch — a stale amount
        // typed before switching outcome must not survive into the record.
        recoveredAmount: v.outcome === 'Recovered' ? v.recoveredAmount! : 0,
        outcomeNote:     (v.outcomeNote ?? '').trim(),
      },
    });
  }
}
