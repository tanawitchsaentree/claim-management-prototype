import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ClaimSection, SectionClosureReason, SectionEntity } from '../../models/section.model';
import { ClaimActivity } from '../../models/claim-overview.model';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';
import { ToastService } from '../../../shared/components/toast/toast.service';

@Injectable({ providedIn: 'root' })
export class MockSectionService extends MockBaseService {
  private readonly stateSvc = inject(MockStateService);
  private readonly toast    = inject(ToastService);

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
    closureReason?: SectionClosureReason,
  ): Observable<ClaimSection> {
    for (const [, sections] of this.cache) {
      const target = sections.find(s => s.id === sectionId);
      if (target) {
        target.status        = 'Closed';
        target.closureDate   = new Date().toISOString().split('T')[0];
        target.closedBy      = closedBy;
        target.closureReason = closureReason;
        this.stateSvc.patchSection(sectionId, {
          status:        target.status,
          closureDate:   target.closureDate,
          closedBy:      target.closedBy,
          closureReason: target.closureReason,
        });
        const activity: ClaimActivity = {
          id:         `act-sec-close-${Date.now()}`,
          claimId:    target.claimId,
          user:       closedBy.name,
          timestamp:  new Date().toISOString(),
          objectType: 'Section',
          attribute:  'Status',
          valueOld:   'Open',
          valueNew:   'Closed',
        };
        this.stateSvc.patchActivities(items => [activity, ...items]);
        this.toast.success(`Section ${sectionId} closed`, closureReason);
        return this.respond({ ...target });
      }
    }
    return this.findById(
      this.stateSvc.state().sections as unknown as Record<string, unknown>[],
      'id',
      sectionId,
    ) as unknown as Observable<ClaimSection>;
  }

  patchEntity(sectionId: string, entityId: string, patch: Partial<SectionEntity>): Observable<SectionEntity> {
    for (const [, sections] of this.cache) {
      const section = sections.find(s => s.id === sectionId);
      if (!section) continue;
      const idx = section.entities.findIndex(e => e.id === entityId);
      if (idx === -1) continue;
      const updated = { ...section.entities[idx], ...patch };
      section.entities = section.entities.map((e, i) => i === idx ? updated : e);
      this.stateSvc.patchSection(sectionId, { entities: [...section.entities] });
      const activity: ClaimActivity = {
        id:         `act-entity-edit-${Date.now()}`,
        claimId:    section.claimId,
        user:       'Leonie Fischer',
        timestamp:  new Date().toISOString(),
        objectType: 'Section Entity',
        attribute:  'Damage type',
        valueOld:   section.entities[idx]?.damage ?? '',
        valueNew:   patch.damage ?? updated.damage,
      };
      this.stateSvc.patchActivities(items => [activity, ...items]);
      return this.respond({ ...updated });
    }
    return this.respond({} as SectionEntity);
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
