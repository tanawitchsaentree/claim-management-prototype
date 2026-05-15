import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { EntityRow, PromiseStatus } from '../../../../core/models/entity-damage.model';
import {
  DAMAGE_GROUP_OPTIONS,
  PROMISE_SECTION_OPTIONS,
} from '../../config/entity-damage-mapping';

export interface MoveEntityDialogData {
  entity: EntityRow;
  currentSection: PromiseStatus;
  currentGroupKey: string;
}

export interface MoveEntityResult {
  section: PromiseStatus;
  damageGroupKey: string;
}

@Component({
  selector: 'app-move-entity-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxDropdownModule,
    NxButtonModule,
    NxIconModule,
  ],
  templateUrl: './move-entity-dialog.component.html',
  styleUrl: './move-entity-dialog.component.scss',
})
export class MoveEntityDialogComponent implements OnInit {
  readonly data     = inject<MoveEntityDialogData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<MoveEntityDialogComponent, MoveEntityResult | null>>(NxModalRef);

  readonly sectionOptions    = PROMISE_SECTION_OPTIONS;
  readonly groupOptions      = DAMAGE_GROUP_OPTIONS;

  readonly form = new FormGroup({
    section:       new FormControl<PromiseStatus>('possibly-promised', { nonNullable: true, validators: Validators.required }),
    damageGroupKey: new FormControl<string>('material-damage',         { nonNullable: true, validators: Validators.required }),
  });

  ngOnInit(): void {
    this.form.setValue({
      section:        this.data.currentSection,
      damageGroupKey: this.data.currentGroupKey ?? 'material-damage',
    });
  }

  get hasChanged(): boolean {
    return this.form.value.section       !== this.data.currentSection
        || this.form.value.damageGroupKey !== this.data.currentGroupKey;
  }

  onCancel(): void { this.modalRef.close(null); }

  onConfirm(): void {
    if (this.form.invalid || !this.hasChanged) return;
    this.modalRef.close({
      section:        this.form.getRawValue().section,
      damageGroupKey: this.form.getRawValue().damageGroupKey,
    });
  }
}
