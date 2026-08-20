import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

type ClaimStatus = 'open' | 'in-progress' | 'priced' | 'quoted' | 'bound' | 'declined' | 'closed';
type TaskStatus  = 'open' | 'in-progress' | 'done' | 'pending' | 'not-assigned' | 'completed';
type EntityStatus = 'promised' | 'conditional' | 'by-extension' | 'not-promised';
type Domain = 'claim' | 'task' | 'entity' | 'damage-item' | 'clearance' | 'risk-severity' | 'recovery' | 'policy' | 'skeleton-claim' | 'mass-event' | 'coverage-review' | 'provider-assignment' | 'tracker' | 'jira';

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
  // Reverted per product feedback 2026-08-18 — coverage review status should
  // read as neutral, not color-coded by outcome.
  'coverage-review': {
    'standard-review':                  'claim-status-quoted',
    'enhanced-review-required':         'claim-status-quoted',
    'additional-information-required':  'claim-status-quoted',
  },
  'provider-assignment': {
    'active':    'claim-status-bound',
    'completed': 'claim-status-closed',
    'cancelled': 'claim-status-declined',
  },
  // Tracker (Design/Build/Handoff stage + blocked reason) — pure reuse of
  // existing task/claim tokens, no new colours needed. All 5 blocked_by
  // reasons render the same red "declined" token; the label text (via
  // formatLabel) is what distinguishes them.
  'tracker': {
    'not-started':         'task-status-not-assigned',
    'in-progress':         'task-status-in-progress',
    'done':                'task-status-done',
    'waiting-product':     'claim-status-declined',
    'waiting-ba':          'claim-status-declined',
    'waiting-dev':         'claim-status-declined',
    'waiting-other-epic':  'claim-status-declined',
    'scope-unclear':       'claim-status-declined',
  },
  // Raw jira_status display (2026-08-20) — deliberately NOT reusing any
  // token the 'tracker' domain above uses, so a Jira "In Progress" chip
  // can never render identically to our own in_progress design/build/
  // handoff chip. Verified against actual hex values in styles.scss, not
  // just distinct token names: tracker's in_progress is amber
  // (task-status-in-progress, #fdf3d6/#7a5200); jira's is blue
  // (claim-status-in-progress, #dce9f8/#006192). tracker's done is green
  // (task-status-done, #d4edda/#155724); jira's is grey (claim-status-
  // closed, #e8e8e8/#767676). tracker's blocked reasons are
  // claim-status-declined (#f8d7da/#721c24); jira's Blocked uses
  // clearance-not-cleared instead (#fde2e4/#b91c1c) — same family,
  // different exact shade, on top of also always rendering as the
  // `variant="text"` (no pill) form (see status-chip usage) for a second,
  // structural distinction beyond colour alone.
  'jira': {
    'to-do':          'claim-status-open',
    'in-progress':    'claim-status-in-progress',
    'in-testing':     'claim-status-in-progress',
    'in-acceptance':  'claim-status-in-progress',
    'done':           'claim-status-closed',
    'blocked':        'clearance-not-cleared',
    'descoped':       'claim-status-priced',
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
    // Underscore-collapsing added for tracker's snake_case DB values
    // (not_started, waiting_product, ...) — pre-existing domains only ever
    // used hyphens/spaces, so this is backward-compatible.
    const key   = this.status?.toLowerCase().replace(/[\s_]+/g, '-') ?? '';
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
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
}
