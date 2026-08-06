import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, firstValueFrom, map, Observable, of, switchMap } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { StatusChipComponent } from '../../../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FnolStateService } from '../../services/fnol-state.service';
import { MockPartiesService } from '../../../../core/mock/services/mock-parties.service';
import { Party, PartyRole, PARTY_ROLE_LABELS } from '../../../../core/models/party.model';
import { AddPartyModalComponent, AddPartyModalData } from '../../components/add-party-modal/add-party-modal.component';
import { PartyDetailPanelComponent } from '../../components/party-detail-panel/party-detail-panel.component';
import { EditRoleDialogComponent, EditRoleDialogData } from '../../components/edit-role-dialog/edit-role-dialog.component';
import { WizardFooterComponent } from '../../../../shared/components/wizard-footer/wizard-footer.component';

interface PartiesVM {
  parties: Party[];
  loading: boolean;
  error: boolean;
}

// No policy exists on an orphan claim, so there is no claim/section hierarchy
// to group by — this is a flat party list, unlike StepPartiesComponent's tree.
const ORPHAN_TARGET_CLAIM_ID = 'ORPHAN';

@Component({
  selector: 'app-step-skeleton-parties',
  standalone: true,
  animations: [
    trigger('rowExpand', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-4px)' }),
        animate('180ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      transition(':leave', [
        animate('140ms ease-in', style({ opacity: 0, transform: 'translateY(-4px)' })),
      ]),
    ]),
  ],
  imports: [
    CommonModule,
    NxButtonModule,
    NxIconModule,
    NxTableModule,
    NxContextMenuModule,
    NxMessageModule,
    NxModalModule,
    StatusChipComponent,
    EmptyStateComponent,
    PartyDetailPanelComponent,
    WizardFooterComponent,
  ],
  templateUrl: './step-skeleton-parties.component.html',
  styleUrl: './step-skeleton-parties.component.scss',
})
export class StepSkeletonPartiesComponent implements OnInit, OnDestroy {
  private readonly partiesSvc = inject(MockPartiesService);
  private readonly fnolState  = inject(FnolStateService);
  private readonly router     = inject(Router);
  private readonly dialogSvc  = inject(NxDialogService);

  // Side panel state
  selectedParty: Party | null = null;
  panelOpen = false;
  private scrollLocked = false;

  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  vm$!: Observable<PartiesVM>;

  ngOnInit(): void {
    if (!this.fnolState.skeleton) {
      this.router.navigate(['/fnol/skeleton-create']);
      return;
    }
    this.seedBrokerFromNotifier();
    this.vm$ = this.refresh$.pipe(
      switchMap(() =>
        this.partiesSvc.getOrphanParties().pipe(
          map(parties => ({ parties, loading: false, error: false })),
          catchError(() => of({ parties: [], loading: false, error: true })),
        ),
      ),
    );
  }

  ngOnDestroy(): void { this.unlockScroll(); }

  // Carries the broker selected on the notifier screen into Parties as the
  // first party — only once, and only if it hasn't already been added.
  private seedBrokerFromNotifier(): void {
    const brokerName = this.fnolState.skeleton?.brokerName;
    const brokerIpmId = this.fnolState.skeleton?.brokerIpmId;
    if (!brokerName) return;

    firstValueFrom(this.partiesSvc.getOrphanParties()).then(existing => {
      const alreadyAdded = existing.some(p => p.roles.includes('broker') && p.legalName === brokerName);
      if (alreadyAdded) return;

      const brokerParty: Party = {
        partyId: brokerIpmId || `broker-${brokerName}`,
        legalName: brokerName,
        roles: ['broker'],
        clearanceStatus: 'cleared',
      };
      firstValueFrom(this.partiesSvc.addOrphanParty(brokerParty)).then(() => this.refresh$.next());
    });
  }

  // ── Add additional parties ───────────────────────────────────────────────

  async onAddParties(parties: Party[]): Promise<void> {
    const existingIds = new Set(parties.map(p => p.partyId));
    const modalData: AddPartyModalData = {
      policyNumber: '',
      existingPartyIds: existingIds,
      targetClaimId: ORPHAN_TARGET_CLAIM_ID,
    };

    const ref = this.dialogSvc.open(AddPartyModalComponent, { data: modalData, width: '960px', maxWidth: '92vw' });
    const selected = await firstValueFrom(ref.afterClosed()) as Party[] | undefined;
    if (!selected || selected.length === 0) return;

    for (const party of selected) {
      await firstValueFrom(this.partiesSvc.addOrphanParty({ ...party, recentlyAdded: true }));
    }

    this.refresh$.next();

    setTimeout(() => {
      const firstId = selected[0]?.partyId;
      if (firstId) {
        document.querySelector(`[data-party-id="${firstId}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  }

  // ── Party-level kebab actions ─────────────────────────────────────────────

  onViewDetails(party: Party): void {
    this.selectedParty = party;
    this.panelOpen = true;
    this.lockScroll();
  }

  onClosePanel(): void {
    this.panelOpen = false;
    this.unlockScroll();
    setTimeout(() => { if (!this.panelOpen) this.selectedParty = null; }, 300);
  }

  async onEditRole(party: Party): Promise<void> {
    const data: EditRoleDialogData = { party };
    const ref = this.dialogSvc.open(EditRoleDialogComponent, { data, width: '600px', maxWidth: '92vw' });
    const newRoles = await firstValueFrom(ref.afterClosed()) as PartyRole[] | null | undefined;
    if (!newRoles || newRoles.length === 0) return;
    await firstValueFrom(this.partiesSvc.updateOrphanParty(party.partyId, { roles: newRoles }));
    this.refresh$.next();
  }

  async onRemoveParty(party: Party): Promise<void> {
    const data: ConfirmDialogData = {
      title: 'Remove party from claim',
      message: `Are you sure you want to remove "${party.legalName}" from this claim?`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      confirmDanger: true,
    };
    const ref = this.dialogSvc.open(ConfirmDialogComponent, { data, width: '440px', maxWidth: '92vw' });
    const confirmed = await firstValueFrom(ref.afterClosed()) as boolean | undefined;
    if (!confirmed) return;
    await firstValueFrom(this.partiesSvc.removeOrphanParty(party.partyId));
    if (this.selectedParty?.partyId === party.partyId) this.onClosePanel();
    this.refresh$.next();
  }

  rolesDisplay(party: Party): string {
    return party.roles.map(r => PARTY_ROLE_LABELS[r]).join(', ');
  }

  private lockScroll(): void {
    if (this.scrollLocked) return;
    document.body.style.overflow = 'hidden';
    this.scrollLocked = true;
  }

  private unlockScroll(): void {
    if (!this.scrollLocked) return;
    document.body.style.overflow = '';
    this.scrollLocked = false;
  }

  trackByParty(_: number, p: Party): string { return p.partyId; }

  onBack(): void   { this.router.navigate(['/fnol/skeleton-create']); }
  onCancel(): void { this.router.navigate(['/dashboard']); }
  onNext(): void {
    this.fnolState.markStepComplete('skeleton-parties');
    this.router.navigate(['/fnol/skeleton-location']);
  }
}
