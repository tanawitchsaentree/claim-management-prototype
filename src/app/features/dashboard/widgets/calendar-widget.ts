import { Component, Input, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { CalendarEvent } from '../../../core/models';

const TYPE_ICON: Record<string, string> = {
  deadline: 'clock-o',
  meeting:  'user-o',
  review:   'product-search-document',
};

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

@Component({
  selector: 'app-calendar-widget',
  standalone: true,
  imports: [CommonModule, NxIconModule],
  template: `
    <div class="panel-card">
      <div class="panel-card-header">
        <span class="panel-card-title">Upcoming</span>
      </div>

      @if (grouped().length === 0) {
        <div class="widget-empty" style="padding:8px 0 4px">No upcoming events.</div>
      } @else {
        <div class="cal-list">
          @for (group of grouped(); track group.date) {
            <div class="cal-day-group">
              <div class="cal-day-label">{{ group.label }}</div>
              @for (ev of group.events; track ev.id) {
                <div class="cal-event">
                  <nx-icon [name]="typeIcon(ev.type)" class="cal-icon cal-icon--{{ ev.type }}"></nx-icon>
                  <span class="cal-title">{{ ev.title }}</span>
                </div>
              }
            </div>
          }
        </div>
      }

      <div class="cal-footer">
        <a class="widget-link widget-link--disabled" aria-disabled="true" title="Full calendar coming soon">
          View full calendar
        </a>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .cal-list { max-height: 260px; overflow-y: auto; }
    .cal-day-group { margin-bottom: 10px; }
    .cal-day-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .06em; color: var(--text-muted); margin-bottom: 4px;
      padding-bottom: 3px; border-bottom: 1px solid var(--ui-03);
    }
    .cal-event {
      display: flex; align-items: center; gap: 6px;
      padding: 4px 0; font-size: 13px; color: var(--text-01);
    }
    .cal-icon { font-size: 14px; flex-shrink: 0; }
    .cal-icon--deadline { color: var(--danger, #c0392b); }
    .cal-icon--meeting  { color: var(--interactive-primary); }
    .cal-icon--review   { color: var(--warning, #f9b233); }
    .cal-title { line-height: 1.3; }
    .cal-footer { padding-top: 10px; border-top: 1px solid var(--ui-03); margin-top: 4px; }
    .widget-link {
      font-size: 13px; color: var(--interactive-text); font-weight: 600;
      cursor: pointer; text-decoration: none;
      &:hover { text-decoration: underline; }
      &--disabled { color: var(--text-muted); cursor: not-allowed; &:hover { text-decoration: none; } }
    }
  `],
})
export class CalendarWidgetComponent {
  @Input({ required: true }) events!: CalendarEvent[];

  grouped(): Array<{ date: string; label: string; events: CalendarEvent[] }> {
    const today = new Date(new Date().toDateString());
    const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() + 14);
    const upcoming = this.events
      .filter(e => { const d = new Date(e.date + 'T00:00:00'); return d >= today && d <= cutoff; })
      .sort((a, b) => a.date.localeCompare(b.date));
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of upcoming) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return Array.from(map.entries()).map(([date, events]) => ({ date, label: formatDateLabel(date), events }));
  }

  typeIcon(t: string): string { return TYPE_ICON[t] ?? 'clock-o'; }
}
