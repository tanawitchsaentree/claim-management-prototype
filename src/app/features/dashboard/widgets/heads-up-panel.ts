import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { HeadsUpItem } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

const SEVERITY_ICON: Record<string, string> = {
  info:     'product-important-info',
  warning:  'exclamation-triangle-o',
  critical: 'exclamation-circle-o',
};

@Component({
  selector: 'app-heads-up-panel',
  standalone: true,
  imports: [CommonModule, NxIconModule, RouterLink, EmptyStateComponent],
  template: `
    <div class="widget-card">
      <div class="widget-header">
        <div class="widget-header-left">
          <div class="widget-icon-wrap">
            <nx-icon name="product-important-info" class="widget-icon"></nx-icon>
          </div>
          <span class="widget-title">Heads-up: Monitored Claims</span>
        </div>
      </div>

      @if (items.length === 0) {
        <app-empty-state message="No claims currently under monitoring."></app-empty-state>
      } @else {
        <div class="hu-list">
          @for (item of items; track item.id) {
            <div class="hu-row" [class]="'hu-row--' + item.severity">
              <nx-icon [name]="severityIcon(item.severity)" class="hu-severity-icon" [class]="'hu-icon--' + item.severity"></nx-icon>
              <div class="hu-body">
                <div class="hu-claim-line">
                  <span class="hu-claim-id">{{ item.claimId }}</span>
                  <span class="hu-client">{{ item.clientName }}</span>
                </div>
                <div class="hu-reason">{{ item.reason }}</div>
                <div class="hu-meta">Last update: {{ item.lastUpdate }}</div>
              </div>
              <div class="hu-right">
                <span class="hu-status-text">{{ item.status }}</span>
                <a [routerLink]="['/claims', item.claimId, 'overview']" class="hu-review-link">Review</a>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* Widget shell — ported from dashboard.scss so this standalone component
       matches its inline sibling widgets (encapsulation blocks dashboard.scss
       from reaching here). Keep values in sync with .widget-* there. */
    .widget-card {
      background: var(--ui-01);
      border: 1px solid var(--ui-04);
      border-radius: 8px;
      margin-bottom: 24px;          /* $sp-xl — same gap as sibling widgets */
      overflow: hidden;
      box-shadow: 0 1px 4px var(--claim-overlay-shadow);
    }
    .widget-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px 12px;      /* $sp-lg $sp-xl $sp-md */
    }
    .widget-header-left { display: flex; align-items: center; gap: 10px; }
    .widget-icon-wrap {
      width: 32px; height: 32px;
      border: 1px solid var(--ui-04);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .widget-icon { color: var(--text-01); font-size: 16px; }
    .widget-title { font-size: 20px; font-weight: 600; color: var(--text-01); line-height: 1.4; }

    .hu-list { padding: 0 0 8px; }
    .hu-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 24px;
      border-bottom: 1px solid var(--ui-03);
      &:last-child { border-bottom: none; }
      // No row tint — the severity icon colour already signals critical/warning.
      // (No-row-tint rule: state goes on the badge/icon, never the row background.)
    }
    .hu-severity-icon { font-size: 18px; margin-top: 2px; flex-shrink: 0; }
    .hu-icon--critical { color: var(--danger, #c0392b); }
    .hu-icon--warning  { color: var(--warning, #f9b233); }
    .hu-icon--info     { color: var(--interactive-primary); }
    .hu-body { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .hu-claim-line { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .hu-claim-id { font-weight: 600; font-size: 13px; color: var(--interactive-text); }
    .hu-client { font-size: 14px; color: var(--text-01); font-weight: 500; }
    .hu-reason { font-size: 13px; color: var(--text-01); line-height: 1.4; }
    .hu-meta { font-size: 12px; color: var(--text-muted); }
    .hu-right {
      display: flex; flex-direction: column; align-items: flex-end;
      gap: 4px; flex-shrink: 0; min-width: 160px; text-align: right;
    }
    .hu-status-text { font-size: 12px; color: var(--text-muted); }
    .hu-review-link {
      font-size: 13px; font-weight: 600; color: var(--interactive-text);
      text-decoration: none;
      &:hover { text-decoration: underline; }
    }
  `],
})
export class HeadsUpPanelComponent {
  @Input({ required: true }) items!: HeadsUpItem[];
  severityIcon(s: string): string { return SEVERITY_ICON[s] ?? 'product-important-info'; }
}
