import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { BulkClosureService } from '../../../core/services/bulk-closure.service';
import {
  BulkClosureCandidate,
  BulkClosureKind,
  BulkClosureOutcome,
  CLOSURE_CONFIRMATION_STATEMENTS
} from '../../../core/models/claim-closure.model';
import { AppDatePipe } from '../../pipes/app-date.pipe';
import { ClosureBlockerSummaryComponent } from '../closure-blocker-summary/closure-blocker-summary.component';

export interface BulkClosureModalData {
  kind: BulkClosureKind;
  ids: string[];
  reasons: string[];
  actor: { userId: string; name: string };
}

/** Undefined when the handler left before anything ran; otherwise every item's outcome. */
export type BulkClosureModalResult = BulkClosureOutcome[] | undefined;

type Step = 'checking' | 'check-error' | 'review' | 'confirm' | 'running' | 'result';

// DESIGN DECISION BMPCC-22660-2: one modal for every bulk closure, sections
// (Section overview) and claims (Claims list). Review what will and will not
// close, then one reason + one checklist confirmation for the batch, then a
// result per item. Partial success, no override for a blocked item (PO).
@Component({
  selector: 'app-bulk-closure-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxModalModule,
    NxButtonModule,
    NxIconModule,
    NxSpinnerModule,
    NxMessageModule,
    NxFormfieldModule,
    NxDropdownModule,
    NxCheckboxModule,
    ClosureBlockerSummaryComponent
  ],
  templateUrl: './bulk-closure-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './bulk-closure-modal.component.scss'
})
export class BulkClosureModalComponent {
  readonly data = inject<BulkClosureModalData>(NX_MODAL_DATA);
  private readonly modalRef =
    inject<NxModalRef<BulkClosureModalComponent, BulkClosureModalResult>>(NxModalRef);
  private readonly bulkSvc = inject(BulkClosureService);
  private readonly live = inject(LiveAnnouncer);
  private readonly fb = inject(FormBuilder);

  readonly step = signal<Step>('checking');
  readonly candidates = signal<BulkClosureCandidate[]>([]);
  readonly outcomes = signal<BulkClosureOutcome[]>([]);
  readonly statements = CLOSURE_CONFIRMATION_STATEMENTS;

  readonly form = this.fb.group({
    reason: [null as string | null, Validators.required],
    confirmed: [false, Validators.requiredTrue]
  });
  private readonly formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status
  });
  readonly formValid = computed(() => this.formStatus() === 'VALID');

  readonly ready = computed(() => this.candidates().filter(c => c.blockers.length === 0));
  readonly blocked = computed(() => this.candidates().filter(c => c.blockers.length > 0));
  readonly blockedNames = computed(() =>
    this.blocked()
      .map(c => c.name)
      .join(', ')
  );
  readonly closed = computed(() => this.outcomes().filter(o => o.status === 'closed'));
  readonly notClosed = computed(() => this.outcomes().filter(o => o.status !== 'closed'));
  readonly failed = computed(() => this.outcomes().filter(o => o.status === 'failed'));

  readonly defaultRetention = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 10);
    return new AppDatePipe().transform(d);
  })();

  readonly title = computed(() => {
    const n = this.data.ids.length;
    if (this.step() === 'result') return 'Closure result';
    return `Close ${this.count(n)}`;
  });

  constructor() {
    void this.runCheck();
  }

  /** "1 section" / "3 claims" */
  count(n: number): string {
    return `${n} ${this.data.kind}${n === 1 ? '' : 's'}`;
  }

  async runCheck(): Promise<void> {
    this.step.set('checking');
    try {
      this.candidates.set(await this.bulkSvc.check(this.data.kind, this.data.ids));
      this.step.set('review');
    } catch {
      this.step.set('check-error');
      this.live.announce('The selection could not be checked.', 'assertive');
    }
  }

  onContinue(): void {
    if (this.ready().length) this.step.set('confirm');
  }

  onBack(): void {
    this.step.set('review');
  }

  async onClose(ids = this.ready().map(c => c.id)): Promise<void> {
    if (!this.formValid() || ids.length === 0) return;
    this.step.set('running');
    const reason = this.form.value.reason!;
    const run = await this.bulkSvc.close(this.data.kind, ids, reason, this.data.actor);
    // A retry replaces only the retried rows, the rest keep their first outcome.
    const prev = this.outcomes().filter(o => !ids.includes(o.id));
    const skipped = this.blocked()
      .filter(c => !prev.some(o => o.id === c.id))
      .map(c => ({ id: c.id, name: c.name, status: 'blocked' as const, blockers: c.blockers }));
    const order = this.data.ids;
    const all = [...prev, ...run, ...skipped].sort(
      (a, b) => order.indexOf(a.id) - order.indexOf(b.id)
    );
    this.outcomes.set(all);
    this.step.set('result');
    this.live.announce(
      `${this.count(this.closed().length)} closed, ${this.notClosed().length} not closed.`,
      'polite'
    );
  }

  onRetryFailed(): void {
    void this.onClose(this.failed().map(o => o.id));
  }

  onCancel(): void {
    if (this.step() === 'running') return;
    this.modalRef.close(this.outcomes().length ? this.outcomes() : undefined);
  }
}
