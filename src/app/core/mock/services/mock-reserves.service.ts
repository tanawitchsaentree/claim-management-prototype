import { inject, Injectable } from '@angular/core';
import { combineLatest, map, Observable, of, take } from 'rxjs';
import { Reserve, ReserveNarrative, ReservesPolicyData } from '../../models/reserve.model';
import { MockPartiesService } from './mock-parties.service';
import { MockEntitiesDamagesService } from './mock-entities-damages.service';

@Injectable({ providedIn: 'root' })
export class MockReservesService {
  private readonly partiesSvc  = inject(MockPartiesService);
  private readonly entitiesSvc = inject(MockEntitiesDamagesService);
  private readonly cache       = new Map<string, ReservesPolicyData>();

  getReservesForPolicy(policyNumber: string): Observable<ReservesPolicyData> {
    const cached = this.cache.get(policyNumber);
    if (cached) return of(cached);

    return combineLatest([
      this.partiesSvc.getPartiesForPolicy(policyNumber),
      this.entitiesSvc.getByPolicyId(policyNumber),
    ]).pipe(
      take(1),
      map(([parties, entitiesData]) => {
        // Collect unique damage types present across all sections
        const damageMap = new Map<string, string>(); // key → label
        for (const section of entitiesData.sections) {
          for (const group of section.damageGroups) {
            if (group.entities.length > 0) {
              damageMap.set(group.damageTypeKey, group.damageType);
            }
          }
        }

        // Generate 1 reserve row per (party × damage type), amount = 0
        const reserves: Reserve[] = [];
        let sectionNo = 1;

        for (const party of parties) {
          for (const [damageTypeKey, damageType] of damageMap) {
            reserves.push({
              reserveId:    `RES-${policyNumber}-${sectionNo}`,
              sectionNo:    sectionNo++,
              partyId:      party.partyId,
              partyName:    party.legalName,
              damageType,
              damageTypeKey,
              currency:     'EUR',
              amount:       0,
            });
          }
        }

        // Fallback: if no entities yet, seed from parties only (1 row each, no damage)
        if (reserves.length === 0) {
          for (const party of parties) {
            reserves.push({
              reserveId:    `RES-${policyNumber}-${sectionNo}`,
              sectionNo:    sectionNo++,
              partyId:      party.partyId,
              partyName:    party.legalName,
              damageType:   '—',
              damageTypeKey: 'unknown',
              currency:     'EUR',
              amount:       0,
            });
          }
        }

        const data: ReservesPolicyData = {
          policyNumber,
          allianzShare: 50,
          currency: 'EUR',
          totalReserve: 0,
          reserves,
        };
        this.cache.set(policyNumber, data);
        return data;
      }),
    );
  }

  addReserve(policyNumber: string, reserve: Omit<Reserve, 'reserveId' | 'sectionNo'>): Observable<boolean> {
    return this.getReservesForPolicy(policyNumber).pipe(
      take(1),
      map(data => {
        const nextSection = data.reserves.length + 1;
        data.reserves.push({
          ...reserve,
          reserveId:    `RES-${policyNumber}-${nextSection}`,
          sectionNo:    nextSection,
          recentlyAdded: true,
        });
        this.recalculate(data);
        return true;
      }),
    );
  }

  updateReserve(policyNumber: string, reserveId: string, changes: Partial<Reserve>): Observable<boolean> {
    return this.getReservesForPolicy(policyNumber).pipe(
      take(1),
      map(data => {
        const reserve = data.reserves.find(r => r.reserveId === reserveId);
        if (!reserve) return false;
        Object.assign(reserve, changes);
        this.recalculate(data);
        return true;
      }),
    );
  }

  removeReserve(policyNumber: string, reserveId: string): Observable<boolean> {
    return this.getReservesForPolicy(policyNumber).pipe(
      take(1),
      map(data => {
        const idx = data.reserves.findIndex(r => r.reserveId === reserveId);
        if (idx < 0) return false;
        data.reserves.splice(idx, 1);
        data.reserves.forEach((r, i) => r.sectionNo = i + 1);
        this.recalculate(data);
        return true;
      }),
    );
  }

  setNarrative(policyNumber: string, narrative: ReserveNarrative): Observable<boolean> {
    return this.getReservesForPolicy(policyNumber).pipe(
      take(1),
      map(data => {
        data.narrative = { ...narrative, savedAt: new Date().toISOString() };
        return true;
      }),
    );
  }

  archiveNarrative(policyNumber: string): Observable<boolean> {
    return this.getReservesForPolicy(policyNumber).pipe(
      take(1),
      map(data => {
        if (!data.narrative || data.narrative.archivedAt) return false;
        data.narrative = { ...data.narrative, archivedAt: new Date().toISOString() };
        return true;
      }),
    );
  }

  private recalculate(data: ReservesPolicyData): void {
    data.totalReserve = data.reserves.reduce((sum, r) => sum + (r.amount || 0), 0);
  }
}
