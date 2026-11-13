import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import {
  HEADS_UP_REASONS,
  HEADS_UP_THRESHOLD,
  HeadsUpReason
} from '../../../core/models/large-loss-heads-up.model';

export interface CreateHeadsUpDialogData {
  claimId: string;
  incurred: number;
  currency: string;
}

export interface CreateHeadsUpDialogResult {
  reasons: HeadsUpReason[];
  note: string;
}

// BMPCC-22350 Feature A (non-financial) + D (early): the manual way in. The
// handler says why (one or more reasons, DESIGN DECISION HU-1 Q2); there is
// no amount check (AC5). Same shell as reason-dialog (modal-layout mixin).
@Component({
  selector: 'app-create-heads-up-dialog',
  standalone: true,
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxInputModule,
    NxButtonModule,
    NxIconModule,
    NxCheckboxModule
  ],
  templateUrl: './create-heads-up-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './create-heads-up-dialog.component.scss'
})
export class CreateHeadsUpDialogComponent {
  readonly data = inject<CreateHeadsUpDialogData>(NX_MODAL_DATA);
  private readonly modalRef =
    inject<NxModalRef<CreateHeadsUpDialogComponent, CreateHeadsUpDialogResult | undefined>>(NxModalRef);

  readonly reasons = HEADS_UP_REASONS;
  readonly threshold = HEADS_UP_THRESHOLD;
  readonly belowThreshold = this.data.incurred < HEADS_UP_THRESHOLD;
  readonly picked = signal<Set<HeadsUpReason>>(new Set());
  readonly tried = signal(false);
  readonly showError = computed(() => this.tried() && this.picked().size === 0);
  readonly note = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] });

  isPicked(r: HeadsUpReason): boolean {
    return this.picked().has(r);
  }

  toggle(r: HeadsUpReason, on: boolean): void {
    const next = new Set(this.picked());
    if (on) next.add(r);
    else next.delete(r);
    this.picked.set(next);
  }

  onCancel(): void {
    this.modalRef.close(undefined);
  }

  onCreate(): void {
    this.tried.set(true);
    if (this.picked().size === 0) return;
    // Keep the list order, not the click order.
    const reasons = this.reasons.map(r => r.value).filter(v => this.picked().has(v));
    this.modalRef.close({ reasons, note: this.note.value.trim() });
  }
}
