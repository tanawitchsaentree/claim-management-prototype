import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Claim } from '../../models/claim.model';
import { ClaimActivity } from '../../models/claim-overview.model';
import { CompletionDetails } from '../../models/claim-completion.model';
import { LossInformationFormValue } from '../../models/loss-information.model';
import { ClaimSection } from '../../models/section.model';
import { Party } from '../../models/party.model';
import { causeLabel } from '../../models/cause-of-loss';
import { formatLocationItem } from '../../models/location-picker.model';
import { cbiRelationshipFor } from '../../../shared/utils/cbi-rules';
import { MockClaimService } from './mock-claim.service';
import { MockLookupService } from './mock-lookup.service';
import { MockLossInformationService } from './mock-loss-information.service';
import { MockSectionService } from './mock-section.service';
import { MockFinancialOverviewService } from './mock-financial-overview.service';
import { MockPartiesService } from './mock-parties.service';
import { MockStateService } from '../state/mock-state.service';
import policiesData from '../data/policies.json';

interface LinkedPolicy {
  policyNumber: string;
  broker?: string;
}

interface PolicyRecord {
  policyNumber: string;
  clientNameCode?: string;
  broker?: string;
  brokerNameCode?: string;
}

// What a Link policy writes beyond the link itself: the details the handler
// confirmed, the sections built from the ticked coverages, the first reserves,
// and the claim's parties. Split out of MockClaimOverviewService.convertToRegularClaim.
@Injectable({ providedIn: 'root' })
export class MockClaimConversionService {
  private readonly claimSvc = inject(MockClaimService);
  private readonly lookupSvc = inject(MockLookupService);
  private readonly lossInfoSvc = inject(MockLossInformationService);
  private readonly sectionSvc = inject(MockSectionService);
  private readonly financeSvc = inject(MockFinancialOverviewService);
  private readonly partiesSvc = inject(MockPartiesService);
  private readonly stateSvc = inject(MockStateService);

  /** Writes the description, cause, location and CBI answers the handler confirmed. */
  async applyDetails(claim: Claim, d: CompletionDetails): Promise<Claim> {
    const opts = this.lookupSvc.getCauseOfLossSync();
    const labels = (codes: string[] | undefined): string => (codes ?? []).map(c => causeLabel(c, opts)).join(', ') || '–';
    const first = d.location?.locations[0];
    const updated = await firstValueFrom(
      this.claimSvc.update(claim.claimId, {
        description: d.lossDescription,
        causeOfLoss: d.causeOfLoss,
        ...(first ? { location: { city: first.city ?? '', country: first.country ?? '' } } : {})
      })
    );
    const li = await firstValueFrom(this.lossInfoSvc.getByClaimId(claim.claimId));
    if (li) {
      await firstValueFrom(
        this.lossInfoSvc.save(
          {
            ...li,
            causeOfLoss: d.causeOfLoss,
            lossDescription: d.lossDescription,
            specifyOtherCauseOfLoss: d.specifyOtherCauseOfLoss,
            ...(d.location ? { lossLocation: d.location } : {}),
            ...(d.cbi ?? {})
          } as unknown as LossInformationFormValue,
          claim.claimId
        )
      );
    }
    const base = { claimId: claim.claimId, user: claim.assignee ?? 'Unassigned', objectType: 'Claim' as const };
    const stamp = (n: string): { id: string; timestamp: string } => ({ id: `act-${n}-${Date.now()}`, timestamp: new Date().toISOString() });
    const rows: ClaimActivity[] = [];
    if (labels(claim.causeOfLoss) !== labels(d.causeOfLoss)) {
      rows.push({ ...base, ...stamp('cause'), attribute: 'Cause of loss', valueOld: labels(claim.causeOfLoss), valueNew: labels(d.causeOfLoss) });
    }
    if ((claim.description ?? '') !== d.lossDescription) {
      rows.push({ ...base, ...stamp('desc'), attribute: 'Loss description', valueOld: claim.description || '–', valueNew: d.lossDescription });
    }
    if (rows.length) this.stateSvc.patchActivities(items => [...rows, ...items]);
    return updated;
  }

