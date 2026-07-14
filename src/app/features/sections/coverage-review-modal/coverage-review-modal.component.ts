import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { NxModalModule, NX_MODAL_DATA, NxModalRef } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { CoverageReview, SectionEntity } from '../../../core/models/section.model';

export interface CoverageReviewModalData {
  entity: SectionEntity;
}

export interface CoverageReviewModalResult {
  coverageReview: CoverageReview;
  coverageReviewNote: string;
  coverageReviewOverridden: boolean;
}

export const COVERAGE_REVIEW_OPTIONS: CoverageReview[] = [
  'Standard Review',
  'Additional information required',
  'Enhanced review required',
];

@Component({
  selector: 'app-coverage-review-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxButtonModule,
    NxFormfieldModule,
    NxDropdownModule,
    NxInputModule,
  ],
  templateUrl: './coverage-review-modal.component.html',
  styleUrl: './coverage-review-modal.component.scss',
})
export class CoverageReviewModalComponent {
  readonly data    = inject<CoverageReviewModalData>(NX_MODAL_DATA);
  readonly modalRef = inject(NxModalRef);

  readonly options = COVERAGE_REVIEW_OPTIONS;

  readonly form = new FormGroup({
    coverageReview: new FormControl<CoverageReview>(
      this.data.entity.coverageReview ?? 'Standard Review',
      { nonNullable: true, validators: [Validators.required] }
    ),
    note: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(1)] }),
  });

  readonly isOverride = this.data.entity.coverageReview != null;

  confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const result: CoverageReviewModalResult = {
      coverageReview:          this.form.controls.coverageReview.value,
      coverageReviewNote:      this.form.controls.note.value,
      coverageReviewOverridden: true,
    };
    this.modalRef.close(result);
  }

  cancel(): void {
    this.modalRef.close(undefined);
  }
}
