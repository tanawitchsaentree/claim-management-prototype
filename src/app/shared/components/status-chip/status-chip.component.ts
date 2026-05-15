import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

type ClaimStatus = 'open' | 'in-progress' | 'priced' | 'quoted' | 'bound' | 'declined' | 'closed' | 'reopened';
type TaskStatus  = 'open' | 'in-progress' | 'done' | 'pending' | 'not-assigned' | 'completed';
type EntityStatus = 'promised' | 'conditional' | 'by-extension' | 'not-promised';
type Domain = 'claim' | 'task' | 'entity' | 'damage-item' | 'clearance';

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
