import { Injectable, inject } from '@angular/core';
import { map, Observable, of, take } from 'rxjs';
import {
  DamageItem, EntitiesDamagesData, EntityRow, EntitySearchResult,
  EntityType, PromiseStatus,
} from '../../models';
import { MockBaseService } from './mock-base.service';
import { ENTITY_TYPE_TO_DAMAGE_GROUP } from '../../../features/fnol/config/entity-damage-mapping';
import { MockLookupService } from './mock-lookup.service';
import rawData from '../data/entities-damages.json';

type RawDataMap = Record<string, EntitiesDamagesData>;

@Injectable({ providedIn: 'root' })
export class MockEntitiesDamagesService extends MockBaseService {
  private readonly raw       = rawData as unknown as RawDataMap;
  private readonly cache     = new Map<string, EntitiesDamagesData>();
  private readonly lookupSvc = inject(MockLookupService);

  // ── Read ────────────────────────────────────────────────────────────────────

  getByPolicyId(policyId: string): Observable<EntitiesDamagesData> {
    const cached = this.cache.get(policyId);
    if (cached) return this.respond(cached);

    const source = this.raw[policyId] ?? this.raw['POL-2024-001'];
    if (!source) {
      const empty: EntitiesDamagesData = { sections: [] };
      this.cache.set(policyId, empty);
      return this.respond(empty);
    }

    const fresh = this.deepClone(source);
    this.cache.set(policyId, fresh);
    return this.respond(fresh);
  }

  resetState(policyId?: string): void {
    if (policyId) this.cache.delete(policyId);
    else          this.cache.clear();
  }

  // ── Entity CRUD ─────────────────────────────────────────────────────────────

