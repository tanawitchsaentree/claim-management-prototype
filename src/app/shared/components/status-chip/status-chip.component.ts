import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

type ClaimStatus = 'open' | 'in-progress' | 'priced' | 'quoted' | 'bound' | 'declined' | 'closed';
type TaskStatus  = 'open' | 'in-progress' | 'done' | 'pending' | 'not-assigned' | 'completed';
type EntityStatus = 'promised' | 'conditional' | 'by-extension' | 'not-promised';
type Domain = 'claim' | 'task' | 'entity' | 'damage-item' | 'clearance' | 'risk-severity' | 'recovery' | 'policy' | 'skeleton-claim' | 'mass-event' | 'coverage-review';

// Maps status + domain to the CSS custom property pair defined in styles.scss.
// Using a lookup avoids any hardcoded hex values here.
const TOKEN_MAP: Record<Domain, Record<string, string>> = {
  claim: {
    'open':        'claim-status-open',
    'in-progress': 'claim-status-in-progress',
    'priced':      'claim-status-priced',
    'quoted':      'claim-status-quoted',
    'bound':       'claim-status-bound',
    'declined':    'claim-status-declined',
    'closed':      'claim-status-closed',
    'reopened':    'claim-status-reopened',
    'monitoring':  'claim-status-in-progress',
  },
  task: {
    'open':         'task-status-open',
    'in-progress':  'task-status-in-progress',
    'done':         'task-status-done',
    'pending':      'task-status-pending',
    'not-assigned': 'task-status-not-assigned',
    'completed':    'task-status-completed',
  },
  entity: {
    'promised':      'entity-status-promised',
    'conditional':   'entity-status-conditional',
    'by-extension':  'entity-status-by-extension',
    'not-promised':  'entity-status-not-promised',
  },
  'damage-item': {
    'open':     'damage-item-status-open',
    'assessed': 'damage-item-status-assessed',
    'approved': 'damage-item-status-approved',
    'rejected': 'damage-item-status-rejected',
  },
  'clearance': {
    'cleared':        'clearance-cleared',
    'not-cleared':    'clearance-not-cleared',
    'pending':        'clearance-pending',
    'not-applicable': 'clearance-not-applicable',
  },
  'risk-severity': {
    'high':   'claim-status-declined',
    'medium': 'task-status-in-progress',
    'low':    'claim-status-bound',
  },
  'recovery': {
    'yes': 'recovery-yes',
    'no':  'recovery-no',
  },
  'policy': {
    'active':    'claim-status-bound',
    'expired':   'claim-status-closed',
    'cancelled': 'claim-status-closed',
    'pending':   'task-status-open',
  },
  'skeleton-claim': {
    'awaiting-policy': 'skeleton-claim-awaiting',
    'matched':         'skeleton-claim-matched',
    'abandoned':       'skeleton-claim-abandoned',
  },
  'mass-event': {
    'pending':    'task-status-pending',
    'confirmed':  'claim-status-bound',
    'overridden': 'task-status-not-assigned',
  },
  // PI 2026.3 UI/UX Alignment item 8 — coverage-review had no color mapping,
  // rendered as flat gray text regardless of status.
  'coverage-review': {
    'standard-review':                  'claim-status-bound',
    'enhanced-review-required':         'task-status-in-progress',
    'additional-information-required':  'claim-status-declined',
  },
};

const FALLBACK_TOKEN = 'claim-status-closed';

@Component({
  selector: 'app-status-chip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-chip.component.html',
  styleUrl: './status-chip.component.scss',
})
export class StatusChipComponent implements OnChanges {
  @Input({ required: true }) status!: string;
  @Input() domain: Domain = 'claim';
  @Input() label?: string;
  /** 'pill' = filled background chip (default). 'text' = color-only, no background — for inline table text that was never a chip. */
  @Input() variant: 'pill' | 'text' = 'pill';

  bgVar  = '';
  clrVar = '';
  displayLabel = '';

  ngOnChanges(): void {
    const key   = this.status?.toLowerCase().replace(/\s+/g, '-') ?? '';
    const token = TOKEN_MAP[this.domain]?.[key];

    if (!token) {
      console.warn(`[StatusChip] Unknown status "${this.status}" for domain "${this.domain}" — using fallback style.`);
    }

    const resolved = token ?? FALLBACK_TOKEN;
    this.bgVar  = `var(--${resolved}-bg)`;
    this.clrVar = `var(--${resolved}-color)`;
    this.displayLabel = this.label ?? this.formatLabel(this.status);
  }

  private formatLabel(status: string): string {
    if (!status) return '';
    return status
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
}