  /**
   * One section per ticked damage type (same rule as FNOL submit). The placeholder
   * section a skeleton was given from its cause is replaced, not kept beside them.
   */
  async createSections(claim: Claim, d: CompletionDetails | undefined): Promise<ClaimSection[]> {
    const plans = d?.sections ?? [];
    if (!plans.length) return [];
    const prior = this.sectionSvc.getByClaimIdSync(claim.claimId).map(s => s.id);
    const cbi = d?.cbi?.cbiApplicable === 'yes' ? d.cbi : null;
    const creator = { userId: 'U001', name: claim.assignee ?? 'Unassigned' };
    const made: ClaimSection[] = [];
    for (const plan of plans) {
      const place = cbi?.cbiLocation.locations[0];
      const extras =
        cbi && cbi.cbiCaseType && plan.damageType === 'business-interruption'
          ? {
              isContingentBi: true,
              cbiCaseType: cbi.cbiCaseType,
              thirdPartyName: cbi.cbiThirdPartyName || undefined,
              thirdPartyRelationship: cbiRelationshipFor(cbi.cbiCaseType),
              thirdPartyIndustry: cbi.cbiThirdPartyIndustry || undefined,
              cbiOriginatingLocation: place ? formatLocationItem(place) : undefined,
              cbiOriginatingLocationDetail: place
            }
          : {};
      made.push(
        await firstValueFrom(
          this.sectionSvc.createSection(
            claim.claimId,
            plan.damageType,
            plan.entityNames.map(name => ({ name, instructionStatus: 'Not assigned' as const, ...extras })),
            creator
          )
        )
      );
    }
    this.sectionSvc.removeSections(claim.claimId, prior);
    return made;
  }

  /** The optional first reserves, one per section the handler gave an amount. Returns how many were set. */
  async addReserves(claim: Claim, d: CompletionDetails | undefined, sections: ClaimSection[]): Promise<number> {
    const types = this.lookupSvc.getReserveTypesSync();
    const subs = this.lookupSvc.getReserveSubTypesSync();
    const labelOf = (list: { value: string; label: string }[], v: string): string => list.find(o => o.value === v)?.label ?? v;
    let count = 0;
    for (const r of d?.reserves ?? []) {
      const section = sections[r.sectionIndex];
      if (!section) continue;
      await firstValueFrom(
        this.financeSvc.addReserve(claim.claimId, {
          party: claim.clientName,
          damagedItem: '',
          section: section.id,
          reserveType: labelOf(types, r.reserveType),
          reserveSubType: labelOf(subs, r.reserveSubType),
          status: 'Pending',
          reserveValue: r.amount,
          currency: 'EUR'
        })
      );
      count++;
    }
    return count;
  }

  /**
   * The insured (the client) and the broker from the policy join the claim's
   * parties, so the claim's Parties and Make payment's payee list have them.
   * Parties typed during skeleton creation are already on the claim. There is no
   * underwriter in the policy data, so none is added.
   */
  addParties(claim: Claim, policy: LinkedPolicy): void {
    const rec = (policiesData as PolicyRecord[]).find(p => p.policyNumber === policy.policyNumber);
    const parties: Party[] = [
      {
        partyId: `AZ-${rec?.clientNameCode ?? claim.claimId + '-insured'}`,
        legalName: claim.clientName,
        roles: ['client', 'insured'],
        clearanceStatus: 'cleared',
        city: claim.location?.city,
        country: claim.location?.country,
        ggNameCode: rec?.clientNameCode
      }
    ];
    const broker = policy.broker ?? rec?.broker;
    if (broker) {
      parties.push({
        partyId: `AZ-${rec?.brokerNameCode ?? claim.claimId + '-broker'}`,
        legalName: broker,
        roles: ['broker'],
        clearanceStatus: 'cleared',
        ggNameCode: rec?.brokerNameCode
      });
    }
    this.partiesSvc.addPartiesToClaim(claim.claimId, parties);
  }
}
