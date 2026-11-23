import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { EmptyStateComponent } from '../../../../../../shared/components/empty-state/empty-state.component';
import {
  hasIndemnityReserve,
  Reserve,
  ReservesPolicyData
} from '../../../../../../core/models/reserve.model';
import { ReserveClaim } from '../../../../services/reserve-claims.service';
import { ReserveNarrativePanelComponent } from '../reserve-narrative-panel/reserve-narrative-panel.component';
import { ReserveListComponent } from '../reserve-list/reserve-list.component';

/**
 * One claim on the Reserves step. Production stacks one card per claim the
 * FNOL creates (claim number heading, then Policy ID / Total reserve /
 * Allianz share, ReservesPage.ts getPolicyId), each needing its own reserve
 * or narrative. DESIGN DECISION RES-D1: claims only get their number at
 * Submit in this prototype, so the heading is "Claim 1", "Claim 2".
 */
@Component({
  selector: 'app-reserve-claim-card',
  standalone: true,
  imports: [
    DecimalPipe,
    NxButtonModule,
    NxIconModule,
    NxMessageModule,
    EmptyStateComponent,
    ReserveNarrativePanelComponent,
    ReserveListComponent
  ],
  templateUrl: './reserve-claim-card.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './reserve-claim-card.component.scss'
})
export class ReserveClaimCardComponent {
  @Input({ required: true }) claim!: ReserveClaim;
  @Input({ required: true }) data!: ReservesPolicyData;
  // Set after Next found this claim with no indemnity reserve and no explanation.
  @Input() flagged = false;

  @Output() addReserve = new EventEmitter<void>();
  @Output() editLine = new EventEmitter<Reserve>();
  @Output() removeLine = new EventEmitter<Reserve>();
  @Output() narrativeSaved = new EventEmitter<void>();

  get indemnityTotal(): number {
    return hasIndemnityReserve(this.data)
      ? this.data.reserves.reduce((s, r) => s + (r.subAmounts?.indemnity ?? 0), 0)
      : 0;
  }

  get allianzReserves(): number {
    return (this.data.totalReserve * this.data.allianzShare) / 100;
  }
}
