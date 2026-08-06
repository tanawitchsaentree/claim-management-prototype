import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxIconModule } from '@allianz/ng-aquila/icon';

// Canonical shape derived from the most common existing pattern (governance
// audit, 2026-08-06): centered italic muted text — used near-identically by
// claims-list/loss-events-list/mass-events/claim-notes-panel/litigation/
// approvals' empty-cell before this component existed. Icon + hint + action
// are opt-in for the minority of sites that already needed them (risk-analysis
// investigation state, step-1-search search-empty).
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, NxIconModule],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  @Input({ required: true }) message!: string;
  @Input() hint?: string;
  @Input() icon?: string;
  // Projection slots: [body] for rare rich content (e.g. a bulleted "you can" list — step-1-search's
  // search-empty state), [action] for a CTA button/button-group. Neither slot renders anything if unused.
}
