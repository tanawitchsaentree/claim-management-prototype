import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  EntitySearchResult,
  EntitySearchFilters,
  EntityType,
} from '../../models/entity-damage.model';
import { MockBaseService } from './mock-base.service';
import rawData from '../data/searchable-entities.json';

type PolicyEntityMap = Record<EntityType, EntitySearchResult[]>;
type RawDataMap = Record<string, PolicyEntityMap>;

const FALLBACK_POLICY = 'POL-2024-001';

@Injectable({ providedIn: 'root' })
export class MockEntitySearchService extends MockBaseService {
  private readonly data = rawData as unknown as RawDataMap;

  search(
    policyNumber: string,
    entityType: EntityType,
    filters: EntitySearchFilters,
  ): Observable<EntitySearchResult[]> {
    const policyData = this.data[policyNumber] ?? this.data[FALLBACK_POLICY];
    if (!policyData) return this.respond([]);

    const typeData: EntitySearchResult[] = policyData[entityType] ?? [];
    return this.respond(this.applyFilters(typeData, filters));
  }

  private applyFilters(
    results: EntitySearchResult[],
    filters: EntitySearchFilters,
  ): EntitySearchResult[] {
    return results.filter(r => {
      if (filters.country && r.country !== filters.country) return false;
      if (filters.city && !r.city.toLowerCase().includes(filters.city.toLowerCase())) return false;
      if (filters.zipOrPostalCode && r.zipCode !== filters.zipOrPostalCode) return false;
      if (filters.streetAndNumber && !r.streetAndNumber.toLowerCase().includes(filters.streetAndNumber.toLowerCase())) return false;
      if (filters.locationName && !r.locationName.toLowerCase().includes(filters.locationName.toLowerCase())) return false;
      if (filters.locationRuleNumber && r.propertyId !== filters.locationRuleNumber) return false;
      return true;
    });
  }
}
