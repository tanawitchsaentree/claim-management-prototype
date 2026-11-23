import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { FnolStateService } from '../../../../core/services/fnol-state.service';
import { MockReservesService } from '../../../../core/mock/services/mock-reserves.service';
import {
  applyReserveTotals,
  hasIndemnityReserve,
  Reserve,
  RESERVE_TYPES,
  ReservesPolicyData,
  ReserveType
} from '../../../../core/models/reserve.model';
import {
  AddReserveModalComponent,
  AddReserveModalData,
  AddReserveResult
} from '../../components/add-reserve-modal/add-reserve-modal.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { WizardFooterComponent } from '../../../../shared/components/wizard-footer/wizard-footer.component';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { isNarrativeActive } from '../../../../shared/utils/reserve-narrative.util';
import { ReserveClaim, ReserveClaimsService } from '../../services/reserve-claims.service';
import { ReserveClaimCardComponent } from './components/reserve-claim-card/reserve-claim-card.component';
import {
  ReserveEditorData,
  ReserveEditorSheetComponent
} from './components/reserve-editor-sheet/reserve-editor-sheet.component';

interface ClaimCard {
  claim: ReserveClaim;
  data: ReservesPolicyData;
}

/**
 * FNOL Reserves step, one card per claim the notification creates (one per
 * policy chosen on the Policies step, BMPCC-22665), as in production
 * (claims-management-main ReservesPage.ts). Each claim needs an indemnity
 * reserve or an explanation before Next. Add reserve runs production's
 * Section, Party, Damage, Reserve type cascade, then the tabbed editor.
 */
