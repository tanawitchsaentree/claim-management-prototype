import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FnolStateService } from '../../../core/services/fnol-state.service';
import { MockEntitiesDamagesService } from '../../../core/mock/services/mock-entities-damages.service';
import { MockPartiesService } from '../../../core/mock/services/mock-parties.service';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { MockReservesService } from '../../../core/mock/services/mock-reserves.service';
import {
  Reserve,
  ReserveType,
  ReservesStepOverride,
  SubReserve
} from '../../../core/models/reserve.model';
import { selectedSectionGroups } from '../../../shared/components/entities-selection/selected-section-groups';
import { PolicySelectionService } from './policy-selection.service';

export interface ReserveSectionOption {
  key: string; // damage type key, the same key Submit creates the claim section from
  sectionNo: number;
  label: string; // "Section 1: Material damage"
  damageLabel: string; // "Material damage"
  entities: string[]; // the ticked entities in it, offered as "Damage"
}

export interface ReservePartyOption {
  partyId: string;
  partyName: string;
}

/** One claim on the Reserves step: one per policy the FNOL creates a claim on. */
export interface ReserveClaim {
  index: number; // 1-based, "Claim 1"
  policyNumber: string;
  lineOfBusiness: string;
  sections: ReserveSectionOption[];
  parties: ReservePartyOption[];
}

export interface ReserveLinePick {
  sectionKey: string;
  partyId: string;
  damage: string;
  reserveType: ReserveType;
}

/**
 * Builds the claims shown on the FNOL Reserves step. DESIGN DECISION RES-D2:
 * Section = one claim section per damage type with ticked entities (the same
 * rule Submit uses, selectedSectionGroups), Damage = a ticked entity in it,
 * Party = the parties from the Parties step (they go onto every claim, IMP-7).
 * The claims follow the Policies step selection (BMPCC-22665), or are just
 * the searched policy when there was no Policies step.
 */
@Injectable({ providedIn: 'root' })
export class ReserveClaimsService {
  private readonly fnolState = inject(FnolStateService);
  private readonly entitiesSvc = inject(MockEntitiesDamagesService);
  private readonly partiesSvc = inject(MockPartiesService);
  private readonly lookupSvc = inject(MockLookupService);
  private readonly reservesSvc = inject(MockReservesService);
  private readonly selectionSvc = inject(PolicySelectionService);

  claimPolicies(): string[] {
    const sel = this.fnolState.policyStep?.selection;
    return sel?.length ? [...sel] : [this.fnolState.policyNumber];
  }

  async loadClaims(): Promise<ReserveClaim[]> {
    const lead = this.fnolState.policyNumber;
    const policies = this.claimPolicies();
    const [data, parties] = await Promise.all([
      firstValueFrom(this.entitiesSvc.getByPolicyId(lead)),
      firstValueFrom(this.partiesSvc.getPartiesForPolicy(lead))
    ]);
    const typeKeys = (this.fnolState.fnolForm.get('lossInformation.typeOfDamage')?.value ??
      []) as string[];
    const damageLabels = this.lookupSvc.getTypeOfDamageSync();
    const others = policies.filter(p => p !== lead);
    return policies.map((policyNumber, i) => {
      const own = this.selectionSvc.entitiesFor(data, policyNumber, lead, others);
      const sections = [...selectedSectionGroups(own, typeKeys)].map(([key, ents], s) => {
        const damageLabel = damageLabels.find(o => o.value === key)?.label ?? key;
        return {
          key,
          sectionNo: s + 1,
          label: `Section ${s + 1}: ${damageLabel}`,
          damageLabel,
          entities: [...new Set(ents.map(e => e.name))]
        };
      });
      return {
        index: i + 1,
        policyNumber,
        lineOfBusiness: this.selectionSvc.policy(policyNumber)?.lineOfBusiness ?? '-',
        sections,
        parties: parties.map(p => ({ partyId: p.partyId, partyName: p.legalName }))
      };
    });
  }

  /** DESIGN DECISION RES-D5: the same section, party and damage is one line, never two. */
  findLine(claim: ReserveClaim, pick: ReserveLinePick): Reserve | undefined {
    return this.reservesSvc
      .getSync(claim.policyNumber)
      .reserves.find(
        r =>
          r.damageTypeKey === pick.sectionKey &&
          r.partyId === pick.partyId &&
          r.damagedItems?.[0]?.itemName === pick.damage
      );
  }

  newLine(claim: ReserveClaim, pick: ReserveLinePick): Reserve {
    const section = claim.sections.find(s => s.key === pick.sectionKey)!;
    const party = claim.parties.find(p => p.partyId === pick.partyId)!;
    const currency = this.reservesSvc.getSync(claim.policyNumber).currency;
    const reserveId = `RES-${claim.policyNumber}-${Date.now()}`;
    return {
      reserveId,
      sectionNo: section.sectionNo,
      partyId: party.partyId,
      partyName: party.partyName,
      damageType: section.damageLabel,
      damageTypeKey: section.key,
      currency,
      amount: 0,
      subAmounts: { indemnity: 0, expenses: 0, recoveries: 0 },
      damagedItems: [{ damagedItemId: `${reserveId}-DI`, itemName: pick.damage, subReserves: {} }]
    };
  }

  blankSubReserve(line: Reserve, type: ReserveType): SubReserve {
    return {
      subReserveId: `${line.reserveId}-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      subType: '',
      currency: line.currency,
      amount: 0,
      coInsurance: 'NONE'
    };
  }

  /** DEV banner (v2.6 fnolStateOverride.reservesStep), see ReservesStepOverride. */
  async applyScenario(cfg: ReservesStepOverride): Promise<void> {
    const lead = this.fnolState.policyNumber;
    const data = await firstValueFrom(this.entitiesSvc.getByPolicyId(lead));
    for (const e of data.sections.flatMap(s => s.damageGroups).flatMap(g => g.entities)) {
      e.selected = true;
    }
    for (const id of cfg.partyIds) {
      const [party] = await firstValueFrom(this.partiesSvc.searchAll({ partyId: id }));
      if (party) await firstValueFrom(this.partiesSvc.addParty(lead, party, 'FNOL-CURRENT'));
    }
    const claims = await this.loadClaims();
    for (const seed of cfg.seed ?? []) {
      const claim = claims.find(c => c.policyNumber === seed.policyNumber);
      const section = claim?.sections[0];
      if (!claim || !section || !claim.parties.length) continue;
      const line = this.newLine(claim, {
        sectionKey: section.key,
        partyId: claim.parties[0].partyId,
        damage: section.entities[0],
        reserveType: 'indemnity'
      });
      const item = line.damagedItems![0];
      for (const type of ['indemnity', 'expenses', 'recoveries'] as const) {
        const amount = seed[type];
        if (!amount) continue;
        const sub = this.blankSubReserve(line, type);
        sub.subType = this.lookupSvc.getReserveSubTypesForSync(type)[0].label;
        sub.amount = amount;
        item.subReserves[type] = [sub];
      }
      await firstValueFrom(this.reservesSvc.upsertReserve(claim.policyNumber, line));
    }
  }
}
