import { Component, inject, signal, computed } from '@angular/core';
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
import { firstValueFrom } from 'rxjs';
import { ClaimClosureService } from '../../../../../core/services/claim-closure.service';
import { ClaimOverview, ClaimActivity } from '../../../../../core/models/claim-overview.model';
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

interface ChecklistItem {
  label: string;
  passed: boolean;
  failHint: string;
}

// Handler-attested only — no system/API validation exists for these against another BC.
const CONFIRMATION_STATEMENTS: string[] = [
  'All bills against this section/claim have been received and processed',
  'All pending subrogation, salvage, or recovery activity has been resolved (or recovery potential confirmed as none)',
  'All final reports are completed',
  'Provider Management survey is completed, or rejected with a rationale provided',
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
  ],
  templateUrl: './claim-closure-modal.component.html',
  styleUrl: './claim-closure-modal.component.scss',
})
export class ClaimClosureModalComponent {
  readonly data     = inject<ClaimClosureModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<ClaimClosureModalComponent, ClaimClosureModalResult>>(NxModalRef);
  private readonly fb         = inject(FormBuilder);
  private readonly closureSvc = inject(ClaimClosureService);
  private readonly router     = inject(Router);

  readonly step    = signal<Step>(this.data.blockers.canClose ? 2 : 1);
  readonly saving  = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly expanded = signal<Set<string>>(new Set());

  readonly closureReasons = CLOSURE_REASONS;

  readonly checklistItems: ChecklistItem[] = [
    { label: 'All sections closed',              passed: !this.data.blockers.blockers.some(b => b.type === 'sections'),              failHint: 'All sections must be closed before closing the claim.' },
    { label: 'All payments processed',           passed: !this.data.blockers.blockers.some(b => b.type === 'payments'),              failHint: 'Pending payments must be settled.' },
    { label: 'All bills received',               passed: !this.data.blockers.blockers.some(b => b.type === 'bills'),                 failHint: 'Outstanding bills must be received.' },
    { label: 'Recoveries & deductibles cleared', passed: !this.data.blockers.blockers.some(b => ['recovery','deductible'].includes(b.type)), failHint: 'Open recovery or deductible tasks must be resolved.' },
    { label: 'Reserves released',                passed: !this.data.blockers.blockers.some(b => b.type === 'reserves'),              failHint: 'All reserves must be released.' },
    { label: 'Litigation completed',             passed: !this.data.blockers.blockers.some(b => b.type === 'litigation'),            failHint: 'Active litigation must be resolved.' },
    { label: 'Final reports completed',          passed: !this.data.blockers.blockers.some(b => b.type === 'reports'),               failHint: 'All required reports must be completed.' },
  ];

  readonly checklistAllDone = computed(() => this.checklistItems.every(i => i.passed));

  readonly confirmationStatements = CONFIRMATION_STATEMENTS;

  readonly form: FormGroup = this.fb.group({
    reason:        [null, Validators.required],
    retentionType: ['default', Validators.required],
  });

  readonly stepTitle = computed(() => {
    switch (this.step()) {
      case 1: return 'Close Claim — Blockers';
      case 2: return 'Close Claim — Pre-closure Checklist';
      case 3: return 'Close Claim — Reason & Retention';
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
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${d.getFullYear()}`;
  });

  get blockers() { return this.data.blockers.blockers; }
  get claim()    { return this.data.claim; }

  get showOtherWarning() {
    return this.claim.proximateLossCause?.toLowerCase() === 'other';
  }

  get showRecoveryWarning() {
    return this.claim.recoveryPotential === 'yes' && !this.claim.hasActiveRecovery;
  }

  toggleBlocker(key: string): void {
    this.expanded.update(set => {
      const next = new Set(set);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  isExpanded(key: string): boolean {
    return this.expanded().has(key);
  }

  onCancel(): void { this.modalRef.close(undefined); }

  onBack(): void {
    if (this.step() === 3) this.step.set(2);
    if (this.step() === 4) this.step.set(3);
  }

  onContinue(): void {
    if (this.step() === 2 && this.checklistAllDone()) this.step.set(3);
  }

  onContinueToConfirmation(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.step.set(4);
  }

  /** Handler clicks "No" — closure is blocked; return to the checklist, not just the reason step. */
  onDeclineConfirmation(): void {
    this.step.set(2);
  }

  async onCloseClaim(): Promise<void> {
    if (this.form.invalid || this.saving()) return;
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
    } catch {
      this.saveError.set('Failed to close claim. Please try again.');
      this.saving.set(false);
    }
  }

  retentionTypeLabel(type: string): string {
    if (type === 'default') return `Default (10 years — until ${this.defaultRetentionDate()})`;
    return 'Indefinite';
  }
}
