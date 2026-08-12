import { Component, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';

export interface RecoveryPotentialModalData {
  current: 'yes' | 'no' | null;
}

export interface RecoveryPotentialModalResult {
  value: 'yes' | 'no';
  note: string;
}

@Component({
  selector: 'app-recovery-potential-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxButtonModule,
    NxIconModule,
    NxRadioModule,
    NxFormfieldModule,
    NxInputModule,
  ],
  templateUrl: './recovery-potential-modal.component.html',
  styleUrl: './recovery-potential-modal.component.scss',
})
export class RecoveryPotentialModalComponent {
  readonly data     = inject<RecoveryPotentialModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<RecoveryPotentialModalComponent, RecoveryPotentialModalResult | null>>(NxModalRef);

  readonly form = new FormGroup({
    value: new FormControl<'yes' | 'no' | null>(this.data.current, { validators: [Validators.required] }),
    note:  new FormControl<string>('', { nonNullable: true }),
  });

  private readonly selectedValue = toSignal(this.form.get('value')!.valueChanges, {
    initialValue: this.form.get('value')!.value,
  });

  get isNo(): boolean { return this.selectedValue() === 'no'; }

  constructor() {
    const noteCtrl = this.form.get('note')!;
    effect(() => {
      const isNo = this.selectedValue() === 'no';
      noteCtrl.setValidators(isNo ? [Validators.required] : []);
      noteCtrl.updateValueAndValidity();
    });
  }

  onCancel(): void { this.modalRef.close(null); }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.modalRef.close({ value: raw.value as 'yes' | 'no', note: raw.note });
  }
}
