import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxProgressbarModule } from '@allianz/ng-aquila/progressbar';
import { ProviderExpense } from '../../../core/models';

@Component({
  selector: 'app-expense-breakdown',
  standalone: true,
  imports: [CommonModule, NxProgressbarModule],
  template: `
    <div class="panel-card">
      <div class="exp-header">
        <span class="panel-card-title">Expense by Provider</span>
        <span class="exp-period">YTD 2026</span>
      </div>

      <div class="exp-list">
        @for (item of items; track item.category) {
          <div class="exp-row">
            <span class="exp-label">{{ item.label }}</span>
            <nx-progressbar
              class="exp-bar"
              [value]="item.amount"
              [max]="maxAmount()"
              [ariaLabel]="item.label">
            </nx-progressbar>
            <span class="exp-amount">{{ item.amount | number }} {{ item.currency }}</span>
          </div>
        }
      </div>

      <div class="exp-total">
        Total: <strong>{{ total() | number }} EUR</strong>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* Panel-card shell — ported from dashboard.scss (encapsulation blocks it
       from reaching this standalone component). Keep in sync with .panel-card. */
    .panel-card {
      background: var(--ui-01);
      border: 1px solid var(--ui-04);
      border-radius: 4px;
      padding: 16px;
    }
    .panel-card-title { font-size: 16px; font-weight: 600; color: var(--text-01); line-height: 1.4; }

    .exp-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
    .exp-period { font-size: var(--paragraph-04-font-size); color: var(--text-muted); }
    .exp-list { display: flex; flex-direction: column; gap: 10px; }
    .exp-row { display: flex; align-items: center; gap: 8px; }
    .exp-label { width: 110px; font-size: var(--paragraph-04-font-size); color: var(--text-01); flex-shrink: 0; }
    .exp-bar { flex: 1; }
    .exp-amount { font-size: var(--paragraph-04-font-size); color: var(--text-muted); width: 100px; text-align: right; flex-shrink: 0; }
    .exp-total { margin-top: 12px; font-size: var(--paragraph-04-font-size); color: var(--text-muted); border-top: 1px solid var(--ui-03); padding-top: 8px; }
  `],
})
export class ExpenseBreakdownComponent {
  @Input({ required: true }) items!: ProviderExpense[];
  total(): number { return this.items.reduce((s, i) => s + i.amount, 0); }
  maxAmount(): number { return Math.max(...this.items.map(i => i.amount), 1); }
}
