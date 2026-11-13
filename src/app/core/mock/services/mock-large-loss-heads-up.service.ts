import { Injectable, inject } from '@angular/core';
import { MockStateService } from '../state/mock-state.service';
import { AuthService } from '../../services/auth';
import { ClaimOverview } from '../../models/claim-overview.model';
import {
  HeadsUpReason,
  LargeLossHeadsUp,
  PrefillKey,
  incurredOf
} from '../../models/large-loss-heads-up.model';
import policiesData from '../data/policies.json';
import financeData from '../data/heads-up-finance.json';

// BMPCC-22350 Large Loss Heads-Up. One per claim, kept on the claim's overview
// record (so the DEV banner can seed every state with overviewPatch). Threshold
// detection itself belongs to the backend (a Finance event says incurred
// changed); the prototype shows its result: a draft created by the system, or
// a notice on the Heads-Up that already exists.

interface FinanceFigures {
  priorGross?: string;
  priorNet?: string;
  netShare?: number;
  artShare?: string;
  azreExposure?: string;
}

interface PolicyRow {
  policyNumber: string;
  effectiveDate?: string;
  expiryDate?: string;
}

// Operating entity per country of the claim. Placeholder until OE comes from
// the claim's organisation data.
const OE_BY_COUNTRY: Record<string, string> = {
  Germany: 'Allianz Commercial Germany',
  France: 'Allianz Commercial France',
  'United Kingdom': 'Allianz Commercial UK',
  'United States': 'Allianz Commercial US',
  Hungary: 'Allianz Commercial Hungary'
};

const SAVE_MS = 700;

@Injectable({ providedIn: 'root' })
export class MockLargeLossHeadsUpService {
  private readonly stateSvc = inject(MockStateService);
  private readonly auth = inject(AuthService);

  get(claimId: string): LargeLossHeadsUp | undefined {
    return this.stateSvc.state().overviews[claimId]?.headsUp;
  }

  /** Manual creation (Feature A non-financial + Feature D early). No amount check. */
  create(claimId: string, reasons: HeadsUpReason[], reasonNote: string): LargeLossHeadsUp | undefined {
    const claim = this.stateSvc.state().overviews[claimId];
    if (!claim || claim.headsUp) return claim?.headsUp;
    const now = new Date().toISOString();
    const headsUp: LargeLossHeadsUp = {
      id: `HU-${claimId}`,
      origin: 'manual',
      reasons,
      reasonNote: reasonNote || undefined,
      status: 'draft',
      createdAt: now,
      createdBy: this.auth.user().name,
      prefill: this.buildPrefill(claim, false),
      values: {},
      texts: {},
      attachments: []
    };
    this.stateSvc.patchOverview(claimId, { headsUp });
    return headsUp;
  }

  /**
   * First open of a record that has no snapshot yet (seeded by the DEV
   * banner): take it now, from the claim as it is, and keep it.
   */
  ensurePrefill(claimId: string): void {
    const claim = this.stateSvc.state().overviews[claimId];
    const hu = claim?.headsUp;
    if (!claim || !hu || hu.prefill) return;
    this.patch(claimId, { prefill: this.buildPrefill(claim, !!hu.financialPending) });
  }

  /** The handler opened it: the threshold bell line has done its job. */
  markThresholdSeen(claimId: string): void {
    const hu = this.get(claimId);
    if (hu?.threshold && !hu.threshold.seen) {
      this.patch(claimId, { threshold: { ...hu.threshold, seen: true } });
    }
  }

  /** Save as draft or submit. Resolves false when the save failed (mock). */
  async save(
    claimId: string,
    changes: Partial<LargeLossHeadsUp>,
    mode: 'draft' | 'submit'
  ): Promise<boolean> {
    await new Promise(r => setTimeout(r, SAVE_MS));
    const hu = this.get(claimId);
    if (!hu) return false;
    if (hu.demoSaveFails) {
      // Fails once, so "Try again" then works.
      this.patch(claimId, { demoSaveFails: false });
      return false;
    }
    const now = new Date().toISOString();
    const who = this.auth.user().name;
    this.patch(claimId, {
      ...changes,
      updatedAt: now,
      updatedBy: who,
      ...(mode === 'submit' ? { status: 'submitted', submittedAt: now, submittedBy: who } : {})
    });
    return true;
  }

  /** Incurred of the claim, in its own currency. */
  incurred(claim: ClaimOverview): number {
    return incurredOf(claim.financialSummary);
  }

  private patch(claimId: string, partial: Partial<LargeLossHeadsUp>): void {
    const hu = this.get(claimId);
    if (!hu) return;
    this.stateSvc.patchOverview(claimId, { headsUp: { ...hu, ...partial } });
  }

  private buildPrefill(claim: ClaimOverview, financialPending: boolean): Partial<Record<PrefillKey, string | null>> {
    const policy = (policiesData as PolicyRow[]).find(p => p.policyNumber === claim.policyNumber);
    const finance = (financeData as unknown as Record<string, FinanceFigures>)[claim.claimId];
    const incurred = incurredOf(claim.financialSummary);
    const loc = claim.location;
    const base: Partial<Record<PrefillKey, string | null>> = {
      lineOfBusiness: claim.lineOfBusiness || null,
      dateOfLoss: claim.dateOfLoss || null,
      oe: OE_BY_COUNTRY[loc?.country ?? ''] ?? null,
      causeOfLoss: claim.proximateLossCause || null,
      countryOfLoss: loc?.country || null,
      lossLocation: loc ? [loc.street, loc.city].filter(Boolean).join(', ') || null : null,
      insuredName: claim.policyHolder || null,
      policyNumber: claim.policyNumber || null,
      inceptionDate: policy?.effectiveDate ?? null,
      expiryDate: policy?.expiryDate ?? null
    };
    if (financialPending) {
      return {
        ...base,
        currency: null,
        priorGross: null,
        currentGross: null,
        priorNet: null,
        currentNet: null,
        artShare: null,
        azreExposure: null
      };
    }
    return {
      ...base,
      currency: claim.financialSummary?.currency ?? null,
      priorGross: finance?.priorGross ?? null,
      currentGross: incurred ? String(incurred) : null,
      priorNet: finance?.priorNet ?? null,
      currentNet: finance?.netShare && incurred ? String(Math.round((incurred * finance.netShare) / 100)) : null,
      artShare: finance?.artShare ?? null,
      azreExposure: finance?.azreExposure ?? null
    };
  }
}
