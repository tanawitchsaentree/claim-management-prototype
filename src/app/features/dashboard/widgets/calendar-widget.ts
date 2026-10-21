import { Component, Input } from '@angular/core';

import { RouterLink } from '@angular/router';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { CalendarEvent } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

const TYPE_ICON: Record<string, string> = {
  deadline: 'clock-o',
  meeting: 'user-o',
  review: 'product-search-document'
};

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

@Component({
  selector: 'app-calendar-widget',
  standalone: true,
  imports: [RouterLink, NxIconModule, EmptyStateComponent],
  template: `
    <div class="panel-card">
      <div class="panel-card-header">
        <span class="panel-card-title">Upcoming</span>
      </div>

      @if (grouped().length === 0) {
        <app-empty-state message="No upcoming events."></app-empty-state>
      } @else {
        <div class="cal-list" tabindex="0">
          @for (group of grouped(); track group.date) {
            <div class="cal-day-group">
              <div class="cal-day-label">{{ group.label }}</div>
              @for (ev of group.events; track ev.id) {
                @if (ev.claimId) {
                  <a
                    class="cal-event cal-event--link"
                    [routerLink]="['/claims', ev.claimId, 'overview']"
                    [title]="ev.title + ' — open claim ' + ev.claimId"
                  >
                    <nx-icon
                      [name]="typeIcon(ev.type)"
                      class="cal-icon cal-icon--{{ ev.type }}"
                    ></nx-icon>
                    <span class="cal-title">{{ ev.title }}</span>
                    <nx-icon name="chevron-right-small" class="cal-go"></nx-icon>
                  </a>
                } @else {
                  <div class="cal-event">
                    <nx-icon
                      [name]="typeIcon(ev.type)"
                      class="cal-icon cal-icon--{{ ev.type }}"
                    ></nx-icon>
                    <span class="cal-title">{{ ev.title }}</span>
                  </div>
                }
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* Panel-card shell — ported from dashboard.scss (encapsulation blocks it
       from reaching this standalone component). Keep in sync with .panel-card. */
      .panel-card {
        background: var(--ui-01);
        border: 1px solid var(--ui-04);
        border-radius: var(--radius-s);
        padding: var(--space-base);
      }
      .panel-card-header {
        margin-bottom: var(--space-md);
      }
      .panel-card-title {
        font-size: var(--paragraph-01-font-size);
        font-weight: 600;
        color: var(--text-01);
        line-height: 1.4;
      }

      .cal-list {
        max-height: 320px;
        overflow-y: auto;
        padding-right: var(--space-xs);
      }
      .cal-day-group {
        margin-bottom: var(--space-base);
        &:last-child {
          margin-bottom: 0;
        }
      }
      .cal-day-label {
        font-size: var(--paragraph-04-font-size);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
        margin-bottom: var(--space-sm);
        padding-bottom: var(--space-xs);
        border-bottom: 1px solid var(--ui-03);
      }
      .cal-event {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm) 0;
        font-size: var(--paragraph-03-font-size);
        color: var(--text-01);
        text-decoration: none;
      }
      .cal-event--link {
        cursor: pointer;
        border-radius: var(--radius-s);
        margin: 0 calc(-1 * var(--space-sm));
        padding: var(--space-sm);
        &:hover {
          background: var(--ui-02);
          .cal-go {
            opacity: 1;
          }
        }
      }
      .cal-icon {
        font-size: 14px;
        flex-shrink: 0;
      }
      .cal-icon--deadline {
        color: var(--danger);
      }
      .cal-icon--meeting {
        color: var(--interactive-primary);
      }
      .cal-icon--review {
        color: var(--warning);
      }
      .cal-title {
        flex: 1;
        line-height: 1.4;
      }
      .cal-go {
        font-size: var(--paragraph-03-font-size);
        flex-shrink: 0;
        color: var(--text-muted);
        opacity: 0;
        transition: opacity 0.12s;
      }
    `
  ]
})
export class CalendarWidgetComponent {
  @Input({ required: true }) events!: CalendarEvent[];

  grouped(): { date: string; label: string; events: CalendarEvent[] }[] {
    const today = new Date(new Date().toDateString());
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + 14);
    const upcoming = this.events
      .filter(e => {
        const d = new Date(e.date + 'T00:00:00');
        return d >= today && d <= cutoff;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of upcoming) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return Array.from(map.entries()).map(([date, events]) => ({
      date,
      label: formatDateLabel(date),
      events
    }));
  }

  typeIcon(t: string): string {
    return TYPE_ICON[t] ?? 'clock-o';
  }
}
