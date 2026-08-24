import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { firstValueFrom } from 'rxjs';
import { MockSectionService } from '../../../core/mock/services/mock-section.service';
import { ClaimSection, SectionReopenReason } from '../../../core/models/section.model';

export interface SectionReopenModalData {
  section: ClaimSection;
  reopenedByName: string;
}

export interface SectionReopenModalResult {
  reopenedSection: ClaimSection;
}

@Component({
  selector: 'app-section-reopen-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxDropdownModule,
    NxButtonModule,
    NxIconModule,
    NxSpinnerModule,
    NxMessageModule,
  ],
  templateUrl: './section-reopen-modal.component.html',
  styleUrl: './section-reopen-modal.component.scss',
})
export class SectionReopenModalComponent {
  readonly data     = inject<SectionReopenModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<SectionReopenModalComponent, SectionReopenModalResult>>(NxModalRef);
  private readonly fb         = inject(FormBuilder);
  private readonly sectionSvc = inject(MockSectionService);
  private readonly live       = inject(LiveAnnouncer);

  readonly reopenReasons: SectionReopenReason[] = [
    'New information received',
    'Additional claim activity',
    'Reassessment required',
    'Error correction',
    'Other',
  ];

  readonly form = this.fb.group({
    reason: [null as SectionReopenReason | null, Validators.required],
  });

  saving    = false;
  saveError: string | null = null;

  get section() { return this.data.section; }

  onCancel(): void { this.modalRef.close(undefined as unknown as SectionReopenModalResult); }

  async onReopen(): Promise<void> {
    if (this.form.invalid || this.saving) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    this.saveError = null;
    const reopenedBy = { userId: 'usr-current', name: this.data.reopenedByName };
    try {
      const reopened = await firstValueFrom(
        this.sectionSvc.reopenSection(this.section.id, reopenedBy, this.form.value.reason!)
      );
      this.modalRef.close({ reopenedSection: reopened });
    } catch {
      this.saveError = 'Failed to reopen section. Please try again.';
      this.live.announce(this.saveError, 'assertive');
      this.saving = false;
    }
  }
}
