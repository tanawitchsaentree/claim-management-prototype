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

interface ChecklistCondition {
  label: string;
  /** Blocker types that block this condition. Cleared if none are present in blockers. */
  blockerTypes: string[];
}

const CLOSURE_CONDITIONS: ChecklistCondition[] = [
  { label: 'All sections closed',                   blockerTypes: ['sections']              },
  { label: 'All payments processed',                 blockerTypes: ['payments']              },
  { label: 'All bills received',                     blockerTypes: ['bills']                 },
  { label: 'Recoveries & deductibles collected',     blockerTypes: ['recovery', 'deductible']},
  { label: 'Reserves released',                      blockerTypes: ['reserves']              },
  { label: 'Litigation completed',                   blockerTypes: ['litigation']            },
  { label: 'Final reports completed',                blockerTypes: ['reports']               },
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
  readonly conditions = CLOSURE_CONDITIONS;

  readonly form: FormGroup = this.fb.group({
    reason:        [null, Validators.required],
    retentionType: ['default', Validators.required],
  });

  readonly stepTitle = computed(() => {
    switch (this.step()) {
      case 1: return 'Close Claim — Pre-closure Checklist';
      case 2: return 'Close Claim — Reason';
      case 3: return 'Close Claim — Confirmation';
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

  isConditionCleared(condition: ChecklistCondition): boolean {
    return !this.blockers.some(b => condition.blockerTypes.includes(b.type));
  }

  blockerLabelFor(condition: ChecklistCondition): string | null {
    const hit = this.blockers.find(b => condition.blockerTypes.includes(b.type));
    return hit ? hit.label : null;
  }
  get showOtherWarning() {
    return this.claim.proximateLossCause?.toLowerCase() === 'other';
  }

  ngOnInit(): void {
    // Always start at step 1 (pre-closure checklist) regardless of canClose.
    // Continue button on step 1 is gated by canClose.
  }

  onCancel(): void {
    this.modalRef.close(undefined);
  }

  onBack(): void {
    const s = this.step();
    if (s === 2) this.step.set(1);
    else if (s === 3) this.step.set(2);
    else if (s === 4) this.step.set(3);
  }

  onContinue(): void {
    const s = this.step();
    if (s === 1 && this.canClose) {
      this.step.set(2);
    } else if (s === 2 && !this.reasonInvalid()) {
      this.step.set(3);
    }
  }

  async onCloseClaim(): Promise<void> {
    if (this.step() !== 3 || this.form.invalid || this.saving()) return;
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

  onViewPayments(): void {
    this.modalRef.close(undefined);
    this.router.navigate(['/claims', this.claim.claimId, 'payments']);
  }

  onViewProvider(): void {
    this.modalRef.close(undefined);
    this.router.navigate(['/claims', this.claim.claimId, 'provider']);
  }

  retentionTypeLabel(type: string): string {
    switch (type) {
      case 'default':    return `Default (10 years — until ${this.defaultRetentionDate()})`;
      case 'indefinite': return 'Indefinite';
      default: return type;
    }
  }
}
