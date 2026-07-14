import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalRef, NX_MODAL_DATA, NxModalModule } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';

export interface DamagedItem {
  name: string;
  description: string;
  damage: string;
}

export interface EditDamagedItemModalData {
  item: DamagedItem;
}

export type EditDamagedItemModalResult = DamagedItem;

const DAMAGE_OPTIONS: string[] = [
  'Material damage',
  'Business interruption',
  'Machinery breakdown',
  'Financial loss',
  'Bodily injury',
  'Liability',
];

@Component({
  selector: 'app-edit-damaged-item-modal',
  standalone: true,
  imports: [ReactiveFormsModule, NxModalModule, NxFormfieldModule, NxDropdownModule, NxInputModule, NxButtonModule],
  templateUrl: './edit-damaged-item-modal.component.html',
  styleUrl: './edit-damaged-item-modal.component.scss',
})
export class EditDamagedItemModalComponent {
  readonly data     = inject<EditDamagedItemModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<EditDamagedItemModalComponent, EditDamagedItemModalResult>>(NxModalRef);
  private readonly fb = inject(FormBuilder);

  readonly damageOptions = DAMAGE_OPTIONS;

  readonly form = this.fb.group({
    name:        [this.data.item.name,        Validators.required],
    description: [this.data.item.description, Validators.required],
    damage:      [this.data.item.damage,      Validators.required],
  });

  confirm(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.modalRef.close({
      name:        this.form.value.name!,
      description: this.form.value.description!,
      damage:      this.form.value.damage!,
    });
  }

  cancel(): void { this.modalRef.close(); }
}
