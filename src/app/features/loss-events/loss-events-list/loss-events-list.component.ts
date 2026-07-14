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
import { NxBreadcrumbModule } from '@allianz/ng-aquila/breadcrumb';
import { NxGridModule } from '@allianz/ng-aquila/grid';
import { Navbar } from '../../layout/navbar/navbar';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { LossEventSummary } from '../../../core/models/dashboard-extended.model';
import { MockDashboardExtendedService } from '../../../core/mock/services/mock-dashboard-extended.service';

type LossEventStatus = LossEventSummary['status'];

const PAGE_SIZE = 15;

@Component({
  selector: 'app-loss-events-list',
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
    NxBreadcrumbModule,
    NxGridModule,
    StatusChipComponent,
  ],
  templateUrl: './loss-events-list.component.html',
  styleUrl: './loss-events-list.component.scss',
})
export class LossEventsListComponent {
  private readonly svc = inject(MockDashboardExtendedService);

  readonly all     = signal<LossEventSummary[]>([]);
  readonly loading = signal(true);
  readonly page    = signal(1);
  readonly pageSize = PAGE_SIZE;

  readonly statuses: LossEventStatus[] = ['Open', 'Monitoring', 'Closed'];

  readonly linesOfBusiness: string[] = [
    'Property', 'Liability', 'Marine', 'Cyber', 'Engineering',
  ];

  readonly filterForm = new FormGroup({
    search:         new FormControl(''),
    status:         new FormControl<LossEventStatus | null>(null),
    lineOfBusiness: new FormControl<string | null>(null),
  });

  readonly total     = computed(() => this.all().length);
  readonly pagedRows = computed<LossEventSummary[]>(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.all().slice(start, start + this.pageSize);
  });

  constructor() { this.load(); }

  private async load(search?: string, status?: LossEventStatus | null, lob?: string | null): Promise<void> {
    this.loading.set(true);
    let data = await firstValueFrom(this.svc.getLossEvents());
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(e =>
        e.lossEventId.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.oe.toLowerCase().includes(q),
      );
    }
    if (status) data = data.filter(e => e.status === status);
    if (lob)    data = data.filter(e => e.lineOfBusiness === lob);
    this.all.set(data);
    this.loading.set(false);
    this.page.set(1);
  }

  onFilter(): void {
    const v = this.filterForm.getRawValue();
    this.load(v.search ?? undefined, v.status, v.lineOfBusiness);
  }

  onReset(): void {
    this.filterForm.reset({ search: '', status: null, lineOfBusiness: null });
    this.load();
  }
}
