import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import { Router } from '@angular/router';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { firstValueFrom } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxBadgeModule } from '@allianz/ng-aquila/badge';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { FnolStateService } from '../../../../core/services/fnol-state.service';
import { MockImpactedPoliciesService } from '../../../../core/mock/services/mock-impacted-policies.service';
import { PolicyChoice } from '../../../../core/models';
import { WizardFooterComponent } from '../../../../shared/components/wizard-footer/wizard-footer.component';
import { StatusChipComponent } from '../../../../shared/components/status-chip/status-chip.component';
import { AppDatePipe } from '../../../../shared/pipes/app-date.pipe';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PolicySelectionService } from '../../services/policy-selection.service';
import {
  FindPolicyModalComponent,
  FindPolicyModalData
} from '../../components/find-policy-modal/find-policy-modal.component';

/**
 * BMPCC-22665: FNOL "Policies" step. One table of the searched policy, the
 * policies the coverage check suggests, and any found with policy search;
 * the handler ticks every policy that gets a claim. Decisions IMP-1..IMP-6 are
 * recorded in public/tickets/bmpcc-22665.json and in the code they shape.
 */
@Component({
  selector: 'app-step-policies',
  standalone: true,
  imports: [
    NxButtonModule,
    NxIconModule,
    NxMessageModule,
    NxTableModule,
    NxCheckboxModule,
    NxBadgeModule,
    NxSpinnerModule,
    WizardFooterComponent,
    StatusChipComponent,
    AppDatePipe
  ],
  templateUrl: './step-policies.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './step-policies.component.scss'
})
export class StepPoliciesComponent implements OnInit {
  private readonly fnolState = inject(FnolStateService);
  private readonly impactedSvc = inject(MockImpactedPoliciesService);
  private readonly selectionSvc = inject(PolicySelectionService);
  private readonly dialog = inject(NxDialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly live = inject(LiveAnnouncer);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly saving = signal(false);
  readonly rows = signal<PolicyChoice[]>([]);
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly showNoneError = signal(false);

  readonly selectedRows = computed(() =>
    this.rows().filter(r => this.selected().has(r.policyNumber))
  );
  readonly currencies = computed(() => [...new Set(this.selectedRows().map(r => r.currency))]);
  readonly clients = computed(() => [...new Set(this.selectedRows().map(r => r.clientName))]);

  get searchedNumber(): string {
    return this.fnolState.policyStep?.searched.policyNumber ?? '';
  }

  ngOnInit(): void {
    if (!this.fnolState.policyStep) {
      // Reached without Loss information deciding there is a step: nothing to choose.
      this.router.navigate([
        this.fnolState.selectedPolicy ? '/fnol/entities-damages' : '/fnol/search'
      ]);
      return;
    }
    void this.load();
  }

  async load(): Promise<void> {
    const step = this.fnolState.policyStep!;
    this.loading.set(true);
    this.error.set(false);
    const searched = this.impactedSvc.toChoice(step.searched.policyNumber, 'searched');
    const added = step.added
      .map(p =>
        this.impactedSvc.toChoice(
          p,
          'search',
          'Added from policy search. Not checked by the coverage check.'
        )
      )
      .filter((c): c is PolicyChoice => !!c);
    try {
      const suggested = await firstValueFrom(
        this.impactedSvc.getSuggestions(step.searched.policyNumber)
      );
      this.rows.set([...(searched ? [searched] : []), ...suggested, ...added]);
      // DESIGN DECISION IMP-2: only the searched policy starts ticked. A claim
      // is a commitment (reserves, reporting), so suggestions are opted into,
      // each one in plain view with why it was suggested.
      this.selected.set(new Set(step.selection ?? [step.searched.policyNumber]));
    } catch {
      this.rows.set(searched ? [searched] : []);
      this.selected.set(new Set([step.searched.policyNumber]));
      this.error.set(true);
      this.live.announce("We couldn't check the client's other policies.", 'assertive');
    } finally {
      this.loading.set(false);
    }
  }

  isSelected(p: string): boolean {
    return this.selected().has(p);
  }

  toggle(p: string): void {
    const next = new Set(this.selected());
    if (next.has(p)) next.delete(p);
    else next.add(p);
    this.selected.set(next);
    if (next.size) this.showNoneError.set(false);
  }

  async openSearch(): Promise<void> {
    const step = this.fnolState.policyStep!;
    const data: FindPolicyModalData = {
      clientName: this.rows()[0]?.clientName ?? '',
      inList: this.rows().map(r => r.policyNumber)
    };
    const ref = this.dialog.open<FindPolicyModalComponent, FindPolicyModalData, string[]>(
      FindPolicyModalComponent,
      { data, width: '900px', maxWidth: '95vw' }
    );
    const picked = (await firstValueFrom(ref.afterClosed())) ?? [];
    if (!picked.length) return;
    step.added = [...step.added, ...picked];
    const choices = picked
      .map(p =>
        this.impactedSvc.toChoice(
          p,
          'search',
          'Added from policy search. Not checked by the coverage check.'
        )
      )
      .filter((c): c is PolicyChoice => !!c);
    this.rows.update(r => [...r, ...choices]);
    this.selected.update(s => new Set([...s, ...picked]));
    this.showNoneError.set(false);
    const what = picked.length === 1 ? picked[0] : `${picked.length} policies`;
    this.toast.success(`${what} added to the list`, 'Selected, so a claim will be created on it.');
  }

  onBack(): void {
    this.router.navigate(['/fnol/loss-information']);
  }

  onCancel(): void {
    this.router.navigate(['/dashboard']);
  }

  async onNext(): Promise<void> {
    const chosen = this.selectedRows().map(r => r.policyNumber);
    if (!chosen.length) {
      this.showNoneError.set(true);
      this.live.announce('Select at least one policy to continue.', 'assertive');
      return;
    }
    // DESIGN DECISION IMP-3: confirm only when the result differs from a plain
    // FNOL (more than one claim, or not on the searched policy). Ticking just
    // the searched policy is what happens without this step, nothing to confirm.
    const asToday = chosen.length === 1 && chosen[0] === this.searchedNumber;
    // AC-02: unticking a policy (or changing the first one) takes the entities
    // already chosen for it off Entities & Damages. Say so before it happens.
    const lost = await this.selectionSvc.entitiesLostBy(chosen);
    const lostText = lost.length ? this.lostSentence(lost) : '';
    if (!asToday && !(await this.confirm(chosen, lostText))) return;
    if (asToday && lost.length && !(await this.confirmRemoval(lostText))) return;
    this.saving.set(true);
    await this.selectionSvc.applySelection(chosen);
    this.saving.set(false);
    this.fnolState.markStepComplete('policies');
    const removed = lost.length
      ? `Entities of ${lost.map(l => l.policyNumber).join(' and ')} removed`
      : '';
    if (!asToday) {
      this.toast.success(
        `${chosen.length} ${chosen.length === 1 ? 'policy' : 'policies'} selected`,
        `${removed ? `${removed}. ` : ''}Entities & Damages now lists the entities of every selected policy.`
      );
    } else if (removed) {
      this.toast.success(removed, `${lost.flatMap(l => l.names).join(', ')}.`);
    }
    this.router.navigate(['/fnol/entities-damages']);
  }

  /** Error state: carry on as a normal FNOL on the searched policy. */
  async continueSearchedOnly(): Promise<void> {
    this.selected.set(new Set([this.searchedNumber]));
    await this.onNext();
  }

  private lostSentence(lost: { policyNumber: string; names: string[] }[]): string {
    const n = lost.reduce((sum, l) => sum + l.names.length, 0);
    const parts = lost.map(l => `${l.policyNumber}: ${l.names.join(', ')}`).join('; ');
    return `${n === 1 ? 'The entity' : `The ${n} entities`} you chose on Entities & Damages will be removed (${parts}).`;
  }

  private async confirm(chosen: string[], lostText: string): Promise<boolean> {
    const list = this.selectedRows()
      .map(r => `${r.policyNumber} (${r.lineOfBusiness})`)
      .join(', ');
    const n = chosen.length;
    const data: ConfirmDialogData = {
      title:
        n === 1 ? 'Create the claim on this policy?' : `Create a claim on each of ${n} policies?`,
      message:
        `${n === 1 ? 'One claim' : `${n} claims`} will be created when you submit this notification: ${list}. ` +
        `${n === 1 ? 'It gets' : 'They all get'} the loss information you entered. You can come back and change this until you submit.`,
      // Same warning note the Edit loss information confirm uses for "something
      // else will change" (edit-loss-information.component.ts:568-579).
      note: lostText || undefined,
      noteContext: lostText ? 'warning' : undefined,
      confirmLabel: n === 1 ? 'Continue with this policy' : `Continue with ${n} policies`,
      cancelLabel: 'Back to selection'
    };
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data,
      width: '440px',
      maxWidth: '92vw'
    });
    return !!(await firstValueFrom(ref.afterClosed()));
  }

  /** Back to the searched policy only, but entities were chosen: same remove confirm as Entities & Damages (entity-dialogs.ts confirmRemove). */
  private async confirmRemoval(lostText: string): Promise<boolean> {
    const data: ConfirmDialogData = {
      title: 'Remove the chosen entities?',
      message: lostText,
      confirmLabel: 'Remove',
      cancelLabel: 'Back to selection',
      confirmDanger: true
    };
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data,
      width: '440px',
      maxWidth: '92vw'
    });
    return !!(await firstValueFrom(ref.afterClosed()));
  }
}
