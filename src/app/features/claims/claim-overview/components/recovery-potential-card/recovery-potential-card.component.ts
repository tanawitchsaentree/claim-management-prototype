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
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { firstValueFrom } from 'rxjs';
import { StatusChipComponent } from '../../../../../shared/components/status-chip/status-chip.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogChange,
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

const MAX_NOTE = 300;

/**
 * Recovery potential — a plain accordion card (2026-09-28: replaced an
 * amber-banner collapsed state that read as a warning box rather than a
 * control). Collapsed by default, showing just the title, a Yes/No chip once
 * answered, and a chevron; expand to answer. The closure checklist still
 * refuses to pass without an answer regardless of whether the card is open.
 *
 * Save is a deliberate second click rather than committing on selection —
 * "it needs to be clear the user needs to interact and take action", and a
 * radio that saves the instant it is grazed gives no chance to undo a misclick
 * on a field that gates claim closure.
 */
@Component({
  selector: 'app-recovery-potential-card',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NxRadioModule,
    NxButtonModule,
    NxFormfieldModule,
    NxInputModule,
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

  readonly maxNote = MAX_NOTE;

  readonly choice = new FormControl<'yes' | 'no' | null>(null);
  readonly note = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(MAX_NOTE)]
  });

  // Collapsed by default (2026-09-28 redesign) — the old always-open form sat
  // on the page whether answered or not, giving every claim the same visual
  // weight regardless of urgency. Only user actions (expand/save/cancel) ever
  // touch this, never ngOnChanges — the parent's vm$ hands every card a new
  // `claim` object on ANY sibling card's save, and collapsing this one just
  // because Trade Sanctions saved would blow away an in-progress answer here.
  readonly collapsed = signal(true);

  private readonly claimSig = signal<ClaimOverview | null>(null);
  private readonly choiceSig = toSignal(this.choice.valueChanges, {
    initialValue: this.choice.value
  });
  private readonly noteSig = toSignal(this.note.valueChanges, { initialValue: this.note.value });
  private readonly noteTouched = signal(false);

  readonly state = computed<RecoveryPotentialState>(() => {
    const claim = this.claimSig();
    return claim ? recoveryPotentialState(claim) : 'unanswered';
  });

  readonly isClosed = computed(() => this.claimSig()?.status === 'Closed');
  readonly savedChoice = computed(() => this.claimSig()?.recoveryPotential ?? null);
  readonly savedNote = computed(() => this.claimSig()?.recoveryPotentialNote ?? '');

  /**
   * "No" takes a rationale. An unexplained No is the answer an audit asks
   * about, and it is also the cheapest way to make the question go away — so
   * it should cost something to give.
   */
  readonly needsNote = computed(() => this.choiceSig() === 'no');
  readonly noteInvalid = computed(
    () => this.needsNote() && this.noteTouched() && this.note.invalid
  );

  readonly canSave = computed(() => {
    if (this.isClosed()) return false;
    const choice = this.choiceSig();
    if (!choice) return false;
    if (choice === 'no' && this.noteSig().trim() !== this.savedNote()) return true;
    return choice !== this.savedChoice();
  });

  /** Link out to the recovery domain once a recovery has been committed to. */
  readonly showSetUpRecovery = computed(() => !this.isClosed() && this.state() === 'yes-pending');

  ngOnChanges(): void {
    this.claimSig.set(this.claim);
    // The radios mirror what is on record. Written without emitting so that
    // re-feeding the claim after a save does not read as a fresh selection.
    this.choice.setValue(this.claim.recoveryPotential ?? null, { emitEvent: false });
    this.note.setValue(this.claim.recoveryPotentialNote ?? '', { emitEvent: false });
    this.noteTouched.set(false);
  }

  /**
   * Confirms before committing (2026-09-02, user: no save lands without a
   * modal). This one has more reason to than most — the answer gates claim
   * closure, "Yes" obliges someone to set up a recovery case, and the radio is
   * on the card surface where it can be grazed. The dialog names the old and
   * new value rather than asking a bare "are you sure?".
   */
  async onSave(): Promise<void> {
    const choice = this.choiceSig();
    if (!choice || this.isClosed()) return;
    if (choice === 'no' && this.note.invalid) {
      this.noteTouched.set(true);
      return;
    }
    const note = choice === 'no' ? this.note.value.trim() : undefined;

    const data: ConfirmDialogData = {
      title: 'Save recovery potential',
      message:
        choice === 'yes'
          ? `Recovery potential will be recorded as Yes on ${this.claim.claimId}. A recovery case has to be set up before this claim can be closed.`
          : `Recovery potential will be recorded as No on ${this.claim.claimId}, with the reason below. Closure will no longer be held up by recovery.`,
      changes: this.confirmChanges(choice, note),
      confirmLabel: 'Save answer',
      cancelLabel: 'Back'
    };
    const ref = this.dialogSvc.open(ConfirmDialogComponent, {
      data,
      width: '520px',
      maxWidth: '92vw'
    });
    if ((await firstValueFrom(ref.afterClosed())) !== true) return;

    this.commit(choice, note);
  }

  /** Only the rows that actually differ — a "changed from X to X" row is noise. */
  private confirmChanges(choice: 'yes' | 'no', note: string | undefined): ConfirmDialogChange[] {
    const rows: ConfirmDialogChange[] = [];
    const savedChoice = this.savedChoice();
    if (choice !== savedChoice) {
      rows.push({
        label: 'Recovery potential',
        original: savedChoice ? this.answerLabel(savedChoice) : 'Not answered',
        updated: this.answerLabel(choice)
      });
    }
    if ((note ?? '') !== this.savedNote()) {
      rows.push({ label: 'Reason', original: this.savedNote(), updated: note ?? '' });
    }
    return rows;
  }

  private answerLabel(value: 'yes' | 'no'): string {
    return value === 'yes' ? 'Yes' : 'No';
  }

  toggleCollapsed(): void {
    this.collapsed.set(!this.collapsed());
  }

  /** Discard an in-progress change and go back to what is on record. */
  onReset(): void {
    this.ngOnChanges();
    this.collapsed.set(true);
  }

  private commit(value: 'yes' | 'no', note: string | undefined): void {
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
      valueNew: note ? `${value} — ${note}` : value
    };

    this.updated.emit({
      claim: { ...claim, recoveryPotential: value, recoveryPotentialNote: note },
      activity
    });

    if (value === 'yes') {
      this.toast.success(
        'Recovery potential set to Yes',
        'Set up the recovery case to complete this claim.'
      );
    } else {
      this.toast.success(
        'Recovery potential set to No',
        'Closure is no longer held up by recovery.'
      );
    }
    this.collapsed.set(true);
  }
}
