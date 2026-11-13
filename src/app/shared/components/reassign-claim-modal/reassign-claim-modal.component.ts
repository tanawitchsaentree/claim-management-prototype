import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  NxDialogService,
  NxModalModule,
  NxModalRef,
  NX_MODAL_DATA
} from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { AuthService } from '../../../core/services/auth';
import {
  AssignableClaim,
  MockAssignmentService,
  ReassignResult
} from '../../../core/mock/services/mock-assignment.service';
import { AssignmentTarget } from '../../../core/models/team.model';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../confirm-dialog/confirm-dialog.component';

export interface ReassignClaimRow extends AssignableClaim {
  clientName: string;
}

export interface ReassignClaimModalData {
  claims: ReassignClaimRow[];
  // 'registration' (FNOL Summary, BMPCC-22666 AC01): pick only. Nothing is
  // saved until the claim is submitted, so there is no confirm step.
  mode?: 'reassign' | 'registration';
  // Registration: who gets the claim today, shown as the starting point.
  currentHandler?: string;
  // Bulk: selected claims the user may not move (left out of `claims`).
  skippedCount?: number;
}

export interface ReassignClaimModalResult {
  target: AssignmentTarget;
  reason?: string;
  // Set in 'reassign' mode once the move is saved.
  saved?: ReassignResult;
}

type ListState = 'loading' | 'error' | 'ready';

// BMPCC-22666 AC02 / AC05. One dialog for every reassign entry point (claim
// overview, claims list bulk, Claims Manager dashboard, FNOL summary).
// DESIGN DECISION RA-PICK-1: handler or team queue is a radio choice above one
// list, not two dialogs. People who can't take the claim stay in the list,
// greyed out with the reason, so the handler isn't left wondering where a
// colleague went.
// DESIGN DECISION RA-PICK-2: the confirm pops up over this dialog; a failed
// save keeps the dialog open with the choice intact.
@Component({
  selector: 'app-reassign-claim-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxModalModule,
    NxButtonModule,
    NxFormfieldModule,
    NxInputModule,
    NxIconModule,
    NxRadioModule,
    NxMessageModule,
    NxSpinnerModule
  ],
  templateUrl: './reassign-claim-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './reassign-claim-modal.component.scss'
})
export class ReassignClaimModalComponent {
  readonly data = inject<ReassignClaimModalData>(NX_MODAL_DATA);
  readonly modalRef =
    inject<NxModalRef<ReassignClaimModalComponent, ReassignClaimModalResult | null>>(NxModalRef);
  private readonly assignSvc = inject(MockAssignmentService);
  private readonly dialogSvc = inject(NxDialogService);
  private readonly auth = inject(AuthService);

  readonly isRegistration = this.data.mode === 'registration';
  readonly claims = this.data.claims ?? [];
  private readonly singleOwner =
    this.claims.length === 1 ? this.assignSvc.ownerLabel(this.claims[0]) : null;
  readonly currentOwner = this.isRegistration ? (this.data.currentHandler ?? null) : this.singleOwner;

  readonly listState = signal<ListState>('loading');
  private readonly targets = signal<AssignmentTarget[]>([]);
  readonly query = signal('');
  readonly saving = signal(false);
  readonly saveError = signal(false);

  readonly form = new FormGroup({
    kind: new FormControl<'handler' | 'team'>('handler', { nonNullable: true }),
    reason: new FormControl<string>('', { nonNullable: true })
  });
  readonly kind = signal<'handler' | 'team'>('handler');
  readonly selected = signal<AssignmentTarget | null>(null);

  readonly visibleTargets = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.targets().filter(
      t =>
        t.kind === this.kind() &&
        (!q || t.name.toLowerCase().includes(q) || t.detail.toLowerCase().includes(q))
    );
  });

  readonly title = this.isRegistration
    ? 'Choose who handles this claim'
    : this.claims.length > 1
      ? `Reassign ${this.claims.length} claims`
      : 'Reassign claim';

  constructor() {
    this.loadTargets();
  }

  async loadTargets(): Promise<void> {
    this.listState.set('loading');
    const maxAmount = Math.max(0, ...this.claims.map(c => c.lossAmount));
    try {
      this.targets.set(await firstValueFrom(this.assignSvc.targets(this.currentOwner, maxAmount)));
      this.listState.set('ready');
    } catch {
      this.listState.set('error');
    }
  }

  setKind(kind: 'handler' | 'team'): void {
    this.kind.set(kind);
    this.query.set('');
    if (this.selected()?.kind !== kind) this.selected.set(null);
  }

  select(t: AssignmentTarget): void {
    if (t.unavailableReason) return;
    this.selected.set(t);
  }

  onCancel(): void {
    this.modalRef.close(null);
  }

  async onSubmit(): Promise<void> {
    const target = this.selected();
    if (!target || this.saving()) return;
    const reason = this.form.controls.reason.value.trim() || undefined;
    if (this.isRegistration) {
      this.modalRef.close({ target, reason });
      return;
    }
    if (!(await this.confirm(target))) return;
    this.saving.set(true);
    this.saveError.set(false);
    try {
      const saved = await firstValueFrom(
        this.assignSvc.reassign(this.claims, target, this.auth.user().name, reason)
      );
      this.modalRef.close({ target, reason, saved });
    } catch {
      this.saveError.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  private async confirm(target: AssignmentTarget): Promise<boolean> {
    const one = this.claims.length === 1;
    const what = one ? this.claims[0].claimId : `${this.claims.length} claims`;
    const from = one ? ` from ${this.currentOwner}` : '';
    const to = target.kind === 'team' ? `the ${target.name} queue` : target.name;
    const me = this.auth.user().name;
    // Who hears about it: the new handler (or the team's manager) and the
    // previous handler, unless that's you.
    const told = [
      target.kind === 'team' ? target.detail.replace('Team queue, managed by ', '') : target.name,
      ...(one && this.currentOwner && !this.assignSvc.isQueue(this.claims[0])
        ? [this.currentOwner]
        : []),
      ...(!one ? ['the current handlers'] : [])
    ].filter(n => n !== me);
    const data: ConfirmDialogData = {
      title: one ? 'Reassign claim?' : `Reassign ${this.claims.length} claims?`,
      message: `${what} will move${from} to ${to}.${told.length ? ` ${told.join(' and ')} will be notified.` : ''}`,
      confirmLabel: 'Yes, reassign',
      cancelLabel: 'Back',
      hideIcon: true
    };
    const ref = this.dialogSvc.open(ConfirmDialogComponent, {
      data,
      width: '480px',
      maxWidth: '92vw'
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}
