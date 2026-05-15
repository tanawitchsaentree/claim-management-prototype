import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, firstValueFrom, map, Observable, of, switchMap } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxPaginationModule } from '@allianz/ng-aquila/pagination';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxSwitcherModule } from '@allianz/ng-aquila/switcher';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { StatusChipComponent } from '../../../../shared/components/status-chip/status-chip.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FnolStateService } from '../../services/fnol-state.service';
import { MockPartiesService } from '../../../../core/mock/services/mock-parties.service';
import { Party, PartyClaim, PartySection, PartyRole, PARTY_ROLE_LABELS } from '../../../../core/models/party.model';
import { AddPartyModalComponent, AddPartyModalData } from '../../components/add-party-modal/add-party-modal.component';
import { PartyDetailPanelComponent } from '../../components/party-detail-panel/party-detail-panel.component';
import { EditRoleDialogComponent, EditRoleDialogData } from '../../components/edit-role-dialog/edit-role-dialog.component';
import { WizardFooterComponent } from '../../../../shared/components/wizard-footer/wizard-footer.component';

interface ClaimsVM {
  claims: PartyClaim[];
  loading: boolean;
  error: boolean;
}

@Component({
  selector: 'app-step-parties',
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
    NxCheckboxModule,
    NxPaginationModule,
    NxContextMenuModule,
    NxSwitcherModule,
    NxMessageModule,
    NxModalModule,
    StatusChipComponent,
    PartyDetailPanelComponent,
    WizardFooterComponent,
  ],
  templateUrl: './step-parties.component.html',
  styleUrl: './step-parties.component.scss',
})
export class StepPartiesComponent implements OnInit, OnDestroy {
  private readonly partiesSvc = inject(MockPartiesService);
  private readonly fnolState  = inject(FnolStateService);
  private readonly router     = inject(Router);
  private readonly dialogSvc  = inject(NxDialogService);

  policyNumber = '';

  page           = 1;
  claimsPerPage  = 2;

  displayBrokerHierarchy = false;

  // Selection state (visual cascade only — see docs/PARTIES_ASSUMPTIONS.md)
  readonly selectedClaimIds   = new Set<string>();
  readonly selectedSectionIds = new Set<string>();

  // Side panel state
  selectedParty: Party | null = null;
  panelOpen = false;
  private scrollLocked = false;

  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  vm$!: Observable<ClaimsVM>;

  ngOnInit(): void {
    if (!this.fnolState.selectedPolicy && !this.fnolState.selectedClient) {
      this.router.navigate(['/fnol/search']);
      return;
    }
    this.policyNumber = this.fnolState.selectedPolicy?.policyNumber ?? '';
    this.vm$ = this.refresh$.pipe(
      switchMap(() =>
        this.partiesSvc.getClaimsForPolicy(this.policyNumber).pipe(
          map(claims => ({ claims, loading: false, error: false })),
          catchError(() => of({ claims: [], loading: false, error: true })),
        ),
      ),
    );
  }

  ngOnDestroy(): void { this.unlockScroll(); }

  // ── Pagination ────────────────────────────────────────────────────────────

  pagedClaims(claims: PartyClaim[]): PartyClaim[] {
    const start = (this.page - 1) * this.claimsPerPage;
    return claims.slice(start, start + this.claimsPerPage);
  }

  totalParties(claims: PartyClaim[]): number {
    return claims.reduce((sum, c) =>
      sum + c.directParties.length + c.sections.reduce((s, sec) => s + sec.parties.length, 0), 0);
  }

  // ── Expand / collapse ────────────────────────────────────────────────────

  toggleClaim(claim: PartyClaim): void   { claim.expanded = !claim.expanded; }
  toggleSection(section: PartySection): void { section.expanded = !section.expanded; }

  // ── Selection cascade (visual only) ──────────────────────────────────────

  isClaimChecked(claim: PartyClaim): boolean {
    return this.selectedClaimIds.has(claim.claimId);
  }

  isClaimIndeterminate(claim: PartyClaim): boolean {
    if (this.selectedClaimIds.has(claim.claimId)) return false;
    return claim.sections.some(s => this.selectedSectionIds.has(s.sectionId));
  }

  isSectionChecked(section: PartySection): boolean {
    return this.selectedSectionIds.has(section.sectionId);
  }

