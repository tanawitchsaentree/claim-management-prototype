import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { FnolStateService } from '../../services/fnol-state.service';
import { SkeletonReason } from '../../models/fnol-form.model';
import { MockSkeletonClaimService } from '../../../../core/mock/services/mock-skeleton-claim.service';

interface ReasonOption {
  value: SkeletonReason;
  label: string;
}

const REASON_OPTIONS: ReasonOption[] = [
  { value: 'policy_not_issued',    label: 'Policy not yet issued' },
  { value: 'policy_not_found',     label: 'Policy not found in system' },
  { value: 'multi_policy_pending', label: 'Multi-policy case (pending investigation)' },
  { value: 'other',                label: 'Other' },
];

@Component({
  selector: 'app-step-skeleton-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxButtonModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule,
    NxIconModule,
    NxMessageModule,
    NxSpinnerModule,
  ],
  templateUrl: './step-skeleton-create.component.html',
  styleUrl: './step-skeleton-create.component.scss',
})
export class StepSkeletonCreateComponent implements OnInit {
  private fnolState       = inject(FnolStateService);
  private skeletonSvc     = inject(MockSkeletonClaimService);
  private router          = inject(Router);

  readonly reasonOptions = REASON_OPTIONS;
  readonly maxNotes = 500;

  submitted  = false;
  saving     = false;
  createdId: string | null = null;

  readonly form = new FormGroup({
    clientName: new FormControl('', [Validators.required, Validators.minLength(2)]),
    reason:     new FormControl<SkeletonReason | null>(null, [Validators.required]),
    notes:      new FormControl('', [Validators.maxLength(500)]),
  });

  get clientNameControl() { return this.form.controls.clientName; }
  get reasonControl()     { return this.form.controls.reason; }
  get notesControl()      { return this.form.controls.notes; }

  get notesLength(): number {
    return this.notesControl.value?.length ?? 0;
  }

  get clientNameError(): string | null {
    if (!this.submitted && !this.clientNameControl.touched) return null;
    if (this.clientNameControl.hasError('required')) return 'Client name is required.';
    if (this.clientNameControl.hasError('minlength')) return 'Minimum 2 characters.';
    return null;
  }

  get reasonError(): string | null {
    if (!this.submitted && !this.reasonControl.touched) return null;
    if (this.reasonControl.hasError('required')) return 'Please select a reason.';
    return null;
  }

  get notesError(): string | null {
    if (this.notesControl.hasError('maxlength')) return `Maximum ${this.maxNotes} characters.`;
    return null;
  }

  ngOnInit(): void {
    const client = this.fnolState.selectedClient;
    if (client?.clientName) {
      this.clientNameControl.setValue(client.clientName);
      this.clientNameControl.disable();
    }
  }

  onBack(): void {
    this.router.navigate(['/fnol/search']);
  }

  async onCreate(): Promise<void> {
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    this.saving = true;

    try {
      const skeleton = await firstValueFrom(
        this.skeletonSvc.create({
          clientName: raw.clientName ?? '',
          reason: raw.reason as SkeletonReason,
          notes: raw.notes ?? undefined,
          lossDate: null,
          createdBy: 'Current User',
        })
      );
      this.fnolState.setSkeleton(
        { clientName: skeleton.clientName, reason: raw.reason as SkeletonReason },
        skeleton.claimId,
      );
      this.fnolState.markStepComplete('skeleton-create');
      this.createdId = skeleton.claimId;
    } finally {
      this.saving = false;
    }
  }

  onGoToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
