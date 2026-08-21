import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ClaimSection, InstructionStatus, SectionClosureReason, SectionReopenReason, SectionEntity } from '../../models/section.model';
import { ClaimActivity } from '../../models/claim-overview.model';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';
import { MockLookupService } from './mock-lookup.service';
import { ToastService } from '../../../shared/components/toast/toast.service';

@Injectable({ providedIn: 'root' })
export class MockSectionService extends MockBaseService {
  private readonly stateSvc  = inject(MockStateService);
  private readonly lookupSvc = inject(MockLookupService);
  private readonly toast     = inject(ToastService);

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

  // Section creation primitive (Stage 3, FNOL/claim-file model fix). A
  // section IS an entity x damage-type pairing — this is the one place that
  // pairing gets made. Used by both FNOL step 2's submit conversion (Stage 4)
  // and the claim file's "Add damage type" action (Stage 8), so the two
  // surfaces can't drift into creating sections shaped differently.
  createSection(
    claimId: string,
    damageType: string,
    entities: Array<{ name: string; instructionStatus?: InstructionStatus }>,
    createdBy: { userId: string; name: string } = { userId: 'usr-lf', name: 'Leonie Fischer' },
  ): Observable<ClaimSection> {
    const sections = this.forClaim(claimId);
    const label = this.lookupSvc.getTypeOfDamageSync().find(o => o.value === damageType)?.label ?? damageType;
    const now = Date.now();
    const newSection: ClaimSection = {
      id:      `SEC-${now}`,
      claimId,
      name:    entities[0]?.name ? `${label} — ${entities[0].name}` : label,
      damageType,
      status:  'Open',
      expanded: true,
      hasOpenDeductible:   false,
      hasActiveLitigation: false,
      hasSubrogation:      false,
      hasActiveSalvage:    false,
      hasOpenReserves:     false,
      hasOpenPayments:     false,
      hasActiveProvider:   false,
      entities: entities.map((e, i) => ({
        id:                `SE-${now}-${i}`,
        name:              e.name,
        instructionStatus: e.instructionStatus ?? 'Not assigned',
        expandable:        false,
      })),
    };
    sections.push(newSection);
    this.stateSvc.appendSections([newSection]);

    const activity: ClaimActivity = {
      id:         `act-sec-create-${now}`,
      claimId,
      user:       createdBy.name,
      timestamp:  new Date().toISOString(),
      objectType: 'Section',
      attribute:  'Created',
      valueOld:   null,
      valueNew:   `${newSection.name} (${label})`,
    };
    this.stateSvc.patchActivities(items => [activity, ...items]);

    return this.respond({ ...newSection });
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

  reopenSection(
    sectionId: string,
    reopenedBy: { userId: string; name: string },
    reopeningReason: SectionReopenReason,
  ): Observable<ClaimSection> {
    for (const [, sections] of this.cache) {
      const target = sections.find(s => s.id === sectionId);
      if (target) {
        target.status          = 'Open';
        target.reopenedDate    = new Date().toISOString().split('T')[0];
        target.reopenedBy      = reopenedBy;
        target.reopeningReason = reopeningReason;
        this.stateSvc.patchSection(sectionId, {
          status:          target.status,
          reopenedDate:    target.reopenedDate,
          reopenedBy:      target.reopenedBy,
          reopeningReason: target.reopeningReason,
        });
        const activity: ClaimActivity = {
          id:         `act-sec-reopen-${Date.now()}`,
          claimId:    target.claimId,
          user:       reopenedBy.name,
          timestamp:  new Date().toISOString(),
          objectType: 'Section',
          attribute:  'Status',
          valueOld:   'Closed',
          valueNew:   'Open',
        };
        this.stateSvc.patchActivities(items => [activity, ...items]);
        return this.respond({ ...target });
      }
    }
    return this.respond({} as ClaimSection);
  }

  patchSection(sectionId: string, patch: Partial<ClaimSection>): Observable<ClaimSection> {
    for (const [, sections] of this.cache) {
      const idx = sections.findIndex(s => s.id === sectionId);
      if (idx === -1) continue;
      const updated = { ...sections[idx], ...patch };
      sections[idx] = updated;
      this.stateSvc.patchSection(sectionId, patch);
      return this.respond({ ...updated });
    }
    return this.respond({} as ClaimSection);
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
        attribute:  'Instruction status',
        valueOld:   section.entities[idx]?.instructionStatus ?? '',
        valueNew:   patch.instructionStatus ?? updated.instructionStatus,
      };
      this.stateSvc.patchActivities(items => [activity, ...items]);
      return this.respond({ ...updated });
    }
    return this.respond({} as SectionEntity);
  }

  addEntity(
    sectionId: string,
    entity: { name: string; instructionStatus: InstructionStatus },
  ): Observable<SectionEntity> {
    for (const [, sections] of this.cache) {
      const section = sections.find(s => s.id === sectionId);
      if (!section) continue;
      const newEntity: SectionEntity = {
        id:               `SE-${Date.now()}`,
        name:             entity.name,
        instructionStatus: entity.instructionStatus,
        expandable:       false,
      };
      section.entities = [...section.entities, newEntity];
      const activity: ClaimActivity = {
        id:         `act-entity-add-${Date.now()}`,
        claimId:    section.claimId,
        user:       'Leonie Fischer',
        timestamp:  new Date().toISOString(),
        objectType: 'Section Entity',
        attribute:  'Entity',
        valueOld:   null,
        valueNew:   `${entity.name} added to ${section.name}`,
      };
      this.stateSvc.patchActivities(items => [activity, ...items]);
      return this.respond({ ...newEntity });
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
