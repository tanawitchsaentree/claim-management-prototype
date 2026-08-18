import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { MockProviderService } from '../../../core/mock/services/mock-provider.service';
import { ProviderAssignment, ProviderAssignmentStatus, ProviderType } from '../../../core/models/provider-assignment.model';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';

const TYPE_LABEL: Record<ProviderType, string> = {
  adjuster: 'Adjuster',
  legal:    'Legal',
  expert:   'Expert',
  other:    'Other',
};

@Component({
  selector: 'app-provider-management',
  standalone: true,
  imports: [
    CommonModule,
    NxTableModule,
    StatusChipComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    AppDatePipe,
  ],
  templateUrl: './provider-management.component.html',
  styleUrl: './provider-management.component.scss',
})
export class ProviderManagementComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly svc   = inject(MockProviderService);

  readonly rows          = signal<ProviderAssignment[]>([]);
  readonly loading       = signal(true);
  // Optional ?sectionId= query param — set when arriving from a section's
  // "Instruct provider" action, so that section's assignment can be highlighted.
  readonly highlightSectionId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const claimId = this.route.snapshot.paramMap.get('id')
      ?? this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.highlightSectionId.set(this.route.snapshot.queryParamMap.get('sectionId'));

    this.loading.set(true);
    const data = await firstValueFrom(this.svc.search({ claimId }));
    this.rows.set(data);
    this.loading.set(false);
  }

  typeLabel(t: ProviderType): string { return TYPE_LABEL[t]; }

  chipStatus(s: ProviderAssignmentStatus): string { return s.toLowerCase(); }

  isHighlighted(row: ProviderAssignment): boolean {
    return !!this.highlightSectionId() && row.sectionId === this.highlightSectionId();
  }
}
