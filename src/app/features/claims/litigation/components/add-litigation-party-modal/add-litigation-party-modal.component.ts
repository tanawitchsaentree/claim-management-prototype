import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxPaginationModule } from '@allianz/ng-aquila/pagination';
import { MockPartiesService } from '../../../../../core/mock/services/mock-parties.service';
import { StatusChipComponent } from '../../../../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import {
  Party, PartyRole, ClearanceStatus, PARTY_ROLE_LABELS, CLEARANCE_STATUS_LABELS,
} from '../../../../../core/models/party.model';

export type LitigationPartyKind = 'plaintiff' | 'defendant' | 'attorney' | 'opposing-lawyer';

export interface AddLitigationPartyModalData {
  kind: LitigationPartyKind;
}

const KIND_TITLE: Record<LitigationPartyKind, string> = {
  'plaintiff':       'Add plaintiff',
  'defendant':       'Add defendant',
  'attorney':        'Add attorney',
  'opposing-lawyer': 'Add opposing lawyer/law firm',
};

// Roles surfaced for each modal context. Drives MockPartiesService filtering
// so we only show realistic candidates per kind.
const KIND_ROLES: Record<LitigationPartyKind, PartyRole[]> = {
  'plaintiff':       ['client', 'insured', 'claimant'],
  'defendant':       ['third-party', 'claimant'],
  'attorney':        ['expert'],
  'opposing-lawyer': ['expert', 'third-party'],
};

const CLEARANCE_CHIP: Record<ClearanceStatus, string> = {
  'cleared':        'closed',
  'not-cleared':    'rejected',
  'pending':        'in-progress',
  'not-applicable': 'open',
};

const PAGE_SIZE = 5;

@Component({
  selector: 'app-add-litigation-party-modal',
  standalone: true,
  imports: [
    CommonModule,
    NxModalModule,
    NxButtonModule,
    NxIconModule,
    NxTableModule,
    NxCheckboxModule,
    NxPaginationModule,
    StatusChipComponent,
    EmptyStateComponent,
  ],
  templateUrl: './add-litigation-party-modal.component.html',
  styleUrl: './add-litigation-party-modal.component.scss',
})
export class AddLitigationPartyModalComponent {
  readonly data = inject<AddLitigationPartyModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<AddLitigationPartyModalComponent, Party | null>>(NxModalRef);
  private readonly partiesSvc = inject(MockPartiesService);

  readonly title = KIND_TITLE[this.data.kind];
  readonly roleLabels = PARTY_ROLE_LABELS;
  readonly clearanceLabels = CLEARANCE_STATUS_LABELS;

  readonly rows = signal<Party[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly page = signal(1);
  readonly pageSize = PAGE_SIZE;

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.rows().length / PAGE_SIZE)));
  readonly visibleRows = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.rows().slice(start, start + PAGE_SIZE);
  });

  constructor() {
    this.load();
  }

  private load(): void {
    const allowedRoles = new Set(KIND_ROLES[this.data.kind]);
    this.partiesSvc.searchAll({}).subscribe(all => {
      const filtered = all.filter(p => p.roles.some(r => allowedRoles.has(r)));
      this.rows.set(filtered);
      this.page.set(1);
    });
  }

  rolesDisplay(party: Party): string {
    return party.roles.map(r => this.roleLabels[r]).join(', ');
  }

  clearanceChip(status: ClearanceStatus): string { return CLEARANCE_CHIP[status]; }

  select(partyId: string): void {
    this.selectedId.update(prev => prev === partyId ? null : partyId);
  }

  isSelected(partyId: string): boolean { return this.selectedId() === partyId; }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
  }

  onCancel(): void { this.modalRef.close(null); }

  onAdd(): void {
    const id = this.selectedId();
    if (!id) return;
    const found = this.rows().find(p => p.partyId === id) ?? null;
    this.modalRef.close(found);
  }
}
