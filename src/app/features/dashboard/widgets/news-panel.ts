import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NewsItem } from '../../../core/models';

const TYPE_ICON: Record<string, string> = {
  info:    'product-important-info',
  warning: 'exclamation-triangle-o',
  urgent:  'exclamation-circle-o',
};

@Component({
  selector: 'app-news-panel',
  standalone: true,
  imports: [CommonModule, NxIconModule],
  template: `
    <div class="panel-card">
      <div class="panel-card-header">
        <span class="panel-card-title">News & Updates</span>
      </div>

      @if (items.length === 0) {
        <div style="font-size:13px;color:var(--text-muted);padding:4px 0">No updates.</div>
      } @else {
        <div class="news-list">
          @for (item of items; track item.id) {
            <div class="news-item" [class]="'news-item--' + item.type">
              <div class="news-header" (click)="toggle(item.id)">
                <nx-icon [name]="typeIcon(item.type)" class="news-type-icon news-type-icon--{{ item.type }}"></nx-icon>
                <span class="news-title">{{ item.title }}</span>
                <nx-icon [name]="expanded().has(item.id) ? 'chevron-up-small' : 'chevron-down-small'" class="news-chevron"></nx-icon>
              </div>
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
      padding: 7px 6px 7px 8px; cursor: pointer;
      &:hover { background: var(--ui-02); }
    }
    .news-type-icon { font-size: 14px; flex-shrink: 0; }
    .news-type-icon--warning { color: var(--warning, #f9b233); }
    .news-type-icon--urgent  { color: var(--danger, #c0392b); }
    .news-type-icon--info    { color: var(--interactive-primary); }
    .news-title { flex: 1; font-size: 13px; font-weight: 500; color: var(--text-01); line-height: 1.3; }
    .news-chevron { font-size: 12px; color: var(--text-muted); flex-shrink: 0; }
    .news-date-line { font-size: 11px; color: var(--text-muted); padding: 0 8px 6px 28px; }
    .news-body { padding: 4px 8px 10px 28px; }
    .news-body-text { font-size: 13px; color: var(--text-01); line-height: 1.5; margin: 0 0 4px; }
    .news-date { font-size: 11px; color: var(--text-muted); }
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
