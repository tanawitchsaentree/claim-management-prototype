import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { PageShellComponent, BreadcrumbItem } from '../../../shared/components/page-shell/page-shell.component';
import { ClaimPreviewDirective } from '../../../shared/directives/claim-preview.directive';

interface DerivedClaim {
  claimId: string;
  damageTypes: string[];
  sectionCount: number;
  totalReserve: number;
  currency: string;
}

// BMPCC-FNOL-SUMMARY (2026-05-27): placeholder Loss Event Overview rendered
// when an FNOL submission produces >1 derived claim. The real screen will be
// designed by Product; this stub lists the derived claims and links into each
// claim's overview so demo flow is testable end-to-end.
@Component({
  selector: 'app-loss-event-overview',
  standalone: true,
  imports: [
    CommonModule,
    NxButtonModule,
    NxIconModule,
    NxMessageModule,
    PageShellComponent,
    ClaimPreviewDirective,
  ],
  templateUrl: './loss-event-overview.component.html',
  styleUrl: './loss-event-overview.component.scss',
})
export class LossEventOverviewComponent {
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly lossEventId = toSignal(
    this.route.paramMap.pipe(map(p => p.get('id') ?? '—')),
    { initialValue: '—' },
  );

  readonly derivedClaims: DerivedClaim[] = [
    { claimId: 'CL-2025-001', damageTypes: ['Building'],   sectionCount: 2, totalReserve: 45_000, currency: 'EUR' },
    { claimId: 'CL-2025-002', damageTypes: ['Contents'],   sectionCount: 1, totalReserve: 18_500, currency: 'EUR' },
    { claimId: 'CL-2025-003', damageTypes: ['Liability'],  sectionCount: 1, totalReserve: 12_000, currency: 'EUR' },
  ];

  readonly breadcrumb: BreadcrumbItem[] = [
    { label: 'Dashboard', route: '/dashboard' },
    { label: 'Loss event' },
  ];

  openClaim(claimId: string): void {
    this.router.navigate(['/claims', claimId, 'overview']);
  }
}
