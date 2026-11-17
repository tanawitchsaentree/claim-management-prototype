import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  ChangeDetectionStrategy
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';
import { firstValueFrom, map } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { MockLargeLossHeadsUpService } from '../../../core/mock/services/mock-large-loss-heads-up.service';
import {
  HEADS_UP_REASONS,
  HEADS_UP_THRESHOLD,
  HeadsUpAttachment,
  LargeLossHeadsUp,
  incurredOf
} from '../../../core/models/large-loss-heads-up.model';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  CreateHeadsUpDialogComponent,
  CreateHeadsUpDialogData,
  CreateHeadsUpDialogResult
} from '../../../shared/components/create-heads-up-dialog/create-heads-up-dialog.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { HeadsUpAssessmentSectionComponent } from './assessment-section/heads-up-assessment-section.component';
import { HeadsUpAttachmentsSectionComponent } from './attachments-section/heads-up-attachments-section.component';
import { HeadsUpPrefillSectionComponent } from './prefill-section/heads-up-prefill-section.component';
import {
  HeadsUpForm,
  buildHeadsUpForm,
  formatErrors,
  readHeadsUpForm,
  requireForSubmit,
  stillMissing
} from './heads-up-form';
import { confirmLeave, confirmSave } from './heads-up-confirm';

// BMPCC-22350 Large Loss Heads-Up form, a full page in the Make payment shape
// (header, sections, sticky footer). See DESIGN DECISION HU-1 in
// large-loss-heads-up.model.ts. States: loading, error, no Heads-Up yet,
// draft (pre-fill complete, partial, or financial data pending), save failed,
// submitted (read-only).
@Component({
  selector: 'app-heads-up-page',
  standalone: true,
  imports: [
    DecimalPipe,
    NxButtonModule,
    NxMessageModule,
    NxSpinnerModule,
    PageHeaderComponent,
    StatusChipComponent,
    EmptyStateComponent,
    AppDatePipe,
    HeadsUpPrefillSectionComponent,
    HeadsUpAssessmentSectionComponent,
    HeadsUpAttachmentsSectionComponent
  ],
  templateUrl: './heads-up-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './heads-up-page.component.scss'
})
export class HeadsUpPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly stateSvc = inject(MockStateService);
  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly headsUpSvc = inject(MockLargeLossHeadsUpService);
  private readonly dialogSvc = inject(NxDialogService);
  private readonly toast = inject(ToastService);

  readonly threshold = HEADS_UP_THRESHOLD;
  readonly claimId = toSignal(this.route.paramMap.pipe(map(p => p.get('id') ?? '')), { initialValue: '' });
  readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  readonly claim = computed(() => this.stateSvc.state().overviews[this.claimId()]);
  readonly headsUp = computed(() => this.claim()?.headsUp);
  readonly readonly = computed(() => this.headsUp()?.status === 'submitted');
  readonly incurred = computed(() => incurredOf(this.claim()?.financialSummary));

  readonly form = signal<FormGroup<HeadsUpForm> | null>(null);
  readonly attachments = signal<HeadsUpAttachment[]>([]);
  readonly missing = signal<string[]>([]);
  readonly formatProblems = signal<string[]>([]);
  readonly saving = signal<'draft' | 'submit' | null>(null);
  readonly saveFailed = signal(false);
  private builtFrom: LargeLossHeadsUp | undefined;

  readonly reasonText = computed(() => {
    const hu = this.headsUp();
    if (!hu) return '';
    const labels = hu.reasons.map(r => HEADS_UP_REASONS.find(x => x.value === r)?.label ?? r);
    if (hu.origin === 'threshold') labels.unshift('Incurred reached 1M');
    return labels.join(', ');
  });

  constructor() {
    effect(() => {
      const id = this.claimId();
      untracked(() => void this.load(id));
    });
    // Reactivity bridge: a record changed from outside (DEV banner Apply)
    // rebuilds the form, unless the handler has unsaved changes.
    effect(() => {
      const hu = this.headsUp();
      untracked(() => {
        if (hu && hu !== this.builtFrom && !this.isDirty()) this.build(hu);
      });
    });
  }

  async load(id: string): Promise<void> {
    if (!id) return;
    this.status.set('loading');
    try {
      await firstValueFrom(this.overviewSvc.getOverview(id));
    } catch {
      this.status.set('error');
      return;
    }
    this.headsUpSvc.ensurePrefill(id);
    this.headsUpSvc.markThresholdSeen(id);
    const hu = this.headsUp();
    if (hu) this.build(hu);
    this.status.set('ready');
  }

  async onSave(mode: 'draft' | 'submit'): Promise<void> {
    const form = this.form();
    const hu = this.headsUp();
    if (!form || !hu || this.saving()) return;
    this.saveFailed.set(false);
    this.formatProblems.set(formatErrors(form));
    this.missing.set(mode === 'submit' ? requireForSubmit(form) : []);
    if (this.formatProblems().length || this.missing().length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (this.attachments().some(a => a.status === 'uploading')) {
      this.toast.warning('Wait until the uploads finish', 'Then save again.');
      return;
    }
    if (!(await this.confirm(confirmSave(mode, this.claimId())))) return;
    this.saving.set(mode);
    const ok = await this.headsUpSvc.save(
      this.claimId(),
      { ...readHeadsUpForm(form, hu), attachments: this.attachments() },
      mode
    );
    this.saving.set(null);
    if (!ok) {
      this.saveFailed.set(true);
      this.toast.error("Couldn't save the Heads-Up", 'Your changes are still here. Try again.');
      return;
    }
    const saved = this.headsUp();
    if (saved) this.build(saved);
    if (mode === 'submit') {
      this.toast.success('Heads-Up submitted', 'Key Case Management has it now.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      this.toast.success('Draft saved', 'It is not sent to Key Case Management until you submit it.');
    }
  }

  async onCancel(): Promise<void> {
    if (this.isDirty() && !(await this.confirm(confirmLeave()))) return;
    this.router.navigate(['/claims', this.claimId(), 'overview']);
  }

  async onCreate(): Promise<void> {
    const ref = this.dialogSvc.open<CreateHeadsUpDialogComponent, CreateHeadsUpDialogData, CreateHeadsUpDialogResult>(
      CreateHeadsUpDialogComponent,
      {
        data: {
          claimId: this.claimId(),
          incurred: this.incurred(),
          currency: this.claim()?.financialSummary?.currency ?? 'EUR'
        },
        width: '560px'
      }
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    this.headsUpSvc.create(this.claimId(), result.reasons, result.note);
    this.toast.success('Draft Heads-Up created', 'Check what was filled in from the claim, then add your assessment.');
  }

  /** Keeps the "fill in N fields" summary true while the handler fixes them. */
  refreshSummary(): void {
    const form = this.form();
    if (!form || !this.missing().length) return;
    queueMicrotask(() => this.missing.set(stillMissing(form)));
  }

  retryLoad(): void {
    void this.load(this.claimId());
  }

  private build(hu: LargeLossHeadsUp): void {
    this.builtFrom = hu;
    this.form.set(buildHeadsUpForm(hu));
    this.attachments.set(hu.attachments ?? []);
  }

  private isDirty(): boolean {
    const form = this.form();
    if (!form || !this.builtFrom) return false;
    return form.dirty || JSON.stringify(this.attachments()) !== JSON.stringify(this.builtFrom.attachments ?? []);
  }

  private async confirm(data: ConfirmDialogData): Promise<boolean> {
    const ref = this.dialogSvc.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data,
      width: '480px'
    });
    return !!(await firstValueFrom(ref.afterClosed()));
  }
}
