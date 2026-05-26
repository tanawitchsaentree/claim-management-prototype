import { inject, Injectable } from '@angular/core';
import { combineLatest, map, Observable, of, take } from 'rxjs';
import { Reserve, ReserveNarrative, ReservesPolicyData, DamagedItem, SubReserve } from '../../models/reserve.model';
import { MockPartiesService } from './mock-parties.service';
import { MockEntitiesDamagesService } from './mock-entities-damages.service';

// Cross-policy mock seed — lets the right-panel "all policies" mode show
// rich data even before the user runs the FNOL flow on each policy.
export interface PolicySeed {
  policyNumber: string;
  policyLabel:  string;          // e.g. "Property — POL-2024-001 — Liver Tea Group"
  parties:      Array<{ partyId: string; partyName: string }>;
  damageTypes:  Array<{ key: string; label: string }>;
  allianzShare: number;
  currency:     string;
}

const POLICY_SEEDS: PolicySeed[] = [
  {
    policyNumber: 'POL-2024-001',
    policyLabel:  'Property — POL-2024-001 — Liver Tea Group',
    parties: [
      { partyId: 'P-LTG-1', partyName: 'Otto Kaufmann' },
      { partyId: 'P-LTG-2', partyName: 'Martha Nielsen' },
    ],
    damageTypes: [
      { key: 'material-damage',  label: 'Material damage' },
      { key: 'bodily-injury',    label: 'Bodily injury' },
      { key: 'financial-loss',   label: 'Financial loss' },
    ],
    allianzShare: 50,
    currency: 'EUR',
  },
  {
    policyNumber: 'POL-2024-002',
    policyLabel:  'Cyber — POL-2024-002 — adesso SE',
    parties: [{ partyId: 'P-ADS-1', partyName: 'Björn Ö’Brien' }],
    damageTypes: [
      { key: 'cyber',          label: 'Cyber incident' },
      { key: 'business-int',   label: 'Business interruption' },
    ],
    allianzShare: 35,
    currency: 'EUR',
  },
  {
    policyNumber: 'POL-2024-003',
    policyLabel:  'Marine — POL-2024-003 — GBF Logistics',
    parties: [
      { partyId: 'P-GBF-1', partyName: 'Captain Vogel' },
      { partyId: 'P-GBF-2', partyName: 'Hapag Crew Ltd.' },
    ],
    damageTypes: [
      { key: 'cargo-damage', label: 'Cargo damage' },
      { key: 'hull-damage',  label: 'Hull damage' },
    ],
    allianzShare: 60,
    currency: 'USD',
  },
  {
    policyNumber: 'POL-2024-006',
    policyLabel:  'Property — POL-2024-006 — Schäfer & Söhne',
    parties: [{ partyId: 'P-SCH-1', partyName: 'Lukas Schäfer' }],
    damageTypes: [{ key: 'material-damage', label: 'Material damage' }],
    allianzShare: 40,
    currency: 'CHF',
  },
];

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

        const buildDamagedItems = (sectionPrefix: string): DamagedItem[] => {
          const itemSeeds = [
            { name: "Kaufmann's Warehouse: Gate", indemnity: 2000,  expenses: 0,    recoveries: 0    },
            { name: 'MDT3562: Burnt tires',        indemnity: 10000, expenses: 0,    recoveries: 0    },
            { name: 'MDT8921: Burnt tires',        indemnity: 18000, expenses: 10000, recoveries: 10000 },
          ];
          return itemSeeds.map((s, i) => {
            const itemId = `${sectionPrefix}-DI-${i + 1}`;
            const mk = (type: 'indemnity' | 'expenses' | 'recoveries', amt: number): SubReserve[] =>
              amt > 0
                ? [{
                    subReserveId: `${itemId}-${type}-1`,
                    subType: 'Lorem ipsum',
                    currency: 'EUR',
                    amount: amt,
                    coInsurance: 'RI',
                  }]
                : [];
            return {
              damagedItemId: itemId,
              itemName: s.name,
              expanded: i === 0,
              subReserves: {
                indemnity:  mk('indemnity',  s.indemnity),
                expenses:   mk('expenses',   s.expenses),
                recoveries: mk('recoveries', s.recoveries),
              },
            } satisfies DamagedItem;
          });
        };

        for (const party of parties) {
          for (const [damageTypeKey, damageType] of damageMap) {
            const sectionPrefix = `RES-${policyNumber}-${sectionNo}`;
            const items = buildDamagedItems(sectionPrefix);
            const sumByType = (type: 'indemnity' | 'expenses' | 'recoveries'): number =>
              items.reduce(
                (sum, it) => sum + (it.subReserves[type] ?? []).reduce((s, r) => s + r.amount, 0),
                0,
              );
            reserves.push({
              reserveId:        sectionPrefix,
              sectionNo:        sectionNo++,
              partyId:          party.partyId,
              partyName:        party.legalName,
              damageType,
              damageTypeKey,
              currency:         'EUR',
              amount:           sumByType('indemnity') + sumByType('expenses') + sumByType('recoveries'),
              limit:            50000,
              subAmounts: {
                indemnity:  sumByType('indemnity'),
                expenses:   sumByType('expenses'),
                recoveries: sumByType('recoveries'),
              },
              damagedItems:     items,
              damagedItemLevel: true,
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
              limit:        50000,
              subAmounts:   { indemnity: 0, expenses: 0, recoveries: 0 },
              damagedItems: [],
              damagedItemLevel: false,
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

  getReservesForAllPolicies(): Observable<ReservesPolicyData[]> {
    const out = POLICY_SEEDS.map(seed => this.buildFromSeed(seed));
    return of(out);
  }

  policySeeds(): PolicySeed[] {
    return POLICY_SEEDS;
  }

  private buildFromSeed(seed: PolicySeed): ReservesPolicyData {
    const cached = this.cache.get(seed.policyNumber);
    if (cached) return cached;

    const reserves: Reserve[] = [];
    let sectionNo = 1;

    for (const party of seed.parties) {
      for (const dmg of seed.damageTypes) {
        const sectionPrefix = `RES-${seed.policyNumber}-${sectionNo}`;
        const items = this.buildSeedDamagedItems(sectionPrefix, seed.currency);
        const sumByType = (type: 'indemnity' | 'expenses' | 'recoveries'): number =>
          items.reduce(
            (sum, it) => sum + (it.subReserves[type] ?? []).reduce((s, r) => s + r.amount, 0),
            0,
          );
        reserves.push({
          reserveId:        sectionPrefix,
          sectionNo:        sectionNo++,
          partyId:          party.partyId,
          partyName:        party.partyName,
          damageType:       dmg.label,
          damageTypeKey:    dmg.key,
          currency:         seed.currency,
          amount:           sumByType('indemnity') + sumByType('expenses') + sumByType('recoveries'),
          limit:            50000,
          subAmounts: {
            indemnity:  sumByType('indemnity'),
            expenses:   sumByType('expenses'),
            recoveries: sumByType('recoveries'),
          },
          damagedItems:     items,
          damagedItemLevel: true,
        });
      }
    }

    const data: ReservesPolicyData = {
      policyNumber: seed.policyNumber,
      allianzShare: seed.allianzShare,
      currency:     seed.currency,
      totalReserve: reserves.reduce((sum, r) => sum + (r.amount || 0), 0),
      reserves,
    };
    this.cache.set(seed.policyNumber, data);
    return data;
  }

  private buildSeedDamagedItems(sectionPrefix: string, currency: string): DamagedItem[] {
    const itemSeeds = [
      { name: "Kaufmann's Warehouse: Gate", indemnity: 2000,  expenses: 0,    recoveries: 0    },
      { name: 'MDT3562: Burnt tires',        indemnity: 10000, expenses: 0,    recoveries: 0    },
      { name: 'MDT8921: Burnt tires',        indemnity: 18000, expenses: 10000, recoveries: 10000 },
    ];
    return itemSeeds.map((s, i) => {
      const itemId = `${sectionPrefix}-DI-${i + 1}`;
      const mk = (type: 'indemnity' | 'expenses' | 'recoveries', amt: number): SubReserve[] =>
        amt > 0
          ? [{
              subReserveId: `${itemId}-${type}-1`,
              subType: 'Lorem ipsum',
              currency,
              amount: amt,
              coInsurance: 'RI',
            }]
          : [];
      return {
        damagedItemId: itemId,
        itemName: s.name,
        expanded: i === 0,
        subReserves: {
          indemnity:  mk('indemnity',  s.indemnity),
          expenses:   mk('expenses',   s.expenses),
          recoveries: mk('recoveries', s.recoveries),
        },
      } satisfies DamagedItem;
    });
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

  // Replace one reserve row whole-cloth (used by the right-panel detail editor
  // to commit nested damagedItems edits back to the cache).
  replaceReserve(policyNumber: string, reserve: Reserve): Observable<boolean> {
    return this.getReservesForPolicy(policyNumber).pipe(
      take(1),
      map(data => {
        const idx = data.reserves.findIndex(r => r.reserveId === reserve.reserveId);
        if (idx < 0) return false;
        data.reserves[idx] = { ...reserve };
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
