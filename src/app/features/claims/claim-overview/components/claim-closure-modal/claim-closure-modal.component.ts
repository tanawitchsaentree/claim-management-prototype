import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
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

type Step = 1 | 2 | 3 | 4;

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
    NxButtonModule,
    NxIconModule,
    NxSpinnerModule,
    NxMessageModule,
    NxCheckboxModule,
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

  readonly checklistItems: string[] = [
    'All payments processed',
    'All bills received',
    'All recoveries & deductibles collected',
    'Reserves released to zero',
    'Final reports completed',
  ];
  readonly checklistChecked = signal<boolean[]>(this.checklistItems.map(() => false));
  readonly checklistAllDone = computed(() => this.checklistChecked().every(v => v));

  toggleChecklistItem(index: number): void {
    this.checklistChecked.update(arr => arr.map((v, i) => i === index ? !v : v));
  }

  readonly form: FormGroup = this.fb.group({
    reason:        [null, Validators.required],
    retentionType: ['default', Validators.required],
  });

  readonly stepTitle = computed(() => {
    switch (this.step()) {
      case 1: return 'Close Claim — Validation';
      case 2: return 'Close Claim — Pre-closure Checklist';
      case 3: return 'Close Claim — Reason';
      case 4: return 'Close Claim — Confirmation';
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
    // App-wide standard: DD-MM-YYYY (dash, 4-digit year).
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${d.getFullYear()}`;
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

  onCancel(): void {
    this.modalRef.close(undefined);
  }

  onBack(): void {
    const s = this.step();
    if (s === 3) this.step.set(2);
    else if (s === 4) this.step.set(3);
  }

  onContinue(): void {
    const s = this.step();
    if (s === 2 && this.checklistAllDone()) {
      this.step.set(3);
    } else if (s === 3 && !this.reasonInvalid()) {
      this.step.set(4);
    }
  }

  async onCloseClaim(): Promise<void> {
    if (this.step() !== 4 || this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);

    const { reason, retentionType } = this.form.value;
    try {
      const closedClaim = await firstValueFrom(
        this.closureSvc.closeClaim(this.claim.claimId, {
          reason,
          retentionType,
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

  onViewLitigation(): void {
    this.modalRef.close(undefined);
    this.router.navigate(['/claims', this.claim.claimId, 'litigation']);
  }

  retentionTypeLabel(type: string): string {
    switch (type) {
      case 'default':    return `Default (10 years — until ${this.defaultRetentionDate()})`;
      case 'indefinite': return 'Indefinite';
      default: return type;
    }
  }
}
