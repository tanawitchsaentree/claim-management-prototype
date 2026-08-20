import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxModalModule, NxModalRef, NX_MODAL_DATA, NxDialogService } from '@allianz/ng-aquila/modal';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { MockStateService } from '../../../../core/mock/state/mock-state.service';
import { ClaimDevHelperService, TicketCard, TicketAC, PreconditionItem, ACVerification } from '../claim-dev-helper.service';
import { InlineMarkdownPipe } from '../../../../shared/pipes/inline-markdown.pipe';
import { VerifierNameModalComponent } from '../verifier-name-modal/verifier-name-modal.component';
import { environment } from '../../../../../environments/environment';

export interface ClaimDevDetailsModalData {
  card:             TicketCard;
  helper:           ClaimDevHelperService;
  preselectedAcId:  string | null;
}

@Component({
  selector: 'app-claim-dev-details-modal',
  standalone: true,
  imports: [CommonModule, NxModalModule, NxRadioModule, NxButtonModule, NxIconModule, NxTooltipModule, InlineMarkdownPipe],
  templateUrl: './claim-dev-details-modal.component.html',
  styleUrl:    './claim-dev-details-modal.component.scss',
})
export class ClaimDevDetailsModalComponent implements OnInit {
  readonly data     = inject<ClaimDevDetailsModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<ClaimDevDetailsModalComponent>>(NxModalRef);
  private readonly stateSvc = inject(MockStateService);
  private readonly router   = inject(Router);
  private readonly dialog   = inject(NxDialogService);

  readonly selectedAcId = signal<string | null>(null);

  // Reviewer split (tour-system audit, 2026-08-20) — the raw state inspector
  // is a dev-only debugging aid, not needed to understand a demo scenario.
  readonly isFullMode = environment.devBannerMode === 'full';

  get card()   { return this.data.card; }
  get ticket() { return this.card.ticket; }
  get acs()    { return this.ticket.acceptanceCriteria; }

  readonly selectedAc = computed<TicketAC | null>(() => {
    const id = this.selectedAcId();
    return id ? (this.acs.find(a => a.id === id) ?? null) : null;
  });

  readonly canApply = computed(() => {
    const ac = this.selectedAc();
    return !!ac && ac.buildStatus === 'done';
  });

  readonly selectedAcVerification = computed<ACVerification | undefined>(() => {
    const ac = this.selectedAc();
    if (!ac) return undefined;
    return this.data.helper.getVerification(this.ticket.ticketId, ac.id);
  });

  readonly isSelectedAcVerified = computed(() => !!this.selectedAcVerification());

  readonly preconditions = computed(() => {
    const ac = this.selectedAc();
    if (!ac) return { tested: [] as PreconditionItem[], setup: [] as PreconditionItem[] };
    const normalized = this.normalize(ac.setup.preconditions);
    return {
      tested: normalized.filter(p => p.role === 'tested-visible'),
      setup:  normalized.filter(p => p.role !== 'tested-visible'),
    };
  });

  readonly stateInspector = computed(() => {
    const state   = this.stateSvc.state();
    const claimId = this.ticket.targetClaim;
    const overview = state.overviews[claimId];
    const tasks    = state.tasks.filter(t => t.claimId === claimId);
    const sections = state.sections.filter(s => s.claimId === claimId);
    const openTasks    = tasks.filter(t => t.status !== 'done').length;
    const openSections = sections.filter(s => s.status !== 'Closed').length;
    return {
      status:   overview?.status ?? '—',
      tasks:    `${openTasks} pending · ${tasks.length - openTasks} done`,
      sections: `${openSections} open · ${sections.length - openSections} closed`,
      canClose: openTasks === 0 && openSections === 0 && overview?.status !== 'Closed',
    };
  });

  ngOnInit(): void {
    if (this.data.preselectedAcId) {
      this.selectedAcId.set(this.data.preselectedAcId);
    }
  }

