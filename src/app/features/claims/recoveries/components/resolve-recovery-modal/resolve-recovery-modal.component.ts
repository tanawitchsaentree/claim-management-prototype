import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import {
  NX_MODAL_DATA,
  NxDialogService,
  NxModalModule,
  NxModalRef
} from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { RecoveryCase, RecoveryResolution } from '../../../../../core/models/recovery.model';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';

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
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxInputModule,
    NxRadioModule,
    NxButtonModule,
    NxIconModule
  ],
  templateUrl: './resolve-recovery-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './resolve-recovery-modal.component.scss'
})
export class ResolveRecoveryModalComponent {
  readonly data = inject<ResolveRecoveryModalData>(NX_MODAL_DATA);
  readonly modalRef =
    inject<NxModalRef<ResolveRecoveryModalComponent, ResolveRecoveryModalResult>>(NxModalRef);
  private readonly fb = inject(FormBuilder);
  private readonly dialogSvc = inject(NxDialogService);

  /**
   * `recoveredAmount` carries `required` so the field renders as required and
   * shows its own error, but required-ness is enforced by hand in onConfirm()
   * for the Recovered branch only — an always-on validator would keep the form
   * invalid on the Written off branch, where the field is not even shown.
   */
  readonly form = this.fb.group({
    outcome: [null as Outcome | null, Validators.required],
    recoveredAmount: [null as number | null, [Validators.required, Validators.min(1)]],
    outcomeNote: ['', [Validators.required, Validators.maxLength(300)]]
  });

  // The whole form as a signal (same as section-dol-modal.component.ts:60), so
  // typing the note or the amount re-runs canConfirm(). Reading control
  // validity alone is not a signal: the button stayed disabled (audit R-02).
  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.value
  });

  readonly isRecovered = computed(() => this.value().outcome === 'Recovered');

  readonly noteLabel = computed(() =>
    this.isRecovered() ? 'How was it settled?' : 'Why is it being written off?'
  );

  readonly canConfirm = computed(() => {
    const outcome = this.value().outcome;
    if (!outcome) return false;
    if (this.form.controls.outcomeNote.invalid) return false;
    return outcome === 'Written off' || this.form.controls.recoveredAmount.valid;
  });

  get recovery(): RecoveryCase {
    return this.data.recovery;
  }

  onCancel(): void {
    this.modalRef.close(undefined as unknown as ResolveRecoveryModalResult);
  }

  async onConfirm(): Promise<void> {
    if (!this.canConfirm()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const resolution: RecoveryResolution = {
      status: v.outcome!,
      // Dropped, not just hidden, on the Written off branch — a stale amount
      // typed before switching outcome must not survive into the record.
      recoveredAmount: v.outcome === 'Recovered' ? v.recoveredAmount! : 0,
      outcomeNote: (v.outcomeNote ?? '').trim()
    };
    if (!(await this.confirm(resolution))) return;
    this.modalRef.close({ resolution });
  }

  // Resolving is final (a closed recovery allows no edits, Confluence 2899716834),
  // so confirm first. Shared confirm opened from inside the form modal, as Reassign
  // does (reassign-claim-modal.component.ts:206-218); Back keeps what was typed.
  private async confirm(r: RecoveryResolution): Promise<boolean> {
    const id = this.recovery.id;
    const amount = `${this.recovery.currency} ${r.recoveredAmount.toLocaleString('en-US')}`;
    const data: ConfirmDialogData =
      r.status === 'Written off'
        ? {
            title: `Write off ${id}?`,
            message: `No money will be recovered from ${this.recovery.counterparty}. After this the case can't be changed.`,
            confirmLabel: 'Yes, write off',
            cancelLabel: 'Back'
          }
        : {
            title: `Resolve ${id} as recovered?`,
            message: `${amount} came back from ${this.recovery.counterparty}. After this the case can't be changed.`,
            confirmLabel: 'Yes, resolve',
            cancelLabel: 'Back'
          };
    const ref = this.dialogSvc.open(ConfirmDialogComponent, {
      data,
      width: '480px',
      maxWidth: '92vw'
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}
