import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { firstValueFrom } from 'rxjs';
import { ClaimClosureService } from '../../../../../core/services/claim-closure.service';
import { ClaimOverview } from '../../../../../core/models/claim-overview.model';
import { ClaimActivity } from '../../../../../core/models/claim-overview.model';
import { BlockerCheckResult, ClosureReason } from '../../../../../core/models/claim-closure.model';

export interface ClaimClosureModalData {
  claim: ClaimOverview;
  blockers: BlockerCheckResult;
}

export interface ClaimClosureModalResult {
  closedClaim: ClaimOverview;
  activity: ClaimActivity;
}

type Step = 1 | 2 | 3;

const CLOSURE_REASONS: ClosureReason[] = [
  'Claim Finalised',
  'Claim Not Pursued',
  'Claim Rejected',
];

@Component({
  selector: 'app-claim-closure-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxDropdownModule,
    NxRadioModule,
    NxDatefieldModule,
    NxInputModule,
    NxButtonModule,
    NxIconModule,
    NxSpinnerModule,
    NxMessageModule,
  ],
  templateUrl: './claim-closure-modal.component.html',
  styleUrl: './claim-closure-modal.component.scss',
})
export class ClaimClosureModalComponent implements OnInit {
  readonly data     = inject<ClaimClosureModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<ClaimClosureModalComponent, ClaimClosureModalResult>>(NxModalRef);
  private readonly fb         = inject(FormBuilder);
  private readonly closureSvc = inject(ClaimClosureService);
  private readonly router     = inject(Router);

  readonly step = signal<Step>(1);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  readonly closureReasons = CLOSURE_REASONS;

  readonly form: FormGroup = this.fb.group({
    reason:        [null, Validators.required],
    retentionType: ['default', Validators.required],
    retentionDate: [null],
  });

  readonly stepTitle = computed(() => {
    switch (this.step()) {
      case 1: return 'Close Claim — Validation';
      case 2: return 'Close Claim — Reason';
      case 3: return 'Close Claim — Confirmation';
    }
  });

  private readonly reasonStatus = toSignal(
    this.form.get('reason')!.statusChanges,
    { initialValue: this.form.get('reason')!.status }
  );

  readonly reasonInvalid = computed(() => this.reasonStatus() !== 'VALID');

  readonly defaultRetentionDate = computed(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 10);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  });

  // Custom retention can only EXTEND beyond the default 10-year period
  // (BMPCC-11360 AC7 — "extend beyond the default where required").
  readonly minRetentionDate = computed(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 10);
    return d.toISOString().split('T')[0];
  });

  get blockers() { return this.data.blockers.blockers; }
  get canClose()  { return this.data.blockers.canClose; }
  get claim()     { return this.data.claim; }
  get showOtherWarning() {
    return this.claim.proximateLossCause?.toLowerCase() === 'other';
  }

  ngOnInit(): void {
    if (this.canClose) {
      this.step.set(2);
    }
  }

  get retentionType(): string {
    return this.form.get('retentionType')?.value ?? 'default';
  }

  onRetentionTypeChange(val: string): void {
    const ctrl = this.form.get('retentionDate')!;
    if (val === 'custom') {
      ctrl.setValidators(Validators.required);
    } else {
      ctrl.clearValidators();
      ctrl.setValue(null);
    }
    ctrl.updateValueAndValidity();
  }

  onCancel(): void {
    this.modalRef.close(undefined);
  }

  onBack(): void {
    if (this.step() === 3) this.step.set(2);
  }

  onContinue(): void {
    if (this.step() === 2 && !this.reasonInvalid()) {
      this.step.set(3);
    }
  }

  async onCloseClaim(): Promise<void> {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);

    const { reason, retentionType, retentionDate } = this.form.value;
    try {
      const closedClaim = await firstValueFrom(
        this.closureSvc.closeClaim(this.claim.claimId, {
          reason,
          retentionType,
          retentionDate: retentionType === 'custom' ? retentionDate : undefined,
          confirmedBy: { userId: 'usr-current', name: this.claim.assignedHandler },
        })
      );

      const now = new Date().toISOString();
      const activity: ClaimActivity = {
        id: `act-${Date.now()}`,
        claimId: this.claim.claimId,
        user: this.claim.assignedHandler,
        timestamp: now,
        objectType: 'Claim',
        attribute: 'Status',
        valueOld: this.claim.status,
        valueNew: 'Closed',
      };

      this.modalRef.close({ closedClaim, activity });
    } catch (err) {
      this.saveError.set('Failed to close claim. Please try again.');
      this.saving.set(false);
    }
  }

  onViewTasks(): void {
    this.modalRef.close(undefined);
    setTimeout(() => {
      document.querySelector('.pt-header')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }

  onViewSections(): void {
    this.modalRef.close(undefined);
    this.router.navigate(['/claims', this.claim.claimId, 'sections']);
  }

  retentionTypeLabel(type: string): string {
    switch (type) {
      case 'default':    return `Default (10 years — until ${this.defaultRetentionDate()})`;
      case 'custom':     return 'Custom date';
      case 'indefinite': return 'Indefinite';
      default: return type;
    }
  }
}
