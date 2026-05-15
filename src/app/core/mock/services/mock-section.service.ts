import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ClaimSection } from '../../models/section.model';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';

@Injectable({ providedIn: 'root' })
export class MockSectionService extends MockBaseService {
  private readonly stateSvc = inject(MockStateService);

  // In-memory mutable state — seeded from MockStateService on first access per claimId
  private readonly cache = new Map<string, ClaimSection[]>();

  private forClaim(claimId: string): ClaimSection[] {
    if (!this.cache.has(claimId)) {
      const seed = this.stateSvc.state().sections
        .filter(s => s.claimId === claimId)
        .map(s => ({ ...s, entities: s.entities.map(e => ({ ...e })) }));
      this.cache.set(claimId, seed);
    }
    return this.cache.get(claimId)!;
  }

  resetCache(): void {
    this.cache.clear();
  }

  getByClaimId(claimId: string): Observable<ClaimSection[]> {
    return this.list(this.forClaim(claimId));
  }

  closeSection(
    sectionId: string,
    closedBy: { userId: string; name: string },
  ): Observable<ClaimSection> {
    for (const [, sections] of this.cache) {
      const target = sections.find(s => s.id === sectionId);
      if (target) {
        target.status      = 'Closed';
        target.closureDate = new Date().toISOString().split('T')[0];
        target.closedBy    = closedBy;
        this.stateSvc.patchSection(sectionId, {
          status:      target.status,
          closureDate: target.closureDate,
          closedBy:    target.closedBy,
        });
        return this.respond({ ...target });
      }
    }
    return this.findById(
      this.stateSvc.state().sections as unknown as Record<string, unknown>[],
      'id',
      sectionId,
    ) as unknown as Observable<ClaimSection>;
  }

  getOpenSectionsCount(claimId: string): Observable<number> {
    const count = this.forClaim(claimId).filter(s => s.status === 'Open').length;
    return this.respond(count);
  }

  getOpenSectionsCount$(claimId: string): Observable<number> {
    return this.getByClaimId(claimId).pipe(
      map(sections => sections.filter(s => s.status === 'Open').length),
    );
  }
}
