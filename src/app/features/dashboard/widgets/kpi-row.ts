import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';

import { NxCardModule } from '@allianz/ng-aquila/card';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { KpiData, KpiTile } from '../../../core/models';

// The KPI row of nx-card tiles (value, label, icon on the right). The KCM
// dashboard passes `data` (its three fixed tiles); other dashboards pass
// `tiles`. With `clickable`, each tile is a button that emits its key.
@Component({
  selector: 'app-kpi-row',
  standalone: true,
  imports: [NxCardModule, NxIconModule],
  template: `
    <div class="kpi-row" [attr.role]="ariaLabel ? 'group' : null" [attr.aria-label]="ariaLabel">
      @for (t of items; track t.key) {
        <nx-card
          class="kpi-tile"
          [attr.title]="t.hint ?? null"
          [attr.role]="clickable ? 'button' : null"
          [attr.tabindex]="clickable ? 0 : null"
          (click)="select(t.key)"
          (keydown.enter)="select(t.key)"
        >
          <span class="kpi-value">{{ t.value }}</span>
          <span class="kpi-label">{{ t.label }}</span>
          <nx-icon [name]="t.icon" class="kpi-icon"></nx-icon>
        </nx-card>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
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
      .kpi-tile:focus-visible {
        outline: 2px solid var(--interactive-primary);
        outline-offset: 2px;
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
  @Input() data?: KpiData;
  @Input() tiles?: KpiTile[];
  @Input() clickable = false;
  @Input() ariaLabel: string | null = null;
  @Output() readonly tileClick = new EventEmitter<string>();

  get items(): KpiTile[] {
    if (this.tiles) return this.tiles;
    const d = this.data;
    if (!d) return [];
    return [
      { key: 'open', value: d.openClaims, label: 'Open claims', icon: 'product-board-paper-note' },
      { key: 'approvals', value: d.pendingApprovals, label: 'Pending approvals', icon: 'product-check-paper' },
      {
        key: 'reserves',
        value: d.bigReserveMovements,
        label: 'Big reserve movements',
        icon: 'product-important-info',
        hint: 'Claims with reserve delta > €50k in last 7 days — ⚑ PLACEHOLDER threshold'
      }
    ];
  }

  select(key: string): void {
    if (this.clickable) this.tileClick.emit(key);
  }
}
