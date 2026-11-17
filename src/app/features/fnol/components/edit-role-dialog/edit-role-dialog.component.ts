import { Component, inject, ChangeDetectionStrategy } from '@angular/core';

import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import {
  Party,
  ClaimPartyRole,
  CLAIM_PARTY_ROLE_LABELS,
  PARTY_ROLE_LABELS,
  isDefaultParty
} from '../../../../core/models/party.model';

export interface EditRoleDialogData {
  party: Party;
}

// role is only set for a non-default party: a default party's role can't change.
export interface EditRoleDialogResult {
  role?: ClaimPartyRole;
  referenceNumber: string;
}

/**
 * BMPCC-12160: one claim role per party (radio, not checkboxes), roles from the
 * Jira list, default parties keep their policy role, and a free alphanumeric
 * Reference number that can be changed at any time.
 */
@Component({
  selector: 'app-edit-role-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxModalModule,
    NxRadioModule,
    NxFormfieldModule,
    NxInputModule,
    NxButtonModule,
    NxIconModule
  ],
  templateUrl: './edit-role-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './edit-role-dialog.component.scss'
})
export class EditRoleDialogComponent {
  readonly data = inject<EditRoleDialogData>(NX_MODAL_DATA);
  readonly modalRef =
    inject<NxModalRef<EditRoleDialogComponent, EditRoleDialogResult | null>>(NxModalRef);

  readonly isDefault = isDefaultParty(this.data.party);
  readonly roleKeys = Object.keys(CLAIM_PARTY_ROLE_LABELS) as ClaimPartyRole[];
  readonly roleLabels = CLAIM_PARTY_ROLE_LABELS;
  readonly defaultRoles = this.data.party.roles.map(r => PARTY_ROLE_LABELS[r]).join(', ');

  readonly form = new FormGroup({
    role: new FormControl<ClaimPartyRole | null>(
      this.isDefault ? null : ((this.data.party.roles[0] as ClaimPartyRole | undefined) ?? null),
      this.isDefault ? [] : [Validators.required]
    ),
    referenceNumber: new FormControl(this.data.party.referenceNumber ?? '', {
      nonNullable: true,
      validators: [Validators.pattern(/^[A-Za-z0-9]*$/), Validators.maxLength(35)]
    })
  });

  get title(): string {
    return this.isDefault ? 'Edit reference number' : 'Edit role';
  }

  onCancel(): void {
    this.modalRef.close(null);
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.modalRef.close({
      role: this.isDefault ? undefined : (v.role ?? undefined),
      referenceNumber: v.referenceNumber.trim()
    });
  }
}