  addEntityFromSearch(
    policyId: string,
    result: EntitySearchResult,
    entityType: EntityType,
  ): Observable<EntityRow> {
    return this.getByPolicyId(policyId).pipe(
      take(1),
      map(data => {
        const route = ENTITY_TYPE_TO_DAMAGE_GROUP[entityType];
        const entity: EntityRow = {
          entityId:      `ENT-NEW-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name:          result.locationName,
          status:        'promised',
          promiseStatus: 'possibly-promised',
          limit:         '—',
          coveredBy:     '—',
          documentsCount: 0,
          selected:      false,
          expanded:      false,
          recentlyAdded: true,
          damageTypeKey: route.damageTypeKey,
          entityType,
          propertyId:    result.propertyId,
        };
        this.insertIntoData(data, entity, 'possibly-promised', route.damageTypeKey, route.damageType);
        return entity;
      }),
    );
  }

  /**
   * Pull every entity from a sibling policy into the tree the handler is
   * currently looking at, so those entities become selectable on this claim.
   *
   * Entities keep their own IDs (unique across the source data) and their own
   * promise-status / damage-group placement — an entity's cover does not change
   * because a second policy joined the claim. Only `coveredBy` is rewritten, to
   * append the originating policy number: the handler needs to see that this
   * limit comes from somewhere other than the policy they picked in FNOL, and
   * that column is the one already asking "covered by what?".
   */
  addEntitiesFromPolicy(basePolicyId: string, sourcePolicyId: string): Observable<number> {
    return this.getByPolicyId(basePolicyId).pipe(
      take(1),
      map(data => {
        const source = this.raw[sourcePolicyId];
        if (!source) return 0;

        let added = 0;
        for (const section of source.sections) {
          for (const group of section.damageGroups) {
            for (const entity of group.entities) {
              const copy: EntityRow = {
                ...entity,
                coveredBy:     `${entity.coveredBy} · ${sourcePolicyId}`,
                selected:      false,
                expanded:      false,
                recentlyAdded: true,
                subItems:      entity.subItems?.map(si => ({ ...si, selected: false })),
                damageItems:   entity.damageItems?.map(d => ({ ...d, documents: d.documents ? [...d.documents] : [] })),
              };
              this.insertIntoData(data, copy, section.promiseStatus, group.damageTypeKey, group.damageType);
              added++;
            }
          }
        }
        return added;
      }),
    );
  }

  moveEntity(
    policyId: string,
    entityId: string,
    targetSection: PromiseStatus,
    targetGroupKey: string,
  ): Observable<boolean> {
    return this.getByPolicyId(policyId).pipe(
      take(1),
      map(data => {
        let found: EntityRow | undefined;
        for (const section of data.sections) {
          for (const group of section.damageGroups) {
            const idx = group.entities.findIndex(e => e.entityId === entityId);
            if (idx >= 0) { found = group.entities.splice(idx, 1)[0]; break; }
          }
          if (found) break;
        }
        if (!found) return false;
        found.promiseStatus = targetSection;
        found.damageTypeKey = targetGroupKey;
        const groupLabel = this.lookupSvc.getTypeOfDamageSync().find(o => o.value === targetGroupKey)?.label ?? targetGroupKey;
        this.insertIntoData(data, found, targetSection, targetGroupKey, groupLabel);
        return true;
      }),
    );
  }

  removeEntity(policyId: string, entityId: string): Observable<boolean> {
    return this.getByPolicyId(policyId).pipe(
      take(1),
      map(data => {
        for (const section of data.sections) {
          for (const group of section.damageGroups) {
            const idx = group.entities.findIndex(e => e.entityId === entityId);
            if (idx >= 0) { group.entities.splice(idx, 1); return true; }
          }
        }
        return false;
      }),
    );
  }

  // ── Damage item CRUD (Phase D) ───────────────────────────────────────────────

  addDamageItem(policyId: string, entityId: string, item: DamageItem): Observable<boolean> {
    return this.getByPolicyId(policyId).pipe(
      take(1),
      map(data => {
        const entity = this.findEntity(data, entityId);
        if (!entity) return false;
        entity.damageItems = entity.damageItems ?? [];
        entity.damageItems.push(item);
        return true;
      }),
    );
  }

  removeDamageItem(policyId: string, entityId: string, itemId: string): Observable<boolean> {
    return this.getByPolicyId(policyId).pipe(
      take(1),
      map(data => {
        const entity = this.findEntity(data, entityId);
        if (!entity?.damageItems) return false;
        const idx = entity.damageItems.findIndex(d => d.itemId === itemId);
        if (idx >= 0) { entity.damageItems.splice(idx, 1); return true; }
        return false;
      }),
    );
  }

  updateDamageItem(
    policyId: string,
    entityId: string,
    itemId: string,
    changes: Partial<DamageItem>,
  ): Observable<boolean> {
    return this.getByPolicyId(policyId).pipe(
      take(1),
      map(data => {
        const entity = this.findEntity(data, entityId);
        const item = entity?.damageItems?.find(d => d.itemId === itemId);
        if (!item) return false;
        Object.assign(item, changes);
        return true;
      }),
    );
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private insertIntoData(
    data: EntitiesDamagesData,
    entity: EntityRow,
    sectionKey: PromiseStatus,
    groupKey: string,
    groupLabel: string,
  ): void {
    let section = data.sections.find(s => s.promiseStatus === sectionKey);
    if (!section) {
      const label = sectionKey === 'possibly-promised'
        ? 'Possibly promised entities' : 'Not promised entities';
      section = { promiseStatus: sectionKey, label, expanded: true, damageGroups: [] };
      data.sections.unshift(section);
    }
    let group = section.damageGroups.find(g => g.damageTypeKey === groupKey);
    if (!group) {
      group = { damageType: groupLabel, damageTypeKey: groupKey, expanded: true, entities: [] };
      section.damageGroups.push(group);
    }
    group.entities.push(entity);
  }

  private findEntity(data: EntitiesDamagesData, entityId: string): EntityRow | undefined {
    for (const section of data.sections)
      for (const group of section.damageGroups) {
        const found = group.entities.find(e => e.entityId === entityId);
        if (found) return found;
      }
    return undefined;
  }

  private deepClone(source: EntitiesDamagesData): EntitiesDamagesData {
    return {
      sections: source.sections.map(s => ({
        ...s,
        expanded: true,
        damageGroups: s.damageGroups.map(g => ({
          ...g,
          expanded: true,
          entities: g.entities.map(e => ({
            ...e,
            expanded:    false,
            selected:    false,
            subItems:    e.subItems?.map(si => ({ ...si, selected: false })),
            damageItems: e.damageItems?.map(d => ({ ...d, documents: d.documents ? [...d.documents] : [] })),
          })),
        })),
      })),
    };
  }
}
