import { Component, Input } from '@angular/core';

import { NxCardModule } from '@allianz/ng-aquila/card';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { KpiData } from '../../../core/models';

@Component({
  selector: 'app-kpi-row',
  standalone: true,
  imports: [NxCardModule, NxIconModule],
  template: `
    <div class="kpi-row">
      <nx-card class="kpi-tile">
        <span class="kpi-value">{{ data.openClaims }}</span>
        <span class="kpi-label">Open claims</span>
        <nx-icon name="product-board-paper-note" class="kpi-icon"></nx-icon>
      </nx-card>
      <nx-card class="kpi-tile">
        <span class="kpi-value">{{ data.pendingApprovals }}</span>
        <span class="kpi-label">Pending approvals</span>
        <nx-icon name="product-check-paper" class="kpi-icon"></nx-icon>
      </nx-card>
      <nx-card
        class="kpi-tile"
        title="Claims with reserve delta > €50k in last 7 days — ⚑ PLACEHOLDER threshold"
      >
        <span class="kpi-value">{{ data.bigReserveMovements }}</span>
        <span class="kpi-label">Big reserve movements</span>
        <nx-icon name="product-important-info" class="kpi-icon"></nx-icon>
      </nx-card>
    </div>
  `,
  styles: [
    `
      .kpi-row {
        display: flex;
        gap: var(--space-base);
        margin-bottom: var(--space-base);
      }
      .kpi-tile {
        flex: 1;
        position: relative;
        cursor: pointer;
      }
      .kpi-value,
      .kpi-label {
        display: block;
      }
      .kpi-value {
        font-size: var(--display-l-font-size);
        font-weight: 700;
        color: var(--text-01);
        line-height: 1;
      }
      .kpi-label {
        font-size: var(--paragraph-04-font-size);
        color: var(--text-muted);
      }
      .kpi-icon {
        position: absolute;
        right: var(--space-base);
        top: 50%;
        transform: translateY(-50%);
        font-size: 32px;
        color: var(--text-muted);
      }

      @media (max-width: 1024px) {
        .kpi-row {
          flex-direction: column;
        }
      }
    `
  ]
})
export class KpiRowComponent {
  @Input({ required: true }) data!: KpiData;
}
