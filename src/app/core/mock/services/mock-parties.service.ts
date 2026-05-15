import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { Party, PartyFilters, PartyRole, PartyClaim, PartySection } from '../../models/party.model';
import { MockBaseService } from './mock-base.service';
import rawData from '../data/parties.json';

@Injectable({ providedIn: 'root' })
export class MockPartiesService extends MockBaseService {
  private readonly raw = rawData as Party[];
  private readonly cache = new Map<string, Party[]>();

  getPartiesForPolicy(policyNumber: string): Observable<Party[]> {
    const cached = this.cache.get(policyNumber);
    if (cached) return this.respond(cached);

    // Seed with all parties belonging to FNOL-CURRENT claim by default
    const initial = this.raw
      .filter(p => p.claimId === 'FNOL-CURRENT')
      .map(p => structuredClone(p) as Party);
    this.cache.set(policyNumber, initial);
    return this.respond(initial);
  }

  getClaimsForPolicy(policyNumber: string): Observable<PartyClaim[]> {
    return this.getPartiesForPolicy(policyNumber).pipe(
      map(parties => this.groupByClaim(parties)),
    );
  }

  searchAll(filters: Partial<PartyFilters>): Observable<Party[]> {
    return this.respond(this.applyFilters(this.raw, filters));
  }

  addParty(
    policyNumber: string,
    party: Party,
    targetClaimId: string,
    targetSectionId?: string,
  ): Observable<boolean> {
    return this.getPartiesForPolicy(policyNumber).pipe(
      map(parties => {
        if (parties.some(p => p.partyId === party.partyId)) return false;
        const partyWithTarget: Party = { ...party, claimId: targetClaimId, sectionId: targetSectionId };
        parties.push(partyWithTarget);
        return true;
      }),
    );
  }

  updateParty(policyNumber: string, partyId: string, changes: Partial<Party>): Observable<boolean> {
    return this.getPartiesForPolicy(policyNumber).pipe(
      map(parties => {
        const party = parties.find(p => p.partyId === partyId);
        if (!party) return false;
        Object.assign(party, changes);
        return true;
      }),
    );
  }

  removeParty(policyNumber: string, partyId: string): Observable<boolean> {
    return this.getPartiesForPolicy(policyNumber).pipe(
      map(parties => {
        const idx = parties.findIndex(p => p.partyId === partyId);
        if (idx < 0) return false;
        parties.splice(idx, 1);
        return true;
      }),
    );
  }

  private groupByClaim(parties: Party[]): PartyClaim[] {
    const claimMap = new Map<string, PartyClaim>();

    for (const party of parties) {
      const claimId = party.claimId ?? 'UNASSIGNED';

      if (!claimMap.has(claimId)) {
        claimMap.set(claimId, { claimId, expanded: true, directParties: [], sections: [] });
      }

      const claim = claimMap.get(claimId)!;

      if (!party.sectionId) {
        claim.directParties.push(party);
      } else {
        let section = claim.sections.find(s => s.sectionId === party.sectionId);
        if (!section) {
          section = { sectionId: party.sectionId, expanded: true, parties: [] };
          claim.sections.push(section);
        }
        section.parties.push(party);
      }
    }

    return Array.from(claimMap.values());
  }

  private applyFilters(parties: Party[], filters: Partial<PartyFilters>): Party[] {
    return parties.filter(p => {
      if (filters.legalName && !p.legalName.toLowerCase().includes(filters.legalName.toLowerCase())) return false;
      if (filters.partyRole && !p.roles.includes(filters.partyRole as PartyRole)) return false;
      if (filters.country && p.country !== filters.country) return false;
      if (filters.city && !p.city?.toLowerCase().includes(filters.city.toLowerCase())) return false;
      if (filters.postalCode && !p.postalCode?.includes(filters.postalCode)) return false;
      if (filters.street && !p.street?.toLowerCase().includes(filters.street.toLowerCase())) return false;
      if (filters.partyId && !p.partyId.includes(filters.partyId)) return false;
      if (filters.email && !p.email?.toLowerCase().includes(filters.email.toLowerCase())) return false;
      if (filters.phone && !p.phone?.includes(filters.phone)) return false;
      if (filters.idType && p.idType !== filters.idType) return false;
      if (filters.idNumber && !p.idNumber?.includes(filters.idNumber)) return false;
      if (filters.lineOfBusiness && p.lineOfBusiness !== filters.lineOfBusiness) return false;
      if (filters.operatingEntity && p.operatingEntity !== filters.operatingEntity) return false;
      if (filters.clearanceStatus && p.clearanceStatus !== filters.clearanceStatus) return false;
      return true;
    });
  }
}
