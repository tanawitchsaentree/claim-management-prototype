import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NewsItem } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

const TYPE_ICON: Record<string, string> = {
  info:    'product-important-info',
  warning: 'exclamation-triangle-o',
  urgent:  'exclamation-circle-o',
};

@Component({
  selector: 'app-news-panel',
  standalone: true,
  imports: [CommonModule, NxIconModule, EmptyStateComponent],
  template: `
    <div class="panel-card">
      <div class="panel-card-header">
        <span class="panel-card-title">News & Updates</span>
      </div>

      @if (items.length === 0) {
        <app-empty-state message="No updates."></app-empty-state>
      } @else {
        <div class="news-list">
          @for (item of items; track item.id) {
            <div class="news-item" [class]="'news-item--' + item.type">
              <button type="button" class="news-header" [attr.aria-expanded]="expanded().has(item.id)" (click)="toggle(item.id)">
                <nx-icon [name]="typeIcon(item.type)" class="news-type-icon news-type-icon--{{ item.type }}"></nx-icon>
                <span class="news-title">{{ item.title }}</span>
                <nx-icon [name]="expanded().has(item.id) ? 'chevron-up-small' : 'chevron-down-small'" class="news-chevron"></nx-icon>
              </button>
              @if (expanded().has(item.id)) {
                <div class="news-body">
                  <p class="news-body-text">{{ item.body }}</p>
                  <span class="news-date">{{ item.date }}</span>
                </div>
              } @else {
                <div class="news-date-line">{{ item.date }}</div>
              }
            </div>
          }
        </div>
      }
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
    .panel-card-header { margin-bottom: 12px; }
    .panel-card-title { font-size: 16px; font-weight: 600; color: var(--text-01); line-height: 1.4; }

    .news-list { display: flex; flex-direction: column; gap: 2px; }
    .news-item {
      border-radius: 3px;
      overflow: hidden;
      border-left: 3px solid transparent;
      &--warning { border-left-color: var(--warning, #f9b233); }
      &--urgent  { border-left-color: var(--danger, #c0392b); }
      &--info    { border-left-color: var(--interactive-primary); }
    }
    .news-header {
      display: flex; align-items: center; gap: 6px;
      width: 100%; padding: 7px 6px 7px 8px; cursor: pointer;
      background: none; border: none; font: inherit; text-align: left; color: inherit;
      &:hover { background: var(--ui-02); }
    }
    .news-type-icon { font-size: 14px; flex-shrink: 0; }
    .news-type-icon--warning { color: var(--warning, #f9b233); }
    .news-type-icon--urgent  { color: var(--danger, #c0392b); }
    .news-type-icon--info    { color: var(--interactive-primary); }
    .news-title { flex: 1; font-size: var(--paragraph-04-font-size); font-weight: 500; color: var(--text-01); line-height: 1.3; }
    .news-chevron { font-size: 12px; color: var(--text-muted); flex-shrink: 0; }
    .news-date-line { font-size: var(--paragraph-04-font-size); color: var(--text-muted); padding: 0 8px 6px 28px; }
    .news-body { padding: 4px 8px 10px 28px; }
    .news-body-text { font-size: var(--paragraph-04-font-size); color: var(--text-01); line-height: 1.5; margin: 0 0 4px; }
    .news-date { font-size: var(--paragraph-04-font-size); color: var(--text-muted); }
  `],
})
export class NewsPanelComponent {
  @Input({ required: true }) items!: NewsItem[];
  readonly expanded = signal(new Set<string>());

  toggle(id: string): void {
    const s = new Set(this.expanded());
    s.has(id) ? s.delete(id) : s.add(id);
    this.expanded.set(s);
  }

  typeIcon(t: string): string { return TYPE_ICON[t] ?? 'product-important-info'; }
}
