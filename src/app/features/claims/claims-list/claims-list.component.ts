import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxPaginationModule } from '@allianz/ng-aquila/pagination';
import { NxBadgeModule } from '@allianz/ng-aquila/badge';
import { NxBreadcrumbModule } from '@allianz/ng-aquila/breadcrumb';
import { NxGridModule } from '@allianz/ng-aquila/grid';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { Navbar } from '../../layout/navbar/navbar';
import { BreadcrumbItem } from '../../../shared/components/page-shell/page-shell.component';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ClaimPreviewDirective } from '../../../shared/directives/claim-preview.directive';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { AuthService } from '../../../core/services/auth';
import {
  ReassignClaimModalComponent,
  ReassignClaimModalData,
  ReassignClaimModalResult,
} from '../../../shared/components/reassign-claim-modal/reassign-claim-modal.component';
import { Claim, ClaimStatus, LineOfBusiness, Priority } from '../../../core/models';
import { MockClaimService, ClaimFilter } from '../../../core/mock/services/mock-claim.service';

const PAGE_SIZE = 15;

@Component({
  selector: 'app-claims-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    Navbar,
    NxIconModule,
    NxButtonModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule,
    NxTableModule,
    NxPaginationModule,
    NxBadgeModule,
    NxBreadcrumbModule,
    NxGridModule,
    NxCheckboxModule,
    StatusChipComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    ClaimPreviewDirective,
  ],
  templateUrl: './claims-list.component.html',
  styleUrl: './claims-list.component.scss',
})
export class ClaimsListComponent {
  private readonly svc      = inject(MockClaimService);
  private readonly dialogSvc = inject(NxDialogService);
  private readonly toast     = inject(ToastService);
  private readonly auth      = inject(AuthService);
  private readonly route     = inject(ActivatedRoute);
  protected readonly router = inject(Router);

  readonly all      = signal<Claim[]>([]);
  readonly loading  = signal(true);
  readonly page     = signal(1);
  readonly pageSize = PAGE_SIZE;
  readonly selected = signal<Set<string>>(new Set());

  readonly breadcrumb: BreadcrumbItem[] = [
    { label: 'Claims' },
  ];

  readonly statuses: ClaimStatus[] = [
    'Open', 'In progress', 'Priced', 'Quoted', 'Bound', 'Declined', 'Closed',
  ];

  readonly linesOfBusiness: LineOfBusiness[] = [
    'Property', 'Liability', 'Marine', 'Cyber', 'Engineering',
  ];

  readonly priorities: Priority[] = ['high', 'medium', 'low'];

  readonly filterForm = new FormGroup({
    search:          new FormControl(''),
    status:          new FormControl<ClaimStatus | null>(null),
    lineOfBusiness:  new FormControl<LineOfBusiness | null>(null),
    priority:        new FormControl<Priority | null>(null),
  });

  readonly total     = computed(() => this.all().length);
  readonly pagedRows = computed<Claim[]>(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.all().slice(start, start + this.pageSize);
  });

  readonly selectedCount     = computed(() => this.selected().size);
  readonly isAllPageSelected = computed(() => {
    const rows = this.pagedRows();
    return rows.length > 0 && rows.every(c => this.selected().has(c.claimId));
  });

  // Set when the page is opened via "?assignee=me" (e.g. from the dashboard's "My claims" widget)
  // so the list lands pre-filtered to the same scope instead of the generic unfiltered list.
  readonly quickFilterMine = signal(false);

  constructor() {
    if (this.route.snapshot.queryParamMap.get('assignee') === 'me') {
      this.quickFilterMine.set(true);
    }
    this.load();
  }

  private lastFilter?: ClaimFilter;

  private async load(filter?: ClaimFilter): Promise<void> {
    if (this.quickFilterMine()) {
      filter = { ...filter, assignee: this.auth.user()?.name };
    }
    this.lastFilter = filter;
    this.loading.set(true);
    const data = await firstValueFrom(this.svc.getAll(filter));
    this.all.set(data);
    this.loading.set(false);
    this.page.set(1);
    this.selected.set(new Set());
  }

  onFilter(): void {
    const v = this.filterForm.getRawValue();
    this.load({
      search:         v.search         || undefined,
      status:         v.status         ?? undefined,
      lineOfBusiness: v.lineOfBusiness ?? undefined,
      priority:       v.priority       ?? undefined,
    });
  }

  onReset(): void {
    this.filterForm.reset({ search: '', status: null, lineOfBusiness: null, priority: null });
    this.load();
  }

  clearQuickFilter(): void {
    this.quickFilterMine.set(false);
    this.load();
  }

  // ── Bulk reassignment (single claim = select 1; multiple = select several) ──
  isSelected(claimId: string): boolean {
    return this.selected().has(claimId);
  }

  toggleSelect(claimId: string): void {
    this.selected.update(set => {
      const next = new Set(set);
      next.has(claimId) ? next.delete(claimId) : next.add(claimId);
      return next;
    });
  }

  toggleSelectAllOnPage(): void {
    const rows = this.pagedRows();
    const allSelected = this.isAllPageSelected();
    this.selected.update(set => {
      const next = new Set(set);
      rows.forEach(c => allSelected ? next.delete(c.claimId) : next.add(c.claimId));
      return next;
    });
  }

  clearSelection(): void {
    this.selected.set(new Set());
  }

  selectAllMatching(): void {
    this.selected.set(new Set(this.all().map(c => c.claimId)));
  }

  async openBulkReassign(): Promise<void> {
    const claimIds = Array.from(this.selected());
    if (claimIds.length === 0) return;
    const byId = new Map(this.all().map(c => [c.claimId, c]));
    const claims = claimIds.map(id => {
      const c = byId.get(id);
      return { claimId: id, clientName: c?.clientName ?? '–', currentHandler: c?.assignee };
    });
    const ref = this.dialogSvc.open(ReassignClaimModalComponent, {
      data: { claimIds, claims } satisfies ReassignClaimModalData,
      width: '480px',
      maxWidth: '92vw',
    });
    const result = await firstValueFrom(ref.afterClosed()) as ReassignClaimModalResult | null | undefined;
    if (!result) return;
    await Promise.all(claimIds.map(id => firstValueFrom(this.svc.update(id, { assignee: result.handlerName }))));
    this.toast.success(
      claimIds.length === 1 ? 'Claim reassigned' : `${claimIds.length} claims reassigned`,
      `Now assigned to ${result.handlerName}`
    );
    await this.load(this.lastFilter);
  }

  isDormant(dateUpdated: string): boolean {
    const diff = (Date.now() - new Date(dateUpdated).getTime()) / 86_400_000;
    return diff > 30;
  }

  daysSince(dateUpdated: string): number {
    return Math.floor((Date.now() - new Date(dateUpdated).getTime()) / 86_400_000);
  }

  priorityLabel(p: Priority): string {
    return p.charAt(0).toUpperCase() + p.slice(1);
  }
}
