import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { RecoveryAttentionItem } from '../../../core/models/recovery-potential.model';

/** Rows shown before collapsing the rest behind a count. */
const PREVIEW = 5;

/**
 * Dashboard prompt for claims whose recovery-potential decision is outstanding.
 *
 * The Recoveries call (2026-09-01) asked how to get handlers to answer the
 * Yes/No "other than with task management" — Marlene's suggestion was to do it
 * from the dashboard. This is that: the question follows the handler to the
 * page they open first, instead of waiting on a claim they may not revisit
 * until closure, at which point the closure blocker is the one telling them.
 */
@Component({
  selector: 'app-recovery-potential-panel',
  standalone: true,
  imports: [RouterLink, NxIconModule, EmptyStateComponent],
  template: `
    <div class="widget-card">
      <div class="widget-header">
        <div class="widget-header-left">
          <div class="widget-icon-wrap">
            <nx-icon name="product-refresh" class="widget-icon"></nx-icon>
          </div>
          <span class="widget-title">Recovery potential: decision needed</span>
        </div>
        @if (items().length > 0) {
          <span class="rpp-count">{{ items().length }}</span>
        }
      </div>

      @if (items().length === 0) {
        <app-empty-state message="Every open claim has a recovery decision on record."></app-empty-state>
      } @else {
        <div class="rpp-list">
          @for (item of visible(); track item.claimId) {
            <div class="rpp-row">
              <nx-icon
                [name]="item.state === 'unanswered' ? 'exclamation-triangle-o' : 'product-important-info'"
                class="rpp-icon"
                [class.rpp-icon--warning]="item.state === 'unanswered'"
                [class.rpp-icon--info]="item.state === 'yes-pending'"></nx-icon>
              <div class="rpp-body">
                <div class="rpp-claim-line">
                  <span class="rpp-claim-id">{{ item.claimId }}</span>
                  <span class="rpp-client">{{ item.clientName }}</span>
                </div>
                <div class="rpp-reason">{{ item.reason }}</div>
              </div>
              <a [routerLink]="['/claims', item.claimId, 'overview']" class="rpp-link">
                {{ item.state === 'unanswered' ? 'Answer' : 'Set up' }}
              </a>
            </div>
          }
        </div>
        @if (hidden() > 0) {
          <button type="button" class="rpp-more" (click)="expanded.set(true)">
            Show {{ hidden() }} more
          </button>
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* Widget shell — ported from dashboard.scss so this standalone component
       matches its inline sibling widgets (encapsulation blocks dashboard.scss
       from reaching here). Keep values in sync with .widget-* there.
       BLESSED: widgets/heads-up-panel.ts */
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

    .rpp-count {
      font-size: var(--paragraph-04-font-size);
      font-weight: 600;
      color: var(--text-muted);
    }

    .rpp-list { padding: 0 0 8px; }
    .rpp-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 24px;
      border-bottom: 1px solid var(--ui-03);
      &:last-child { border-bottom: none; }
      /* No row tint — the icon colour already signals which of the two states
         this is. (No-row-tint rule: state goes on the badge/icon.) */
    }
    .rpp-icon { font-size: 18px; margin-top: 2px; flex-shrink: 0; }
    .rpp-icon--warning { color: var(--warning); }
    .rpp-icon--info    { color: var(--interactive-primary); }
    .rpp-body { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .rpp-claim-line { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .rpp-claim-id { font-weight: 600; font-size: var(--paragraph-04-font-size); color: var(--interactive-text); }
    .rpp-client { font-size: 14px; color: var(--text-01); font-weight: 500; }
    .rpp-reason { font-size: var(--paragraph-04-font-size); color: var(--text-01); line-height: 1.4; }
    .rpp-link {
      font-size: var(--paragraph-04-font-size); font-weight: 600; color: var(--interactive-text);
      text-decoration: none; flex-shrink: 0;
      &:hover { text-decoration: underline; }
    }
    .rpp-more {
      display: block;
      width: 100%;
      padding: 12px 24px;
      background: none;
      border: none;
      border-top: 1px solid var(--ui-03);
      font-size: var(--paragraph-04-font-size);
      font-weight: 600;
      color: var(--interactive-text);
      text-align: left;
      cursor: pointer;
      &:hover { background: var(--hover-secondary); }
    }
  `],
})
export class RecoveryPotentialPanelComponent {
  // A signal input, unlike its @Input-based sibling widgets — `visible` is a
  // computed over it, and a plain @Input would leave that computed holding a
  // stale slice whenever the list changes without `expanded` also changing.
  readonly items = input.required<RecoveryAttentionItem[]>();

  readonly expanded = signal(false);

  readonly visible = computed(() => (this.expanded() ? this.items() : this.items().slice(0, PREVIEW)));
  readonly hidden = computed(() => (this.expanded() ? 0 : Math.max(0, this.items().length - PREVIEW)));
}