  selectAc(id: string): void {
    const ac = this.acs.find(a => a.id === id);
    if (ac?.buildStatus !== 'done' && ac?.buildStatus !== 'partial') return;
    this.selectedAcId.set(id);
  }

  statusIcon(status: 'done' | 'partial' | 'todo'): string {
    switch (status) {
      case 'done':    return 'check-circle';
      case 'partial': return 'minus-circle';
      case 'todo':    return 'circle';
    }
  }

  shouldShowLink(pre: PreconditionItem): boolean {
    const claimId = this.data.helper.currentClaimId();
    if (!claimId || pre.page === 'any') return false;
    const targetUrl = this.data.helper.pageRoute(pre.page, claimId);
    return this.router.url !== targetUrl;
  }

  async onGoTo(pre: PreconditionItem): Promise<void> {
    const ac = this.selectedAc();
    const claimId = this.data.helper.currentClaimId();
    if (!ac || !claimId || pre.page === 'any') return;
    await this.data.helper.applyAC(ac.id);
    this.data.helper.setMinimized(ac.id);
    this.modalRef.close();
    await this.router.navigateByUrl(this.data.helper.pageRoute(pre.page, claimId));
    await this.data.helper.runPostLandFor(ac.id);
  }

  onMinimize(): void {
    const ac = this.selectedAc();
    if (!ac) return;
    this.data.helper.setMinimized(ac.id);
    this.modalRef.close();
  }

  onCancel(): void {
    this.data.helper.clearMinimized();
    this.modalRef.close();
  }

  async onApply(): Promise<void> {
    const ac = this.selectedAc();
    console.log('[onApply] start', ac?.id, ac?.buildStatus);
    if (!ac || ac.buildStatus !== 'done') return;
    await this.data.helper.applyAC(ac.id);
    console.log('[onApply] applyAC done; navigating to', ac.howToTest.route);
    this.data.helper.clearMinimized();
    this.modalRef.close();
    const ok = await this.router.navigateByUrl(ac.howToTest.route);
    console.log('[onApply] navigate result:', ok);
    await this.data.helper.runPostLandFor(ac.id);
    console.log('[onApply] postLand done');
  }

  async onCheck(): Promise<void> {
    const ac = this.selectedAc();
    if (!ac || ac.buildStatus !== 'done') return;

    let name: string = this.data.helper.verifierName() ?? '';

    if (!name) {
      const ref = this.dialog.open(VerifierNameModalComponent, { width: '420px' });
      const result = await firstValueFrom(ref.afterClosed());
      if (!result) return;
      name = result;
      this.data.helper.setVerifierName(name);
    }

    this.data.helper.markVerified(this.ticket.ticketId, ac.id, name);
  }

  onUnverify(): void {
    const ac = this.selectedAc();
    if (!ac) return;
    this.data.helper.unmarkVerified(this.ticket.ticketId, ac.id);
  }

  getVerifier(): string {
    return this.selectedAcVerification()?.verifiedBy ?? '';
  }

  getVerifyDate(): string {
    return this.fmtDate(this.selectedAcVerification()?.verifiedAt);
  }

  getVerifyTooltip(acId: string): string {
    const v = this.data.helper.getVerification(this.ticket.ticketId, acId);
    if (!v) return '';
    const date = this.fmtDate(v.verifiedAt, true);
    return `Verified by ${v.verifiedBy} · ${date}`;
  }

  // App-wide standard: DD-MM-YYYY (with HH:mm when withTime).
  private fmtDate(iso: string | undefined, withTime = false): string {
    if (!iso) return '';
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const base = `${dd}-${mm}-${d.getFullYear()}`;
    if (!withTime) return base;
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${base} ${hh}:${mi}`;
  }

  private normalize(raw: Array<string | PreconditionItem>): PreconditionItem[] {
    return raw.map(p =>
      typeof p === 'string'
        ? { text: p, page: 'any' as const, role: 'metadata' as const }
        : p
    );
  }
}
