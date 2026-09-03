import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxTabsModule } from '@allianz/ng-aquila/tabs';
import { PageShellComponent, BreadcrumbItem } from '../../../shared/components/page-shell/page-shell.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { ClaimPreviewDirective } from '../../../shared/directives/claim-preview.directive';
import { MockLossEventService } from '../../../core/mock/services/mock-loss-event.service';
import { LossEventGeneralInfoComponent } from '../loss-event-general-info/loss-event-general-info.component';

/**
 * Loss Event Overview. Replaces the BMPCC-FNOL-SUMMARY placeholder (2026-05-27)
 * that listed three hardcoded `CL-2025-00x` rows and nothing else.
 *
 * Structure follows the production claims-management-loss-overview MFE —
 * Overview / Financial overview / Documents tabs, a General information card,
 * a Related claims table and a Parties table — with two deliberate differences:
 * upstream renders its Financial and Documents tabs as placeholder paragraphs
 * ("… will be displayed here when available"), and hosts Parties as an embedded
 * `wc-cc-party-embedded` web component we have no equivalent of. Both are real
 * tables here, fed from claims.json / parties.json / claim-documents.json.
 *
 * Reached from: loss-events-list, the claims-portfolio dashboard widget, and
 * FNOL step-summary when one submission derives more than one claim.
 */
@Component({
  selector: 'app-loss-event-overview',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NxButtonModule,
    NxIconModule,
    NxMessageModule,
    NxTableModule,
    NxTabsModule,
    PageShellComponent,
    EmptyStateComponent,
    StatusChipComponent,
    ClaimPreviewDirective,
    LossEventGeneralInfoComponent,
  ],
  templateUrl: './loss-event-overview.component.html',
  styleUrl: './loss-event-overview.component.scss',
})
export class LossEventOverviewComponent {
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly lossEventSvc = inject(MockLossEventService);

  readonly lossEventId = toSignal(
    this.route.paramMap.pipe(map(p => p.get('id') ?? '—')),
    { initialValue: '—' },
  );

  /** undefined = still loading, null = no such loss event. */
  readonly overview = toSignal(
    this.route.paramMap.pipe(switchMap(p => this.lossEventSvc.getOverview(p.get('id') ?? ''))),
    { initialValue: undefined },
  );

  readonly loading  = computed(() => this.overview() === undefined);
  readonly notFound = computed(() => this.overview() === null);

  readonly breadcrumb: BreadcrumbItem[] = [
    { label: 'Loss events', route: '/loss-events' },
    { label: 'Loss event overview' },
  ];

  openClaim(claimId: string): void {
    this.router.navigate(['/claims', claimId, 'overview']);
  }

  /** Rounded to whole KB/MB — a byte-exact file size is noise in a table. */
  fileSize(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  }
}
