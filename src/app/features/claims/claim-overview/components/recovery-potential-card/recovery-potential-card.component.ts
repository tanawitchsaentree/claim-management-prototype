import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  computed,
  inject,
  signal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { firstValueFrom } from 'rxjs';
import { StatusChipComponent } from '../../../../../shared/components/status-chip/status-chip.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../../../../shared/components/toast/toast.service';
import { ClaimOverview, ClaimActivity } from '../../../../../core/models/claim-overview.model';
import {
  RecoveryPotentialState,
  recoveryPotentialState
} from '../../../../../core/models/recovery-potential.model';

export interface RecoveryPotentialUpdated {
  claim: ClaimOverview;
  activity: ClaimActivity;
}

/**
 * Recovery potential — always expanded (2026-09-30: accordion/chevron
 * removed same day it was requested — user call, "ไม่เอา accordion กางออกมาก่อน").
 * Question, radios, and status chip are all visible unconditionally; nothing
 * to expand/collapse. The closure checklist still refuses to pass without an
 * answer regardless.
 *
 * Auto-saves on selection (2026-09-30, team call — no Save button, no
 * confirm dialog for picking Yes/No). This is genuinely a 3-state field
 * (blank / yes / no), not a boolean with a default — a freshly created claim
 * must render blank, never silently default to "no", because blank and "no
 * recovery expected" are different recorded facts an audit needs to tell
 * apart. Losing the old confirm-before-commit step (deliberately added
 * 2026-09-02 specifically so a misclick on a closure-gating field wasn't
 * unrecoverable) is a real trade-off, accepted as-is (no Undo action on the
 * save toast — tried, then explicitly asked to be removed same day) — the
 * only remaining mitigation is the separate "Clear answer" control (below),
 * which DOES still confirm, since erasing a fact that was already on record
 * is a bigger deal than recording one in the first place.
 */
@Component({
  selector: 'app-recovery-potential-card',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NxRadioModule,
    NxButtonModule,
    NxIconModule,
    NxModalModule,
    StatusChipComponent
  ],
  templateUrl: './recovery-potential-card.component.html',
  styleUrl: './recovery-potential-card.component.scss'
})
export class RecoveryPotentialCardComponent implements OnChanges {
  @Input({ required: true }) claim!: ClaimOverview;
  @Output() updated = new EventEmitter<RecoveryPotentialUpdated>();

  private readonly toast = inject(ToastService);
  private readonly dialogSvc = inject(NxDialogService);

  readonly choice = new FormControl<'yes' | 'no' | null>(null);

  private readonly claimSig = signal<ClaimOverview | null>(null);
  private readonly choiceSig = toSignal(this.choice.valueChanges, {
    initialValue: this.choice.value
  });

  readonly state = computed<RecoveryPotentialState>(() => {
    const claim = this.claimSig();
    return claim ? recoveryPotentialState(claim) : 'unanswered';
  });

  readonly isClosed = computed(() => this.claimSig()?.status === 'Closed');
  readonly savedChoice = computed(() => this.claimSig()?.recoveryPotential ?? null);

  /** "Clear answer" only makes sense once there is an answer on record. */
  readonly canClear = computed(() => !this.isClosed() && this.savedChoice() !== null);

  /** Link out to the recovery domain once a recovery has been committed to. */
  readonly showSetUpRecovery = computed(() => !this.isClosed() && this.state() === 'yes-pending');

  ngOnChanges(): void {
    this.claimSig.set(this.claim);
    // The radios mirror what is on record. Written without emitting so that
    // re-feeding the claim after a save does not read as a fresh selection.
    this.choice.setValue(this.claim.recoveryPotential ?? null, { emitEvent: false });
  }

  /**
   * Fires on every radio click (NxRadioGroup's own (valueChange) output, not
   * a FormControl.valueChanges subscription — this class stays subscribe()-free).
   * Auto-saves immediately; no confirm dialog for picking Yes/No (2026-09-30).
   */
  onAnswerSelected(value: 'yes' | 'no' | null): void {
    if (!value || this.isClosed() || value === this.savedChoice()) return;
    this.commitAnswer(value);
  }

  /**
   * Erasing a recorded answer is a bigger deal than recording one — this is
   * the one action on this card that still confirms, deliberately.
   */
  async onClearAnswer(): Promise<void> {
    if (!this.canClear()) return;
    const data: ConfirmDialogData = {
      title: 'Clear recovery potential',
      message: `${this.claim.claimId} will show as Not answered again. This does not delete the claim's history — it can be answered again at any time.`,
      confirmLabel: 'Clear answer',
      confirmDanger: true,
      cancelLabel: 'Back'
    };
    const ref = this.dialogSvc.open(ConfirmDialogComponent, {
      data,
      width: '480px',
      maxWidth: '92vw'
    });
    if ((await firstValueFrom(ref.afterClosed())) !== true) return;
    this.commitAnswer(null);
  }

  private commitAnswer(value: 'yes' | 'no' | null): void {
    const claim = this.claim;
    const previous = claim.recoveryPotential ?? null;

    const activity: ClaimActivity = {
      id: `act-${Date.now()}`,
      claimId: claim.claimId,
      user: claim.assignedHandler,
      timestamp: new Date().toISOString(),
      objectType: 'Claim',
      attribute: 'Recovery potential',
      valueOld: previous,
      valueNew: value
    };

    this.updated.emit({
      claim: { ...claim, recoveryPotential: value },
      activity
    });

    this.toast.success(...this.toastFor(value));
  }

  private toastFor(value: 'yes' | 'no' | null): [string, string] {
    if (value === 'yes') {
      return ['Recovery potential set to Yes', 'Set up the recovery case to complete this claim.'];
    }
    if (value === 'no') {
      return ['Recovery potential set to No', 'Closure is no longer held up by recovery.'];
    }
    return ['Recovery potential cleared', 'This claim shows as Not answered again.'];
  }
}
