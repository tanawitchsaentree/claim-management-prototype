import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { KpiData } from '../../../core/models';

@Component({
  selector: 'app-kpi-row',
  standalone: true,
  imports: [CommonModule, NxIconModule],
  template: `
    <div class="kpi-row">
      <div class="kpi-tile kpi-tile--open">
        <span class="kpi-value">{{ data.openClaims }}</span>
        <span class="kpi-label">Open claims</span>
        <nx-icon name="product-board-paper-note" class="kpi-icon"></nx-icon>
      </div>
      <div class="kpi-tile kpi-tile--pending">
        <span class="kpi-value">{{ data.pendingApprovals }}</span>
        <span class="kpi-label">Pending approvals</span>
        <nx-icon name="product-check-paper" class="kpi-icon"></nx-icon>
      </div>
      <div class="kpi-tile kpi-tile--reserves" title="Claims with reserve delta > €50k in last 7 days — ⚑ PLACEHOLDER threshold">
        <span class="kpi-value">{{ data.bigReserveMovements }}</span>
        <span class="kpi-label">Big reserve movements</span>
        <nx-icon name="product-important-info" class="kpi-icon"></nx-icon>
      </div>
    </div>
  `,
  styles: [`
    .kpi-row {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
    }
    .kpi-tile {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 16px 20px;
      border-radius: 4px;
      border: 1px solid var(--ui-04);
      background: var(--ui-01);
      position: relative;
      overflow: hidden;
      cursor: pointer;
      transition: box-shadow 0.15s;
      &:hover { box-shadow: 0 2px 8px var(--claim-overlay-shadow, rgba(0,0,0,.1)); }
    }
    .kpi-value {
      font-size: 32px;
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
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 32px;
      // Tinted accent icon — clearly visible, not a ghost. Light hues (amber)
      // need more presence than blue, so 0.18 was too faint on white; 0.4
      // reads at a glance while staying secondary to the value. Each tile
      // tints its icon to match its left-accent colour (not all primary blue).
      opacity: 0.4;
    }
    .kpi-tile--open    { border-left: 4px solid var(--claim-status-open-color, #2e7d32);
      .kpi-icon { color: var(--claim-status-open-color, #2e7d32); } }
    .kpi-tile--pending { border-left: 4px solid var(--warning, #f9b233);
      .kpi-icon { color: var(--warning, #f9b233); } }
    .kpi-tile--reserves{ border-left: 4px solid var(--interactive-primary);
      .kpi-icon { color: var(--interactive-primary); } }

    @media (max-width: 1024px) {
      .kpi-row { flex-direction: column; }
    }
  `],
})
export class KpiRowComponent {
  @Input({ required: true }) data!: KpiData;
}