  toggleClaimSelection(claim: PartyClaim): void {
    if (this.selectedClaimIds.has(claim.claimId)) {
      this.selectedClaimIds.delete(claim.claimId);
      claim.sections.forEach(s => this.selectedSectionIds.delete(s.sectionId));
    } else {
      this.selectedClaimIds.add(claim.claimId);
      claim.sections.forEach(s => this.selectedSectionIds.add(s.sectionId));
    }
  }

  toggleSectionSelection(section: PartySection, claim: PartyClaim): void {
    if (this.selectedSectionIds.has(section.sectionId)) {
      this.selectedSectionIds.delete(section.sectionId);
      this.selectedClaimIds.delete(claim.claimId);
    } else {
      this.selectedSectionIds.add(section.sectionId);
      if (claim.sections.every(s => this.selectedSectionIds.has(s.sectionId))) {
        this.selectedClaimIds.add(claim.claimId);
      }
    }
  }

  // ── Add additional parties — 3 entry points ───────────────────────────────

  async onAddPartiesToToolbar(claims: PartyClaim[]): Promise<void> {
    const firstClaim = claims[0];
    if (firstClaim) await this.openAddPartyModal(claims, firstClaim.claimId);
  }

  async onAddPartiesToClaim(claims: PartyClaim[], claim: PartyClaim): Promise<void> {
    await this.openAddPartyModal(claims, claim.claimId);
  }

  async onAddPartiesToSection(claims: PartyClaim[], section: PartySection, claim: PartyClaim): Promise<void> {
    await this.openAddPartyModal(claims, claim.claimId, section.sectionId);
  }

  private async openAddPartyModal(
    claims: PartyClaim[],
    targetClaimId: string,
    targetSectionId?: string,
  ): Promise<void> {
    const existingIds = new Set(
      claims.flatMap(c => [
        ...c.directParties.map(p => p.partyId),
        ...c.sections.flatMap(s => s.parties.map(p => p.partyId)),
      ]),
    );

    const modalData: AddPartyModalData = {
      policyNumber: this.policyNumber,
      existingPartyIds: existingIds,
      targetClaimId,
      targetSectionId,
    };

    const ref = this.dialogSvc.open(AddPartyModalComponent, { data: modalData, width: '960px' });
    const selected = await firstValueFrom(ref.afterClosed()) as Party[] | undefined;
    if (!selected || selected.length === 0) return;

    for (const party of selected) {
      await firstValueFrom(
        this.partiesSvc.addParty(this.policyNumber, { ...party, recentlyAdded: true }, targetClaimId, targetSectionId),
      );
    }

    this.page = 1;
    this.refresh$.next();

    setTimeout(() => {
      const firstId = selected[0]?.partyId;
      if (firstId) {
        document.querySelector(`[data-party-id="${firstId}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  }

  // ── Party-level kebab actions (Phase 5, unchanged) ────────────────────────

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
    const ref = this.dialogSvc.open(EditRoleDialogComponent, { data, width: '480px' });
    const newRoles = await firstValueFrom(ref.afterClosed()) as PartyRole[] | null | undefined;
    if (!newRoles || newRoles.length === 0) return;
    await firstValueFrom(this.partiesSvc.updateParty(this.policyNumber, party.partyId, { roles: newRoles }));
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
    const ref = this.dialogSvc.open(ConfirmDialogComponent, { data, width: '480px' });
    const confirmed = await firstValueFrom(ref.afterClosed()) as boolean | undefined;
    if (!confirmed) return;
    await firstValueFrom(this.partiesSvc.removeParty(this.policyNumber, party.partyId));
    if (this.selectedParty?.partyId === party.partyId) this.onClosePanel();
    this.page = 1;
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

  // ── TrackBy helpers ───────────────────────────────────────────────────────

  trackByClaim(_: number, c: PartyClaim): string  { return c.claimId; }
  trackBySection(_: number, s: PartySection): string { return s.sectionId; }
  trackByParty(_: number, p: Party): string       { return p.partyId; }

  onBack(): void   { this.router.navigate(['/fnol/entities-damages']); }
  onCancel(): void { this.router.navigate(['/dashboard']); }
  onNext(): void {
    this.fnolState.markStepComplete('parties');
    this.router.navigate(['/fnol/reserves']);
  }
}
