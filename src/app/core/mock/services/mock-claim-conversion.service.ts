import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Claim } from '../../models/claim.model';
import { Party } from '../../models/party.model';
import { causeLabel } from '../../models/cause-of-loss';
import { MockClaimService } from './mock-claim.service';
import { MockLookupService } from './mock-lookup.service';
import { MockPartiesService } from './mock-parties.service';
import { MockLossEventService } from './mock-loss-event.service';
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

// What a Link policy writes beyond the link itself: the claim's loss event and
// its parties. Split out of MockClaimOverviewService.convertToRegularClaim.
@Injectable({ providedIn: 'root' })
export class MockClaimConversionService {
  private readonly claimSvc = inject(MockClaimService);
  private readonly lookupSvc = inject(MockLookupService);
  private readonly partiesSvc = inject(MockPartiesService);
  private readonly lossEventSvc = inject(MockLossEventService);

  /** Creates the loss event for this claim and attaches it (kept if the claim already has one). */
  async attachLossEvent(claim: Claim): Promise<Claim> {
    if (claim.lossEventId) return claim;
    const opts = this.lookupSvc.getCauseOfLossSync();
    const labels = (claim.causeOfLoss ?? []).map(c => causeLabel(c, opts));
    const id = this.lossEventSvc.createForClaim(claim, labels, 0);
    return firstValueFrom(this.claimSvc.update(claim.claimId, { lossEventId: id }));
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
