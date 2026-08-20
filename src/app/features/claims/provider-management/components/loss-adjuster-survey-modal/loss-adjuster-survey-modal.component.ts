import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxRatingModule } from '@allianz/ng-aquila/rating';
import { ProviderAssignment } from '../../../../../core/models/provider-assignment.model';
import { LossAdjusterSurvey } from '../../../../../core/models/loss-adjuster-survey.model';

export interface LossAdjusterSurveyModalData {
  claimId: string;
  assignment: ProviderAssignment;
}

@Component({
  selector: 'app-loss-adjuster-survey-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxButtonModule,
    NxFormfieldModule,
    NxInputModule,
    NxRatingModule,
  ],
  templateUrl: './loss-adjuster-survey-modal.component.html',
  styleUrl: './loss-adjuster-survey-modal.component.scss',
})
export class LossAdjusterSurveyModalComponent {
  readonly data = inject<LossAdjusterSurveyModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<LossAdjusterSurveyModalComponent, LossAdjusterSurvey | null>>(NxModalRef);

  readonly form = new FormGroup({
    rating: new FormControl<number>(0, { nonNullable: true, validators: [Validators.min(1)] }),
    comments: new FormControl('', { nonNullable: true }),
  });

  onCancel(): void { this.modalRef.close(null); }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.modalRef.close({
      surveyId: '',
      assignmentId: this.data.assignment.assignmentId,
      claimId: this.data.claimId,
      rating: raw.rating,
      comments: raw.comments,
      status: 'submitted',
    });
  }
}
