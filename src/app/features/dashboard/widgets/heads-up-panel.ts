import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { HeadsUpItem } from '../../../core/models';

const SEVERITY_ICON: Record<string, string> = {
  info:     'product-important-info',
  warning:  'exclamation-triangle-o',
  critical: 'exclamation-circle-o',
};

@Component({
  selector: 'app-heads-up-panel',
  standalone: true,
  imports: [CommonModule, NxIconModule, RouterLink],
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
        <div class="widget-empty">No claims currently under monitoring.</div>
      } @else {
        <div class="hu-list">
          @for (item of items; track item.id) {
            <div class="hu-row" [class]="'hu-row--' + item.severity">
              <nx-icon [name]="severityIcon(item.severity)" class="hu-severity-icon" [class]="'hu-icon--' + item.severity"></nx-icon>
              <div class="hu-body">
                <div class="hu-claim-line">
                  <span class="hu-claim-id">{{ item.claimId }}</span>
                  <span class="hu-client">{{ item.clientName }}</span>
                  <span class="hu-status-text">{{ item.status }}</span>
                </div>
                <div class="hu-reason">{{ item.reason }}</div>
                <div class="hu-meta">Last update: {{ item.lastUpdate }}</div>
              </div>
              <a [routerLink]="['/claims', item.claimId, 'overview']" class="hu-review-link">Review</a>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .hu-list { padding: 0 0 8px; }
    .hu-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 24px;
      border-bottom: 1px solid var(--ui-03);
      &:last-child { border-bottom: none; }
      &--critical { background: rgba(192,57,43,.04); }
      &--warning  { background: rgba(249,178,51,.04); }
    }
    .hu-severity-icon { font-size: 18px; margin-top: 2px; flex-shrink: 0; }
    .hu-icon--critical { color: var(--danger, #c0392b); }
    .hu-icon--warning  { color: var(--warning, #f9b233); }
    .hu-icon--info     { color: var(--interactive-primary); }
    .hu-body { flex: 1; display: flex; flex-direction: column; gap: 3px; }
    .hu-claim-line { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .hu-claim-id { font-weight: 600; font-size: 13px; color: var(--interactive-text); }
    .hu-client { font-size: 14px; color: var(--text-01); font-weight: 500; }
    .hu-status-text { font-size: 12px; color: var(--text-muted); margin-left: auto; }
    .hu-reason { font-size: 13px; color: var(--text-01); line-height: 1.4; }
    .hu-meta { font-size: 12px; color: var(--text-muted); }
    .hu-review-link {
      font-size: 13px; font-weight: 600; color: var(--interactive-text);
      text-decoration: none; flex-shrink: 0; align-self: center;
      &:hover { text-decoration: underline; }
    }
  `],
})
export class HeadsUpPanelComponent {
  @Input({ required: true }) items!: HeadsUpItem[];
  severityIcon(s: string): string { return SEVERITY_ICON[s] ?? 'product-important-info'; }
}
