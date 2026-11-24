import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NxBadgeModule } from '@allianz/ng-aquila/badge';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxCardModule } from '@allianz/ng-aquila/card';
import { NxDataDisplayModule } from '@allianz/ng-aquila/data-display';
import { NxEyebrowModule } from '@allianz/ng-aquila/eyebrow';
import { NxHeadlineModule } from '@allianz/ng-aquila/headline';
import { NxLinkModule } from '@allianz/ng-aquila/link';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxSurface } from '@allianz/ng-aquila/surface';
import {
  NxToggleButtonComponent,
  NxToggleButtonGroupComponent
} from '@allianz/ng-aquila/toggle-button';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { ThemeService } from '../../../core/services/theme.service';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { CircumstanceLabelPipe } from '../../../shared/pipes/circumstance-label.pipe';

type MoneyView = 'reserve' | 'payments' | 'recoveries';

/**
 * Test page (2026-11-24): the Claim overview's first cards rebuilt only from
 * A1 building blocks, to show what "A1 native" means next to "NDBX screens
 * repainted in A1". Every visual piece is a library component, nothing is
 * drawn by hand:
 *   page title      nxEyebrow + nxHeadline (was our own h1 + role badge)
 *   status          nx-badge type (was our status chip)
 *   field pairs     nx-data-display (was our own label/value CSS in 28 files)
 *   links           nx-link (was a styled <a>)
 *   card            nx-card on an nxSurface="emphasis" page (A1 surfaces),
 *                   title nxHeadline xl = ~22px in compact (CHAMP spec, Case Manager page)
 *   money view      nx-toggle-button-group (A1-only component)
 * Same data as /claims/CLM-2024-001/overview (MockClaimOverviewService).
 * Meant for the 'A1 compact (CHAMP target)' theme; the banner offers the switch.
 */
@Component({
  selector: 'app-a1-native',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    AsyncPipe,
    CurrencyPipe,
    ReactiveFormsModule,
    RouterLink,
    NxBadgeModule,
    NxButtonModule,
    NxCardModule,
    NxDataDisplayModule,
    NxEyebrowModule,
    NxHeadlineModule,
    NxLinkModule,
    NxMessageModule,
    NxSurface,
    NxToggleButtonGroupComponent,
    NxToggleButtonComponent,
    AppDatePipe,
    CircumstanceLabelPipe
  ],
  templateUrl: './a1-native.component.html',
  styleUrl: './a1-native.component.scss'
})
export class A1NativeComponent {
  readonly claimId = 'CLM-2024-001';
  readonly theme = inject(ThemeService);
  readonly overview$ = inject(MockClaimOverviewService).getOverview(this.claimId);
  readonly moneyView = new FormControl<MoneyView>('reserve', { nonNullable: true });

  /** A1 badge signal type for a claim or risk status. */
  badgeType(status: string): 'info' | 'positive' | 'warning' | 'critical' {
    const s = status.toLowerCase();
    if (s.includes('high') || s.includes('reject')) return 'critical';
    if (s.includes('medium') || s.includes('pending')) return 'warning';
    if (s.includes('low') || s.includes('closed')) return 'positive';
    return 'info';
  }
}
