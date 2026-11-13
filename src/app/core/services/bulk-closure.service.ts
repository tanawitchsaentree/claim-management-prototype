import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MockSectionService } from '../mock/services/mock-section.service';
import { MockStateService } from '../mock/state/mock-state.service';
import { MockClaimOverviewService } from '../mock/services/mock-claim-overview.service';
import { MockLookupService } from '../mock/services/mock-lookup.service';
import { ClaimClosureService } from './claim-closure.service';
import {
  Blocker,
  BulkClosureCandidate,
  BulkClosureKind,
  BulkClosureOutcome,
  ClosureReason
} from '../models/claim-closure.model';
import { ClaimSection, SectionClosureReason } from '../models/section.model';
import { ClaimActivity } from '../models/claim-overview.model';

interface Actor {
  userId: string;
  name: string;
}

const ALREADY_CLOSED: Blocker = { type: 'close-failed', label: 'Already closed, nothing to do.' };

const FAILED: Blocker = {
  type: 'close-failed',
  label: 'Something went wrong while closing. Nothing was changed, try again.'
};

/**
 * Bulk closure (BMPCC-22660, epic BMPCC-21933 FR4). Each item is checked on
 * its own against the same rules single closure uses; items without blockers
 * close, items with blockers stay open (partial success, confirmed by the PO).
 * There is no override for a blocked item.
 */
@Injectable({ providedIn: 'root' })
export class BulkClosureService {
  private readonly sectionSvc = inject(MockSectionService);
  private readonly stateSvc = inject(MockStateService);
  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly lookupSvc = inject(MockLookupService);
  private readonly closureSvc = inject(ClaimClosureService);

  /** Checks every selected item before the handler confirms (the review step). */
  async check(kind: BulkClosureKind, ids: string[]): Promise<BulkClosureCandidate[]> {
    if (kind === 'section') return ids.map(id => this.sectionCandidate(id));
    return Promise.all(ids.map(id => this.claimCandidate(id)));
  }

  /**
   * Runs the batch. Items are validated again at close time, since something
   * may have changed since the review step. Items run in the given order.
   */
  async close(
    kind: BulkClosureKind,
    ids: string[],
    reason: string,
    actor: Actor
  ): Promise<BulkClosureOutcome[]> {
    const out: BulkClosureOutcome[] = [];
    for (const id of ids) {
      out.push(
        kind === 'section'
          ? await this.closeOneSection(id, reason as SectionClosureReason, actor)
          : await this.closeOneClaim(id, reason as ClosureReason, actor)
      );
    }
    return out;
  }

  // ── Sections ──────────────────────────────────────────────────────────

  private findSection(id: string): ClaimSection | undefined {
    const claimId = this.stateSvc.state().sections.find(s => s.id === id)?.claimId;
    if (!claimId) return undefined;
    return this.sectionSvc.getByClaimIdSync(claimId).find(s => s.id === id);
  }

  private sectionCandidate(id: string): BulkClosureCandidate {
    const section = this.findSection(id);
    if (!section) return { id, name: id, detail: '', blockers: [FAILED] };
    if (section.status === 'Closed') {
      return { id, name: section.name, detail: '', blockers: [ALREADY_CLOSED] };
    }
    const label =
      this.lookupSvc.getTypeOfDamageSync().find(o => o.value === section.damageType)?.label ??
      section.damageType;
    return {
      id,
      name: section.name,
      detail: label,
      blockers: this.closureSvc.validateSectionBlockers(section).blockers
    };
  }

  private async closeOneSection(
    id: string,
    reason: SectionClosureReason,
    actor: Actor
  ): Promise<BulkClosureOutcome> {
    const section = this.findSection(id);
    const name = section?.name ?? id;
    if (!section) return { id, name, status: 'failed', blockers: [FAILED] };
    const { blockers } = this.closureSvc.validateSectionBlockers(section);
    if (blockers.length) return { id, name, status: 'blocked', blockers };
    if (section.simulateCloseError) {
      // Fails once, so "Try again" shows the way out of the error.
      await firstValueFrom(this.sectionSvc.patchSection(id, { simulateCloseError: undefined }));
      return { id, name, status: 'failed', blockers: [FAILED] };
    }
    await firstValueFrom(this.sectionSvc.closeSection(id, actor, reason, { silent: true }));
    return { id, name, status: 'closed', blockers: [] };
  }

  // ── Claims ────────────────────────────────────────────────────────────

  private async claimCandidate(id: string): Promise<BulkClosureCandidate> {
    try {
      const [claim, check] = await Promise.all([
        firstValueFrom(this.overviewSvc.getOverview(id)),
        firstValueFrom(this.closureSvc.validateBlockers(id))
      ]);
      const blockers = claim.status === 'Closed' ? [ALREADY_CLOSED] : check.blockers;
      return { id, name: id, detail: claim.policyHolder ?? '', blockers };
    } catch {
      return { id, name: id, detail: '', blockers: [FAILED] };
    }
  }

  private async closeOneClaim(
    id: string,
    reason: ClosureReason,
    actor: Actor
  ): Promise<BulkClosureOutcome> {
    try {
      const claim = await firstValueFrom(this.overviewSvc.getOverview(id));
      if (claim.status === 'Closed') {
        return { id, name: id, status: 'blocked', blockers: [ALREADY_CLOSED] };
      }
      const { blockers } = await firstValueFrom(this.closureSvc.validateBlockers(id));
      if (blockers.length) return { id, name: id, status: 'blocked', blockers };
      if (claim.simulateCloseError) {
        this.stateSvc.patchOverview(id, { simulateCloseError: undefined });
        return { id, name: id, status: 'failed', blockers: [FAILED] };
      }
      // One reason for the batch; retention is the default 10 years. A custom
      // retention date needs the single-claim closure on Claim overview.
      await firstValueFrom(
        this.closureSvc.closeClaim(id, { reason, retentionType: 'default', confirmedBy: actor })
      );
      const activity: ClaimActivity = {
        id: `act-bulk-close-${id}-${Date.now()}`,
        claimId: id,
        user: actor.name,
        timestamp: new Date().toISOString(),
        objectType: 'Claim',
        attribute: 'Status',
        valueOld: claim.status,
        valueNew: 'Closed'
      };
      this.stateSvc.patchActivities(items => [activity, ...items]);
      return { id, name: id, status: 'closed', blockers: [] };
    } catch {
      return { id, name: id, status: 'failed', blockers: [FAILED] };
    }
  }
}
