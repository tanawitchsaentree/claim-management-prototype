import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
import { Navbar } from '../../layout/navbar/navbar';
import { BreadcrumbItem } from '../../../shared/components/page-shell/page-shell.component';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { ClaimPreviewDirective } from '../../../shared/directives/claim-preview.directive';
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
    StatusChipComponent,
    ClaimPreviewDirective,
  ],
  templateUrl: './claims-list.component.html',
  styleUrl: './claims-list.component.scss',
})
export class ClaimsListComponent {
  private readonly svc = inject(MockClaimService);

  readonly all      = signal<Claim[]>([]);
  readonly loading  = signal(true);
  readonly page     = signal(1);
  readonly pageSize = PAGE_SIZE;

  readonly breadcrumb: BreadcrumbItem[] = [
    { label: 'Claims' },
  ];

  readonly statuses: ClaimStatus[] = [
    'Open', 'In progress', 'Priced', 'Quoted', 'Bound', 'Declined', 'Closed', 'Reopened',
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

  constructor() {
    this.load();
  }

  private async load(filter?: ClaimFilter): Promise<void> {
    this.loading.set(true);
    const data = await firstValueFrom(this.svc.getAll(filter));
    this.all.set(data);
    this.loading.set(false);
    this.page.set(1);
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
