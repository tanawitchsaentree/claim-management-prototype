import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  ClaimSection,
  InstructionStatus,
  SectionClosureReason,
  SectionReopenReason,
  SectionEntity
} from '../../models/section.model';
import { ClaimActivity } from '../../models/claim-overview.model';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';
import { MockLookupService } from './mock-lookup.service';
import { ToastService } from '../../../shared/components/toast/toast.service';

@Injectable({ providedIn: 'root' })
export class MockSectionService extends MockBaseService {
  private readonly stateSvc = inject(MockStateService);
  private readonly lookupSvc = inject(MockLookupService);
  private readonly toast = inject(ToastService);

  // In-memory mutable state — seeded from MockStateService on first access per claimId
  private readonly cache = new Map<string, ClaimSection[]>();

  private forClaim(claimId: string): ClaimSection[] {
    if (!this.cache.has(claimId)) {
      const seed = this.stateSvc
        .state()
        .sections.filter(s => s.claimId === claimId)
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

  // Synchronous accessor for services that build their own state from
  // sections without needing the artificial mock network delay (e.g.
  // MockFinancialOverviewService deriving its section list for the Add
  // Reserve modal).
  getByClaimIdSync(claimId: string): ClaimSection[] {
    return this.forClaim(claimId);
  }

  // Section creation primitive (Stage 3, FNOL/claim-file model fix). A
  // section IS an entity x damage-type pairing — this is the one place that
  // pairing gets made. Used by both FNOL step 2's submit conversion (Stage 4)
  // and the claim file's "Add damage type" action (Stage 8), so the two
  // surfaces can't drift into creating sections shaped differently.
  createSection(
    claimId: string,
    damageType: string,
    entities: {
      name: string;
      instructionStatus?: InstructionStatus;
      dateOfOccurrence?: string;
      interruptionStartDate?: string;
      interruptionEndDate?: string;
      isContingentBi?: boolean;
      cbiCaseType?: string;
      thirdPartyName?: string;
      thirdPartyRelationship?: 'supplier' | 'customer' | 'other';
      thirdPartyIndustry?: string;
      cbiOriginatingLocation?: string;
    }[],
    createdBy: { userId: string; name: string } = { userId: 'usr-lf', name: 'Leonie Fischer' }
  ): Observable<ClaimSection> {
    const sections = this.forClaim(claimId);
    const cbiCaseTypeLabel = entities.find(e => e.isContingentBi)?.cbiCaseType
      ? this.lookupSvc
          .getCbiCaseTypesSync()
          .find(o => o.value === entities.find(e => e.isContingentBi)!.cbiCaseType)?.label
      : undefined;
    // CBI replaces the plain damage-type label on the section (Section
    // Creation Logic, BMPCC-17927) — the case type IS the coverage being
    // reported, not a sub-attribute of a generic "Business Interruption" one.
    const label =
      cbiCaseTypeLabel ??
      this.lookupSvc.getTypeOfDamageSync().find(o => o.value === damageType)?.label ??
      damageType;
    const now = Date.now();
    const newSection: ClaimSection = {
      id: `SEC-${now}`,
      claimId,
      name: entities[0]?.name ? `${label} — ${entities[0].name}` : label,
      damageType,
      status: 'Open',
      expanded: true,
      hasOpenDeductible: false,
      hasActiveLitigation: false,
      hasSubrogation: false,
      hasActiveSalvage: false,
      hasOpenReserves: false,
      hasOpenPayments: false,
      hasActiveProvider: false,
      entities: entities.map((e, i) => ({
        id: `SE-${now}-${i}`,
        name: e.name,
        instructionStatus: e.instructionStatus ?? 'Not assigned',
        expandable: false,
        dateOfOccurrence: e.dateOfOccurrence,
        interruptionStartDate: e.interruptionStartDate,
        interruptionEndDate: e.interruptionEndDate,
        isContingentBi: e.isContingentBi,
        cbiCaseType: e.cbiCaseType,
        thirdPartyName: e.thirdPartyName,
        thirdPartyRelationship: e.thirdPartyRelationship,
        thirdPartyIndustry: e.thirdPartyIndustry,
        cbiOriginatingLocation: e.cbiOriginatingLocation
      }))
    };
    sections.push(newSection);
    this.stateSvc.appendSections([newSection]);

    const activity: ClaimActivity = {
      id: `act-sec-create-${now}`,
      claimId,
      user: createdBy.name,
      timestamp: new Date().toISOString(),
      objectType: 'Section',
      attribute: 'Created',
      valueOld: null,
      valueNew: `${newSection.name} (${label})`
    };
    this.stateSvc.patchActivities(items => [activity, ...items]);

    return this.respond({ ...newSection });
  }

  closeSection(
    sectionId: string,
    closedBy: { userId: string; name: string },
    closureReason?: SectionClosureReason
  ): Observable<ClaimSection> {
    for (const [, sections] of this.cache) {
      const target = sections.find(s => s.id === sectionId);
      if (target) {
        target.status = 'Closed';
        target.closureDate = new Date().toISOString().split('T')[0];
        target.closedBy = closedBy;
        target.closureReason = closureReason;
        this.stateSvc.patchSection(sectionId, {
          status: target.status,
          closureDate: target.closureDate,
          closedBy: target.closedBy,
          closureReason: target.closureReason
        });
        const activity: ClaimActivity = {
          id: `act-sec-close-${Date.now()}`,
          claimId: target.claimId,
          user: closedBy.name,
          timestamp: new Date().toISOString(),
          objectType: 'Section',
          attribute: 'Status',
          valueOld: 'Open',
          valueNew: 'Closed'
        };
        this.stateSvc.patchActivities(items => [activity, ...items]);
        this.toast.success(`Section ${sectionId} closed`, closureReason);
        return this.respond({ ...target });
      }
    }
    return this.findById(
      this.stateSvc.state().sections as unknown as Record<string, unknown>[],
      'id',
      sectionId
    ) as unknown as Observable<ClaimSection>;
  }

  reopenSection(
    sectionId: string,
    reopenedBy: { userId: string; name: string },
    reopeningReason: SectionReopenReason
  ): Observable<ClaimSection> {
    for (const [, sections] of this.cache) {
      const target = sections.find(s => s.id === sectionId);
      if (target) {
        target.status = 'Open';
        target.reopenedDate = new Date().toISOString().split('T')[0];
        target.reopenedBy = reopenedBy;
        target.reopeningReason = reopeningReason;
        this.stateSvc.patchSection(sectionId, {
          status: target.status,
          reopenedDate: target.reopenedDate,
          reopenedBy: target.reopenedBy,
          reopeningReason: target.reopeningReason
        });
        const activity: ClaimActivity = {
          id: `act-sec-reopen-${Date.now()}`,
          claimId: target.claimId,
          user: reopenedBy.name,
          timestamp: new Date().toISOString(),
          objectType: 'Section',
          attribute: 'Status',
          valueOld: 'Closed',
          valueNew: 'Open'
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

  patchEntity(
    sectionId: string,
    entityId: string,
    patch: Partial<SectionEntity>
  ): Observable<SectionEntity> {
    for (const [, sections] of this.cache) {
      const section = sections.find(s => s.id === sectionId);
      if (!section) continue;
      const idx = section.entities.findIndex(e => e.id === entityId);
      if (idx === -1) continue;
      const before = section.entities[idx];
      const updated = { ...before, ...patch };
      section.entities = section.entities.map((e, i) => (i === idx ? updated : e));
      this.stateSvc.patchSection(sectionId, { entities: [...section.entities] });

      // Hardcoded to "Instruction status" before CBI fields (BMPCC-18353,
      // 2026-09-18) became editable through this same patch — a CBI edit
      // used to log as a no-op "Instruction status: X -> X" while the real
      // change (case type/third party/location) went unrecorded. Report
      // whichever field the caller actually changed instead.
      const attribute =
        patch.instructionStatus !== undefined && patch.instructionStatus !== before.instructionStatus
          ? 'Instruction status'
          : patch.cbiCaseType !== undefined
            ? 'CBI case type'
            : patch.thirdPartyName !== undefined
              ? 'Third party name'
              : patch.cbiOriginatingLocation !== undefined
                ? 'Originating loss location'
                : 'Instruction status';
      const valueOld =
        attribute === 'CBI case type'
          ? before.cbiCaseType ?? ''
          : attribute === 'Third party name'
            ? before.thirdPartyName ?? ''
            : attribute === 'Originating loss location'
              ? before.cbiOriginatingLocation ?? ''
              : before.instructionStatus ?? '';
      const valueNew =
        attribute === 'CBI case type'
          ? updated.cbiCaseType ?? ''
          : attribute === 'Third party name'
            ? updated.thirdPartyName ?? ''
            : attribute === 'Originating loss location'
              ? updated.cbiOriginatingLocation ?? ''
              : updated.instructionStatus ?? '';

      const activity: ClaimActivity = {
        id: `act-entity-edit-${Date.now()}`,
        claimId: section.claimId,
        user: 'Leonie Fischer',
        timestamp: new Date().toISOString(),
        objectType: 'Section Entity',
        attribute,
        valueOld,
        valueNew
      };
      this.stateSvc.patchActivities(items => [activity, ...items]);
      return this.respond({ ...updated });
    }
    return this.respond({} as SectionEntity);
  }

  addEntity(
    sectionId: string,
    entity: {
      name: string;
      instructionStatus: InstructionStatus;
      dateOfOccurrence?: string;
      interruptionStartDate?: string;
      interruptionEndDate?: string;
      isContingentBi?: boolean;
      cbiCaseType?: string;
      thirdPartyName?: string;
      thirdPartyRelationship?: 'supplier' | 'customer' | 'other';
    }
  ): Observable<SectionEntity> {
    for (const [, sections] of this.cache) {
      const section = sections.find(s => s.id === sectionId);
      if (!section) continue;
      const newEntity: SectionEntity = {
        id: `SE-${Date.now()}`,
        name: entity.name,
        instructionStatus: entity.instructionStatus,
        expandable: false,
        dateOfOccurrence: entity.dateOfOccurrence,
        interruptionStartDate: entity.interruptionStartDate,
        interruptionEndDate: entity.interruptionEndDate,
        isContingentBi: entity.isContingentBi,
        cbiCaseType: entity.cbiCaseType,
        thirdPartyName: entity.thirdPartyName,
        thirdPartyRelationship: entity.thirdPartyRelationship
      };
      section.entities = [...section.entities, newEntity];
      const activity: ClaimActivity = {
        id: `act-entity-add-${Date.now()}`,
        claimId: section.claimId,
        user: 'Leonie Fischer',
        timestamp: new Date().toISOString(),
        objectType: 'Section Entity',
        attribute: 'Entity',
        valueOld: null,
        valueNew: `${entity.name} added to ${section.name}`
      };
      this.stateSvc.patchActivities(items => [activity, ...items]);
      return this.respond({ ...newEntity });
    }
    return this.respond({} as SectionEntity);
  }

  // Stage 7 (FNOL/claim-file model fix): entity delete used to be a bare
  // confirm dialog + client-side signal filter — no service call, no checks
  // at all, unlike section close's 7 blocker flags. Not duplicating
  // ClaimClosureService.validateSectionBlockers() here — that service
  // already injects MockSectionService, so the reverse import would be
  // circular; the same 7 flags live directly on ClaimSection and are cheap
  // to check inline.
  deleteEntityBlockers(section: ClaimSection): string[] {
    const reasons: string[] = [];
    if (section.hasOpenDeductible) reasons.push('an open deductible collection');
    if (section.hasActiveLitigation) reasons.push('active litigation');
    if (section.hasSubrogation) reasons.push('pending subrogation activity');
    if (section.hasActiveSalvage) reasons.push('pending salvage activity');
    if (section.hasOpenReserves) reasons.push('open reserves');
    if (section.hasOpenPayments) reasons.push('open payments');
    if (section.hasActiveProvider) reasons.push('an active provider assignment');
    return reasons;
  }

  deleteEntity(
    sectionId: string,
    entityId: string,
    deletedBy: { userId: string; name: string }
  ): Observable<{ ok: boolean; blockers: string[] }> {
    for (const [, sections] of this.cache) {
      const section = sections.find(s => s.id === sectionId);
      if (!section) continue;
      const blockers = this.deleteEntityBlockers(section);
      if (blockers.length) return this.respond({ ok: false, blockers });

      const entity = section.entities.find(e => e.id === entityId);
      section.entities = section.entities.filter(e => e.id !== entityId);
      this.stateSvc.patchSection(sectionId, { entities: [...section.entities] });

      const activity: ClaimActivity = {
        id: `act-entity-delete-${Date.now()}`,
        claimId: section.claimId,
        user: deletedBy.name,
        timestamp: new Date().toISOString(),
        objectType: 'Section Entity',
        attribute: 'Entity',
        valueOld: entity ? `${entity.name} on ${section.name}` : section.name,
        valueNew: null
      };
      this.stateSvc.patchActivities(items => [activity, ...items]);
      return this.respond({ ok: true, blockers: [] });
    }
    return this.respond({ ok: false, blockers: ['Section not found'] });
  }

  getOpenSectionsCount(claimId: string): Observable<number> {
    const count = this.forClaim(claimId).filter(s => s.status === 'Open').length;
    return this.respond(count);
  }

  getOpenSectionsCount$(claimId: string): Observable<number> {
    return this.getByClaimId(claimId).pipe(
      map(sections => sections.filter(s => s.status === 'Open').length)
    );
  }
}