@Component({
  selector: 'app-step-reserves',
  standalone: true,
  imports: [NxModalModule, WizardFooterComponent, ReserveClaimCardComponent],
  templateUrl: './step-reserves.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './step-reserves.component.scss'
})
export class StepReservesComponent implements OnInit {
  private readonly reservesSvc = inject(MockReservesService);
  private readonly claimsSvc = inject(ReserveClaimsService);
  private readonly fnolState = inject(FnolStateService);
  private readonly dialogSvc = inject(NxDialogService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly cards = signal<ClaimCard[] | null>(null);
  // Claims Next found without an indemnity reserve and without an explanation.
  private readonly flagged = signal<Set<number>>(new Set());

  async ngOnInit(): Promise<void> {
    if (!this.fnolState.selectedPolicy && !this.fnolState.selectedClient && !this.fnolState.path) {
      this.router.navigate(['/fnol/search']);
      return;
    }
    const claims = await this.claimsSvc.loadClaims();
    this.cards.set(
      claims.map(claim => ({ claim, data: this.reservesSvc.getSync(claim.policyNumber) }))
    );
  }

  isFlagged(card: ClaimCard): boolean {
    return this.flagged().has(card.claim.index) && this.isMissing(card);
  }

  // ── Add / edit / remove ─────────────────────────────────────────────────────

  async onAddReserve(card: ClaimCard): Promise<void> {
    const ref = this.dialogSvc.open(AddReserveModalComponent, {
      data: { claim: card.claim } satisfies AddReserveModalData,
      width: '600px',
      maxWidth: '92vw'
    });
    const pick = (await firstValueFrom(ref.afterClosed())) as AddReserveResult | null | undefined;
    if (!pick) return;
    const existing = this.claimsSvc.findLine(card.claim, pick);
    await this.openEditor(
      card,
      existing ?? this.claimsSvc.newLine(card.claim, pick),
      pick.reserveType,
      !existing
    );
  }

  onEditLine(card: ClaimCard, line: Reserve): Promise<void> {
    const firstWithAmount = RESERVE_TYPES.find(t => (line.subAmounts?.[t] ?? 0) > 0);
    return this.openEditor(card, line, firstWithAmount ?? 'indemnity', false);
  }

  private async openEditor(
    card: ClaimCard,
    line: Reserve,
    tab: ReserveType,
    isNew: boolean
  ): Promise<void> {
    const work = structuredClone(line);
    const ref = this.dialogSvc.open(ReserveEditorSheetComponent, {
      data: { claim: card.claim, line: work, tab } satisfies ReserveEditorData,
      panelClass: 'bottom-sheet-modal-panel',
      showCloseIcon: false,
      disableClose: true
    });
    await firstValueFrom(ref.afterClosed());

    // Lines without an amount are dropped, so closing an untouched editor leaves nothing behind.
    const item = work.damagedItems![0];
    for (const t of RESERVE_TYPES) {
      item.subReserves[t] = (item.subReserves[t] ?? []).filter(l => l.amount > 0);
    }
    applyReserveTotals(work);
    const claimName = `Claim ${card.claim.index}`;
    const empty = RESERVE_TYPES.every(t => !item.subReserves[t]!.length);
    if (empty && isNew) {
      this.toast.info(
        'Nothing added',
        `No amount was entered, so ${claimName} has no new reserve.`
      );
      return;
    }
    if (empty) {
      await firstValueFrom(this.reservesSvc.removeReserve(card.claim.policyNumber, work.reserveId));
      this.toast.info('Reserve line removed', `All amounts were cleared on ${claimName}.`);
      this.refresh();
      return;
    }
    if (!isNew && this.sameAmounts(line, work)) return;
    await firstValueFrom(this.reservesSvc.upsertReserve(card.claim.policyNumber, work));
    await this.archiveNarrativeIfReserved(card);
    this.refresh();
    this.toast.success(
      `Reserve saved on ${claimName}`,
      `${work.partyName}, ${item.itemName}: total ${work.currency} ${work.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    );
  }

  async onRemoveLine(card: ClaimCard, line: Reserve): Promise<void> {
    const data: ConfirmDialogData = {
      title: 'Remove reserve line',
      message: `Remove the reserve for ${line.partyName}, ${line.damagedItems?.[0]?.itemName ?? line.damageType} from Claim ${card.claim.index}?`,
      confirmLabel: 'Remove',
      confirmDanger: true
    };
    const ref = this.dialogSvc.open(ConfirmDialogComponent, {
      data,
      width: '440px',
      maxWidth: '92vw'
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;
    await firstValueFrom(this.reservesSvc.removeReserve(card.claim.policyNumber, line.reserveId));
    this.refresh();
    this.toast.info('Reserve line removed', `Claim ${card.claim.index}: ${line.partyName}`);
  }

  onNarrativeSaved(): void {
    this.refresh();
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  onCancel(): void {
    this.router.navigate(['/dashboard']);
  }
  onBack(): void {
    this.router.navigate(['/fnol/parties']);
  }

  // Production gate, per claim (ReservesPage.ts:745-747): "The FNOL event may
  // create multiple claims. Any claim with no reserve and no narrative triggers
  // a blocking warning: Please add a indemnity reserve or a narrative before
  // proceeding." The dialog names the claims; their cards are marked after.
  async onNext(): Promise<void> {
    const cards = this.cards() ?? [];
    const missing = cards.filter(c => this.isMissing(c));
    if (missing.length) {
      this.flagged.set(new Set(missing.map(c => c.claim.index)));
      const ref = this.dialogSvc.open(ConfirmDialogComponent, {
        data: {
          title: 'Reserve required',
          message: this.gateMessage(cards, missing),
          confirmLabel: 'Got it',
          cancelLabel: 'Close'
        } satisfies ConfirmDialogData,
        width: '440px',
        maxWidth: '92vw'
      });
      await firstValueFrom(ref.afterClosed());
      document
        .querySelector(`[data-claim-index="${missing[0].claim.index}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    this.fnolState.markStepComplete('reserves');
    this.router.navigate(['/fnol/summary']);
  }

  private gateMessage(cards: ClaimCard[], missing: ClaimCard[]): string {
    if (cards.length === 1) {
      return 'Add an indemnity reserve, or explain why there is none yet, before you continue.';
    }
    const names = missing.map(c => `Claim ${c.claim.index} (${c.claim.policyNumber})`);
    const list =
      names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
    return `${list} ${missing.length > 1 ? 'have' : 'has'} no indemnity reserve and no explanation. Add a reserve, or explain why there is none yet, on ${missing.length > 1 ? 'each of them' : 'it'} before you continue.`;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private isMissing(card: ClaimCard): boolean {
    return !hasIndemnityReserve(card.data) && !isNarrativeActive(card.data.narrative);
  }

  private sameAmounts(before: Reserve, after: Reserve): boolean {
    const strip = (r: Reserve) =>
      JSON.stringify(applyReserveTotals(structuredClone(r)).damagedItems);
    return strip(before) === strip(after);
  }

  // Once a claim has an indemnity reserve its "no reserve" explanation no longer applies.
  private async archiveNarrativeIfReserved(card: ClaimCard): Promise<void> {
    if (hasIndemnityReserve(card.data) && isNarrativeActive(card.data.narrative)) {
      await firstValueFrom(this.reservesSvc.archiveNarrative(card.claim.policyNumber));
    }
  }

  private refresh(): void {
    this.cards.update(list => (list ? [...list] : list));
  }
}
