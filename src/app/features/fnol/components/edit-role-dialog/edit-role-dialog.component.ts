import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { Party, PartyRole, PARTY_ROLE_LABELS } from '../../../../core/models/party.model';

export interface EditRoleDialogData {
  party: Party;
}

@Component({
  selector: 'app-edit-role-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NxModalModule, NxCheckboxModule, NxButtonModule, NxIconModule],
  templateUrl: './edit-role-dialog.component.html',
  styleUrl: './edit-role-dialog.component.scss',
})
export class EditRoleDialogComponent {
  readonly data      = inject<EditRoleDialogData>(NX_MODAL_DATA);
  readonly modalRef  = inject<NxModalRef<EditRoleDialogComponent, PartyRole[] | null>>(NxModalRef);

  readonly roleKeys   = Object.keys(PARTY_ROLE_LABELS) as PartyRole[];
  readonly roleLabels = PARTY_ROLE_LABELS;

  readonly form = new FormGroup(
    this.roleKeys.reduce((acc, role) => {
      acc[role] = new FormControl(this.data.party.roles.includes(role));
      return acc;
    }, {} as Record<string, FormControl<boolean | null>>),
  );

  get selectedRoles(): PartyRole[] {
    return this.roleKeys.filter(role => this.form.get(role)?.value);
  }

  get canSave(): boolean {
    return this.selectedRoles.length > 0;
  }

  onCancel(): void { this.modalRef.close(null); }

  onSave(): void {
    if (!this.canSave) return;
    this.modalRef.close(this.selectedRoles);
  }
}
