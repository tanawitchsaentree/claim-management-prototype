import { Component, computed, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { GgAttentionItem } from '../../../core/models/gg-dashboard.model';

/** Rows shown before collapsing the rest behind a count (as recovery-potential-panel.ts). */
const PREVIEW = 5;

/**
 * Dashboard list of Global Genius failures the handler has to fix
 * (docs/ux/gg-dashboard.md, DESIGN DECISION GG-DASH-1). One row per broken
 * item, each with its own link to the fix. Structure, styles and the
 * "Show N more" pattern are copied from recovery-potential-panel.ts.
 */
@Component({
  selector: 'app-gg-attention-panel',
  standalone: true,
  imports: [RouterLink, NxIconModule, EmptyStateComponent],
  template: `
    <div class="widget-card">
      <div class="widget-header">
        <div class="widget-header-left">
          <div class="widget-icon-wrap">
            <nx-icon name="product-coins-money" class="widget-icon"></nx-icon>
          </div>
          <span class="widget-title">Global Genius: needs your action</span>
        </div>
        @if (items().length > 0) {
          <span class="ggp-count">{{ items().length }}</span>
        }
      </div>

      @if (items().length === 0) {
        <app-empty-state message="Everything is booked in Global Genius."></app-empty-state>
      } @else {
        <div class="ggp-list">
          @for (item of visible(); track item.key) {
            <div class="ggp-row">
              <nx-icon name="exclamation-triangle-o" class="ggp-icon ggp-icon--danger"></nx-icon>
              <div class="ggp-body">
                <div class="ggp-claim-line">
                  <span class="ggp-claim-id">{{ item.claimId }}</span>
                  <span class="ggp-client">{{ item.clientName }}</span>
                </div>
                <div class="ggp-reason">{{ item.reason }}</div>
              </div>
              <a [routerLink]="item.link" [queryParams]="item.queryParams" class="ggp-link">
                {{ item.linkLabel }}
              </a>
            </div>
          }
        </div>
        @if (hidden() > 0) {
          <button type="button" class="ggp-more" (click)="expanded.set(true)">
            Show {{ hidden() }} more
          </button>
        }
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      :host {
        display: block;
      }

      /* Widget shell: ported from dashboard.scss so this standalone component
       matches its inline sibling widgets (encapsulation blocks dashboard.scss
       from reaching here). Keep values in sync with .widget-* there.
       BLESSED: widgets/heads-up-panel.ts
       Copied from widgets/recovery-potential-panel.ts so the two panels match. */
      .widget-card {
        background: var(--ui-01);
        border: 1px solid var(--ui-04);
        border-radius: var(--radius-m);
        margin-bottom: var(--space-xl); /* $sp-xl, same gap as sibling widgets */
        overflow: hidden;
        box-shadow: 0 1px 4px var(--claim-overlay-shadow);
      }
      .widget-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-lg) var(--space-xl) var(--space-md); /* $sp-lg $sp-xl $sp-md */
      }
      .widget-header-left {
        display: flex;
        align-items: center;
        gap: var(--space-ndbx-10);
      }
      .widget-icon-wrap {
        width: 32px;
        height: 32px;
        border: 1px solid var(--ui-04);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .widget-icon {
        color: var(--text-01);
        font-size: 16px;
      }
      .widget-title {
        font-size: var(--heading-05-font-size);
        font-weight: 600;
        color: var(--text-01);
        line-height: 1.4;
      }

      .ggp-count {
        font-size: var(--paragraph-04-font-size);
        font-weight: 600;
        color: var(--text-muted);
      }

      .ggp-list {
        padding: 0 0 var(--space-sm);
      }
      .ggp-row {
        display: flex;
        align-items: flex-start;
        gap: var(--space-md);
        padding: var(--space-md) var(--space-xl);
        border-bottom: 1px solid var(--ui-03);
        &:last-child {
          border-bottom: none;
        }
        /* No row tint (no-row-tint rule: state goes on the icon). */
      }
      .ggp-icon {
        font-size: 18px;
        margin-top: 2px;
        flex-shrink: 0;
      }
      /* Red = "you must act" (docs/ux/gg-dashboard.md). Same colour as the
       dashboard's overdue triangle (dashboard.scss .overdue-icon). */
      .ggp-icon--danger {
        color: var(--danger);
      }
      .ggp-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }
      .ggp-claim-line {
        display: flex;
        align-items: baseline;
        gap: var(--space-sm);
        flex-wrap: wrap;
      }
      .ggp-claim-id {
        font-weight: 600;
        font-size: var(--paragraph-04-font-size);
        color: var(--interactive-text);
      }
      .ggp-client {
        font-size: var(--paragraph-03-font-size);
        color: var(--text-01);
        font-weight: 500;
      }
      .ggp-reason {
        font-size: var(--paragraph-04-font-size);
        color: var(--text-01);
        line-height: 1.4;
      }
      .ggp-link {
        font-size: var(--paragraph-04-font-size);
        font-weight: 600;
        color: var(--interactive-text);
        text-decoration: none;
        flex-shrink: 0;
        &:hover {
          text-decoration: underline;
        }
      }
      .ggp-more {
        display: block;
        width: 100%;
        padding: var(--space-md) var(--space-xl);
        background: none;
        border: none;
        border-top: 1px solid var(--ui-03);
        font-size: var(--paragraph-04-font-size);
        font-weight: 600;
        color: var(--interactive-text);
        text-align: left;
        cursor: pointer;
        &:hover {
          background: var(--hover-secondary);
        }
      }
    `
  ]
})
export class GgAttentionPanelComponent {
  readonly items = input.required<GgAttentionItem[]>();

  readonly expanded = signal(false);

  readonly visible = computed(() =>
    this.expanded() ? this.items() : this.items().slice(0, PREVIEW)
  );
  readonly hidden = computed(() =>
    this.expanded() ? 0 : Math.max(0, this.items().length - PREVIEW)
  );
}
