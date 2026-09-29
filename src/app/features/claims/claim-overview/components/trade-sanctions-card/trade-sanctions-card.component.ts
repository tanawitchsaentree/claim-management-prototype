import { Component, EventEmitter, Input, OnChanges, Output, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { firstValueFrom } from 'rxjs';
import {
  ConfirmDialogComponent,
  ConfirmDialogChange,
  ConfirmDialogData
} from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../../../../shared/components/toast/toast.service';
import {
  ClaimOverview,
  ClaimActivity,
  TradeSanctionsCheck
} from '../../../../../core/models/claim-overview.model';
import { NamedThirdParty } from '../../../../../core/models/section.model';

export interface TradeSanctionsUpdated {
  claim: ClaimOverview;
  activity: ClaimActivity;
}

/**
 * Trade Sanctions Check — BMPCC-18822/BMPCC-17242. Capture-and-audit only:
 * a claim handler records that a screening was determined/performed and its
 * outcome. This never calls ESRA and never blocks claim progression.
 *
 * Plain accordion (2026-09-28, same pattern as recovery-potential-card):
 * collapsed by default, title + chevron in the header, everything else
 * behind the toggle.
 *
 * Save opens a confirm dialog with a before/after diff, same as every other
 * save-affecting-record action on this page — never save-and-done, never a
 * bare "are you sure?".
 */
@Component({
  selector: 'app-trade-sanctions-card',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxRadioModule,
    NxButtonModule,
    NxFormfieldModule,
    NxInputModule,
    NxDatefieldModule,
    NxIconModule,
    NxModalModule
  ],
  templateUrl: './trade-sanctions-card.component.html',
  styleUrl: './trade-sanctions-card.component.scss'
})
export class TradeSanctionsCardComponent implements OnChanges {
  @Input({ required: true }) claim!: ClaimOverview;
  // Context only — never auto-answers the question. Lets the handler see who
  // is already on file (via a CBI entity's third party) instead of screening
  // blind; the actual sanctions determination is still theirs to make.
  @Input() namedThirdParties: NamedThirdParty[] = [];
  @Output() updated = new EventEmitter<TradeSanctionsUpdated>();

  private readonly toast = inject(ToastService);
  private readonly dialogSvc = inject(NxDialogService);

  readonly exposure = new FormControl<'yes' | 'no' | null>(null);
  readonly referralApplicable = new FormControl<'yes' | 'no' | null>(null);
  readonly esraCompletionDate = new FormControl<string | null>(null);
  readonly referralApproved = new FormControl<'yes' | 'no' | null>(null);
  readonly esraId = new FormControl<string>('');
  readonly comments = new FormControl<string>('');

  private readonly claimSig = signal<ClaimOverview | null>(null);
  private readonly exposureSig = toSignal(this.exposure.valueChanges, {
    initialValue: this.exposure.value
  });
  private readonly referralApplicableSig = toSignal(this.referralApplicable.valueChanges, {
    initialValue: this.referralApplicable.value
  });
  private readonly esraCompletionDateSig = toSignal(this.esraCompletionDate.valueChanges, {
    initialValue: this.esraCompletionDate.value
  });
  private readonly referralApprovedSig = toSignal(this.referralApproved.valueChanges, {
    initialValue: this.referralApproved.value
  });
  private readonly esraIdSig = toSignal(this.esraId.valueChanges, {
    initialValue: this.esraId.value
  });
  private readonly commentsSig = toSignal(this.comments.valueChanges, {
    initialValue: this.comments.value
  });

  // Plain accordion, collapsed by default — matches recovery-potential-card's
  // 2026-09-28 redesign. Only user actions touch this, never ngOnChanges (the
  // parent hands every card a new `claim` object on ANY sibling card's save).
  readonly collapsed = signal(true);

  readonly isClosed = computed(() => this.claimSig()?.status === 'Closed');
  readonly saved = computed<TradeSanctionsCheck | null>(() => this.claimSig()?.tradeSanctions ?? null);

  readonly showExpanded = computed(() => this.exposureSig() === 'yes');

  // Open Point #5 (functional design) — "Sanction referral approved in
  // ESRA?" stayed editable even when applicable = No in the reviewed Figma
  // draft, a contradictory combination. Disabling it here instead of
  // leaving it live is the resolution this build takes.
  readonly referralApprovedDisabled = computed(() => this.referralApplicableSig() !== 'yes');

  readonly canSave = computed(() => {
    if (this.isClosed()) return false;
    const exposure = this.exposureSig();
    if (!exposure) return false;
    const saved = this.saved();
    if (exposure === 'no') {
      return (saved?.exposure ?? 'no') !== 'no';
    }
    // exposure === 'yes'
    return (
      saved?.exposure !== 'yes' ||
      this.boolToYesNo(saved.referralApplicable) !== this.referralApplicableSig() ||
      (saved.esraCompletionDate ?? null) !== this.esraCompletionDateSig() ||
      this.boolToYesNo(saved.referralApproved) !== this.referralApprovedSig() ||
      (saved.esraId ?? '') !== (this.esraIdSig() ?? '') ||
      (saved.comments ?? '') !== (this.commentsSig() ?? '')
    );
  });

