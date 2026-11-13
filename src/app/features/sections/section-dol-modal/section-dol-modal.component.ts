import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { ClaimSection } from '../../../core/models/section.model';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';

export interface SectionDolModalData {
  section: ClaimSection;
  claimDateOfLoss?: string;
}

/** The section's own date, or undefined to follow the claim's date of loss again. */
export interface SectionDolModalResult {
  dateOfLoss: string | undefined;
}

// DESIGN DECISION BMPCC-22328-3: a section follows the claim's date of loss
// until a handler gives it its own. Two choices only: "Same as the claim"
// (keeps following it, also after Edit claim changes it) or "A different
// date". No future dates (same limit as every other date of loss field).
// The caller asks for confirmation (Field / Original / Updated) before saving.
@Component({
  selector: 'app-section-dol-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxModalModule,
    NxButtonModule,
    NxIconModule,
    NxFormfieldModule,
    NxInputModule,
    NxDatefieldModule,
    NxRadioModule,
    AppDatePipe
  ],
  templateUrl: './section-dol-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './section-dol-modal.component.scss'
})
export class SectionDolModalComponent {
  readonly data = inject<SectionDolModalData>(NX_MODAL_DATA);
  private readonly modalRef =
    inject<NxModalRef<SectionDolModalComponent, SectionDolModalResult>>(NxModalRef);
  private readonly fb = inject(FormBuilder);

  readonly today = new Date().toISOString().split('T')[0];

  readonly form = this.fb.group({
    mode: [this.data.section.dateOfLoss ? 'own' : 'claim'],
    date: [this.data.section.dateOfLoss ?? this.data.claimDateOfLoss ?? (null as string | null)]
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.value });
  readonly isOwn = computed(() => this.value().mode === 'own');

  readonly invalid = computed(() => {
    const v = this.value();
    if (v.mode !== 'own') return false;
    return !v.date || String(v.date) > this.today;
  });

  constructor() {
    this.form.controls.date.addValidators(Validators.required);
  }

  onCancel(): void {
    this.modalRef.close(undefined);
  }

  onSave(): void {
    if (this.invalid()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const own = v.mode === 'own' ? String(v.date).split('T')[0] : undefined;
    // Picking the claim's own date again is the same as following the claim.
    const dateOfLoss = own && own !== this.data.claimDateOfLoss ? own : undefined;
    this.modalRef.close({ dateOfLoss });
  }
}
