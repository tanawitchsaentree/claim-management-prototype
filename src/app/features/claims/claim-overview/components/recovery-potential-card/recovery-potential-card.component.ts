import { Component, EventEmitter, Input, OnChanges, Output, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { StatusChipComponent } from '../../../../../shared/components/status-chip/status-chip.component';
import { ToastService } from '../../../../../shared/components/toast/toast.service';
import { ClaimOverview, ClaimActivity } from '../../../../../core/models/claim-overview.model';
import {
  RecoveryPotentialState,
  recoveryPotentialState,
  RECOVERY_STATE_MESSAGE,
} from '../../../../../core/models/recovery-potential.model';

export interface RecoveryPotentialUpdated {
  claim: ClaimOverview;
  activity: ClaimActivity;
}

const MAX_NOTE = 300;

/**
 * Recovery potential — answered with radios directly on the card.
 *
 * This used to be a chip plus a "Set/Update" link that opened a modal. The
 * Recoveries call (2026-09-01) rejected that: nobody was answering, because a
 * question hidden one click behind a link labelled "Set" reads as optional.
 * The radios are on the surface now, an unanswered claim says so in a warning,
 * and the closure checklist refuses to pass until it has an answer.
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
    ReactiveFormsModule, RouterLink,
    NxRadioModule, NxMessageModule, NxButtonModule,
    NxFormfieldModule, NxInputModule, NxIconModule,
    StatusChipComponent,
  ],
  templateUrl: './recovery-potential-card.component.html',
  styleUrl: './recovery-potential-card.component.scss',
})
export class RecoveryPotentialCardComponent implements OnChanges {
  @Input({ required: true }) claim!: ClaimOverview;
  @Output() updated = new EventEmitter<RecoveryPotentialUpdated>();

  private readonly toast = inject(ToastService);

  readonly maxNote = MAX_NOTE;

  readonly choice = new FormControl<'yes' | 'no' | null>(null);
  readonly note = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(MAX_NOTE)],
  });

  private readonly claimSig = signal<ClaimOverview | null>(null);
  private readonly choiceSig = toSignal(this.choice.valueChanges, { initialValue: this.choice.value });
  private readonly noteSig = toSignal(this.note.valueChanges, { initialValue: this.note.value });
  private readonly noteTouched = signal(false);

  readonly state = computed<RecoveryPotentialState>(() => {
    const claim = this.claimSig();
    return claim ? recoveryPotentialState(claim) : 'unanswered';
  });

  readonly isClosed = computed(() => this.claimSig()?.status === 'Closed');
  readonly savedChoice = computed(() => this.claimSig()?.recoveryPotential ?? null);
  readonly savedNote = computed(() => this.claimSig()?.recoveryPotentialNote ?? '');

  /** The prompt only earns its place on the card while something is outstanding. */
  readonly showPrompt = computed(() => !this.isClosed() && (this.state() === 'unanswered' || this.state() === 'yes-pending'));
  readonly message = computed(() => RECOVERY_STATE_MESSAGE[this.state()]);
  readonly promptContext = computed(() => (this.state() === 'unanswered' ? 'warning' : 'info'));

  /**
   * "No" takes a rationale. An unexplained No is the answer an audit asks
   * about, and it is also the cheapest way to make the question go away — so
   * it should cost something to give.
   */
  readonly needsNote = computed(() => this.choiceSig() === 'no');
  readonly noteInvalid = computed(() => this.needsNote() && this.noteTouched() && this.note.invalid);

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

  onSave(): void {
    const choice = this.choiceSig();
    if (!choice || this.isClosed()) return;
    if (choice === 'no' && this.note.invalid) {
      this.noteTouched.set(true);
      return;
    }
    this.commit(choice, choice === 'no' ? this.note.value.trim() : undefined);
  }

  /** Discard an in-progress change and go back to what is on record. */
  onReset(): void {
    this.ngOnChanges();
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
      valueNew: note ? `${value} — ${note}` : value,
    };

    this.updated.emit({
      claim: { ...claim, recoveryPotential: value, recoveryPotentialNote: note },
      activity,
    });

    if (value === 'yes') {
      this.toast.success('Recovery potential set to Yes', 'Set up the recovery case to complete this claim.');
    } else {
      this.toast.success('Recovery potential set to No', 'Closure is no longer held up by recovery.');
    }
  }
}
