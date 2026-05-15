import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { NxModalModule, NxModalRef } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';

@Component({
  selector: 'app-verifier-name-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NxModalModule, NxFormfieldModule, NxInputModule, NxButtonModule, NxIconModule],
  templateUrl: './verifier-name-modal.component.html',
  styleUrl:    './verifier-name-modal.component.scss',
})
export class VerifierNameModalComponent {
  readonly modalRef = inject<NxModalRef<VerifierNameModalComponent, string | null>>(NxModalRef);

  readonly nameCtrl = new FormControl('');

  onConfirm(): void {
    const trimmed = (this.nameCtrl.value ?? '').trim();
    if (!trimmed) return;
    this.modalRef.close(trimmed);
  }

  onCancel(): void {
    this.modalRef.close(null);
  }
}