  ngOnChanges(): void {
    this.claimSig.set(this.claim);
    const ts = this.claim.tradeSanctions ?? null;
    // Emit normally (unlike recovery-potential-card's re-sync) — showExpanded/
    // canSave/referralApprovedDisabled are all computed off these controls'
    // valueChanges via toSignal(), not off claimSig(). A silent emitEvent:false
    // re-sync left those signals frozen at their pre-save value, so the detail
    // section collapsed the instant Save committed even though exposure was
    // still 'yes' — confirmed in browser: the radio stayed checked (CVA reads
    // .value directly) but .ts-details vanished from the DOM.
    this.exposure.setValue(ts?.exposure ?? null);
    this.referralApplicable.setValue(this.boolToYesNo(ts?.referralApplicable));
    this.esraCompletionDate.setValue(ts?.esraCompletionDate ?? null);
    this.referralApproved.setValue(this.boolToYesNo(ts?.referralApproved));
    this.esraId.setValue(ts?.esraId ?? '');
    this.comments.setValue(ts?.comments ?? '');
  }

  async onSave(): Promise<void> {
    const exposure = this.exposureSig();
    if (!exposure || this.isClosed()) return;

    const next: TradeSanctionsCheck =
      exposure === 'no'
        ? { exposure: 'no' }
        : {
            exposure: 'yes',
            // Leave unanswered radios as `undefined`, not a coerced `false`
            // — an untouched "Sanction referral applicable?" must read back
            // as "Not answered", not silently commit to "No" just because
            // Exposure was saved.
            referralApplicable:
              this.referralApplicableSig() === null
                ? undefined
                : this.referralApplicableSig() === 'yes',
            esraCompletionDate: this.esraCompletionDateSig() ?? undefined,
            referralApproved:
              this.referralApplicableSig() === 'yes' && this.referralApprovedSig() !== null
                ? this.referralApprovedSig() === 'yes'
                : undefined,
            esraId: this.esraIdSig() || undefined,
            comments: this.commentsSig() || undefined
          };

    const data: ConfirmDialogData = {
      title: 'Save trade sanctions check',
      message: `Trade sanctions exposure will be recorded on ${this.claim.claimId}.`,
      changes: this.confirmChanges(next),
      confirmLabel: 'Save answer',
      cancelLabel: 'Back'
    };
    const ref = this.dialogSvc.open(ConfirmDialogComponent, {
      data,
      width: '520px',
      maxWidth: '92vw'
    });
    if ((await firstValueFrom(ref.afterClosed())) !== true) return;

    this.commit(next);
  }

  onReset(): void {
    this.ngOnChanges();
    this.collapsed.set(true);
  }

  toggleCollapsed(): void {
    this.collapsed.set(!this.collapsed());
  }

  private confirmChanges(next: TradeSanctionsCheck): ConfirmDialogChange[] {
    const rows: ConfirmDialogChange[] = [];
    const saved = this.saved();
    const savedExposure = saved?.exposure ?? 'Not answered';
    if (next.exposure !== (saved?.exposure ?? null)) {
      rows.push({
        label: 'Exposure to trade sanctions',
        original: this.answerLabel(savedExposure),
        updated: this.answerLabel(next.exposure)
      });
    }
    if (next.exposure === 'yes') {
      if (this.boolToYesNo(saved?.referralApplicable) !== this.boolToYesNo(next.referralApplicable)) {
        rows.push({
          label: 'Sanction referral applicable',
          original: this.answerLabel(this.boolToYesNo(saved?.referralApplicable) ?? 'Not answered'),
          updated: this.answerLabel(this.boolToYesNo(next.referralApplicable) ?? 'Not answered')
        });
      }
      if ((saved?.esraCompletionDate ?? '') !== (next.esraCompletionDate ?? '')) {
        rows.push({
          label: 'Date of completion of ESRA',
          original: saved?.esraCompletionDate ?? '—',
          updated: next.esraCompletionDate ?? '—'
        });
      }
      if (this.boolToYesNo(saved?.referralApproved) !== this.boolToYesNo(next.referralApproved)) {
        rows.push({
          label: 'Sanction referral approved in ESRA',
          original: this.answerLabel(this.boolToYesNo(saved?.referralApproved) ?? 'Not answered'),
          updated: this.answerLabel(this.boolToYesNo(next.referralApproved) ?? 'Not answered')
        });
      }
      if ((saved?.esraId ?? '') !== (next.esraId ?? '')) {
        rows.push({ label: 'ESRA ID', original: saved?.esraId ?? '—', updated: next.esraId ?? '—' });
      }
      if ((saved?.comments ?? '') !== (next.comments ?? '')) {
        rows.push({
          label: 'Additional comments',
          original: saved?.comments ?? '—',
          updated: next.comments ?? '—'
        });
      }
    }
    return rows;
  }

  private answerLabel(value: 'yes' | 'no' | string): string {
    return value === 'yes' ? 'Yes' : value === 'no' ? 'No' : value;
  }

  private boolToYesNo(value: boolean | undefined): 'yes' | 'no' | null {
    if (value === undefined) return null;
    return value ? 'yes' : 'no';
  }

  private commit(next: TradeSanctionsCheck): void {
    const claim = this.claim;
    const previous = this.saved()?.exposure ?? 'Not answered';

    const activity: ClaimActivity = {
      id: `act-${Date.now()}`,
      claimId: claim.claimId,
      user: claim.assignedHandler,
      timestamp: new Date().toISOString(),
      objectType: 'Claim',
      attribute: 'Trade sanctions check',
      valueOld: previous,
      valueNew: next.exposure
    };

    this.updated.emit({ claim: { ...claim, tradeSanctions: next }, activity });
    this.toast.success(
      'Trade sanctions check saved',
      next.exposure === 'yes' ? 'Recorded with exposure.' : 'Recorded — no exposure.'
    );
    this.collapsed.set(true);
  }
}
