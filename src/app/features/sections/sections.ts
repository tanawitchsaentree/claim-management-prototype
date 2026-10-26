import { AppDatePipe } from '../../shared/pipes/app-date.pipe';
import { Component, inject, signal, computed, effect } from '@angular/core';

import { animate, style, transition, trigger } from '@angular/animations';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ActivatedRoute, Router } from '@angular/router';
import { MockClaimOverviewService } from '../../core/mock/services/mock-claim-overview.service';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { NxBadgeModule } from '@allianz/ng-aquila/badge';
import { RightStripService } from '../../core/services/right-strip.service';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { firstValueFrom, catchError, of } from 'rxjs';
import { ClaimSection, SectionEntity } from '../../core/models/section.model';
import { MockSectionService } from '../../core/mock/services/mock-section.service';
import { ClaimClosureService } from '../../core/services/claim-closure.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { StatusChipComponent } from '../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { BlockerReturnBannerComponent } from '../../shared/components/blocker-return-banner/blocker-return-banner.component';
import {
  SectionClosureModalComponent,
  SectionClosureModalData,
  SectionClosureModalResult
} from './section-closure-modal/section-closure-modal.component';
import {
  EditEntityDamageModalComponent,
  EditEntityDamageModalData,
  EditEntityDamageModalResult
} from './edit-entity-damage-modal/edit-entity-damage-modal.component';
import { EntityDetailPanelComponent } from './entity-detail-panel/entity-detail-panel.component';
import { SectionDetailPanelComponent } from './section-detail-panel/section-detail-panel.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  AddSectionEntityModalComponent,
  AddSectionEntityModalData,
  AddSectionEntityModalResult
} from './add-section-entity-modal/add-section-entity-modal.component';
import {
  SectionReopenModalComponent,
  SectionReopenModalData,
  SectionReopenModalResult
} from './section-reopen-modal/section-reopen-modal.component';
import { DamageTypeLabelPipe } from '../../shared/pipes/damage-type-label.pipe';

@Component({
  selector: 'app-sections',
  animations: [
    trigger('rowExpand', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-4px)' }),
        animate('160ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('120ms ease-in', style({ opacity: 0, transform: 'translateY(-4px)' }))
      ])
    ])
  ],
  imports: [
    NxButtonModule,
    NxIconModule,
    NxContextMenuModule,
    NxTableModule,
    NxSpinnerModule,
    NxTooltipModule,
    NxBadgeModule,
    NxModalModule,
    StatusChipComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    EntityDetailPanelComponent,
    SectionDetailPanelComponent,
    ConfirmDialogComponent,
    AddSectionEntityModalComponent,
    DamageTypeLabelPipe,
    NxMessageModule,
    BlockerReturnBannerComponent
  ],
  templateUrl: './sections.html',
  styleUrl: './sections.scss'
})
export class Sections {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sectionSvc = inject(MockSectionService);
  private readonly closureSvc = inject(ClaimClosureService);
  private readonly dialogSvc = inject(NxDialogService);
  private readonly toast = inject(ToastService);
  private readonly stripSvc = inject(RightStripService);
  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly live = inject(LiveAnnouncer);

  readonly sections = signal<ClaimSection[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly selectedEntity = signal<{ entity: SectionEntity; section: ClaimSection } | null>(null);
  readonly selectedSection = signal<ClaimSection | null>(null);
  readonly hasDetailOpen = computed(() => !!this.selectedEntity() || !!this.selectedSection());
  readonly claimClosed = signal(false);
  readonly policyNumber = signal('');
  private readonly claimDateOfLoss = signal<string | undefined>(undefined);
  // BMPCC-18160 — read off the claim, not the section (ASSUMPTION [CIRC-4] in
  // core/models/claim-overview.model.ts). Passed down to the section detail
  // panel so it can show the circumstance read-only.
  readonly incidentCircumstance = signal<string | null>(null);
  // Handed to Add Section so a claim converted from an orphan claim — where
  // whoever creates the section may not be whoever took the original notice —
  // has an actual account of what happened to work from, not a blank form.

  readonly devMode = true;

  constructor() {
    effect(async () => {
      const id = this.route.snapshot.params['id'];
      if (!id) return;
      this.loading.set(true);
      this.loadError.set(false);
      try {
        const [sections, claim] = await Promise.all([
          firstValueFrom(this.sectionSvc.getByClaimId(id)),
          firstValueFrom(this.overviewSvc.getOverview(id))
        ]);
        this.sections.set(sections);
        this.claimClosed.set(claim.status === 'Closed');
        this.policyNumber.set(claim.policyNumber ?? '');
        this.claimDateOfLoss.set(claim.dateOfLoss || undefined);
        this.incidentCircumstance.set(claim.incidentCircumstance ?? null);
      } catch {
        this.loadError.set(true);
      } finally {
        this.loading.set(false);
      }
    });
  }

  toggleSection(id: string): void {
    this.sections.update(list =>
      list.map(s => (s.id === id ? { ...s, expanded: !s.expanded } : s))
    );
  }

  openEntityDetail(section: ClaimSection, entity: SectionEntity): void {
    this.selectedSection.set(null);
    this.selectedEntity.set({ entity, section });
  }

  closeEntityDetail(): void {
    this.selectedEntity.set(null);
  }

  openSectionDetail(section: ClaimSection): void {
    this.selectedEntity.set(null);
    this.selectedSection.set(section);
  }

  closeSectionDetail(): void {
    this.selectedSection.set(null);
  }

  // Opens the Comments panel scoped to this section — matches notes attached
  // to the section itself OR to any of its entities, since notes are added at
  // either level (see CONVERSIONS.md Phase 2 item 1: entry point moved from a
  // per-entity-row icon to this section-level "View notes" action).
  onViewNotes(section: ClaimSection): void {
    const names = [section.name, ...section.entities.map(e => e.name)];
    this.stripSvc.openScoped('comments', section.name, names);
  }

  // ── Section kebab actions ──────────────────────────────────────

  // A dedicated Payments-capable page already exists (Financial Overview's
  // "payments" tab) — send the user there instead of a standalone modal.
  // No section-level pre-filter: that page's `sectionId` signal is only ever
  // set internally from loaded data, it doesn't read a query param today.
  onMakePayment(_section: ClaimSection): void {
    const claimId = this.route.snapshot.params['id'];
    this.router.navigate(['/claims', claimId, 'financial'], { queryParams: { view: 'payments' } });
  }

  onInstructProvider(section: ClaimSection): void {
    const claimId = this.route.snapshot.params['id'];
    this.router.navigate(['/claims', claimId, 'providers'], {
      queryParams: { sectionId: section.id }
    });
  }

  async onCloseSection(section: ClaimSection): Promise<void> {
    const { canClose, blockers } = this.closureSvc.validateSectionBlockers(section);

    const ref = this.dialogSvc.open(SectionClosureModalComponent, {
      data: { section, blockers, canClose } satisfies SectionClosureModalData,
      width: '600px',
      maxWidth: '92vw'
    });

    const result = (await firstValueFrom(ref.afterClosed())) as
      | SectionClosureModalResult
      | undefined;
    if (!result) return;

    const updated = this.sections().map(s => (s.id === section.id ? result : s));
    this.sections.set(updated);

    const allClosed = updated.every(s => s.status === 'Closed');
    if (allClosed) {
      const claimId = this.route.snapshot.params['id'];
      this.router.navigate(['/claims', claimId, 'overview']);
    }
  }

  async onAddSection(): Promise<void> {
    const claimId = this.route.snapshot.params['id'];
    const ref = this.dialogSvc.open(AddSectionEntityModalComponent, {
      data: {
        sections: this.sections(),
        claimId,
        policyNumber: this.policyNumber()
      } satisfies AddSectionEntityModalData,
      // Widened from 480px (Marlene's original instruction-status-only
      // shape) — CBI capture added a location-picker table that needs more
      // room to not wrap awkwardly.
      width: '720px',
      maxWidth: '92vw'
    });
    const result = (await firstValueFrom(ref.afterClosed())) as
      | AddSectionEntityModalResult
      | undefined;
    if (!result) return;

    const count = result.entityNames.length;

    // Same confirm as Edit claim (team call 2026-10-15): Field / Original / Updated,
    // nothing is created until the handler confirms.
    const target = result.mode === 'new' ? null : this.sections().find(s => s.id === result.sectionId);
    const before = target?.entities.map(e => e.name) ?? [];
    const sectionLabel = new DamageTypeLabelPipe().transform(
      result.mode === 'new' ? result.damageType : (target?.damageType ?? '')
    );
    const confirmRef = this.dialogSvc.open(ConfirmDialogComponent, {
      data: {
        title: result.mode === 'new' ? 'Confirm new section' : 'Confirm section changes',
        message: `The following fields will be updated for claim ${claimId}.`,
        changes: [
          ...(result.mode === 'new'
            ? [{ label: 'Section', original: '–', updated: `${sectionLabel} (new section)` }]
            : [{ label: 'Section', original: target?.name ?? '–', updated: target?.name ?? '–' }]),
          {
            label: 'Entities',
            original: before.join(', ') || '–',
            updated: [...before, ...result.entityNames].join(', ')
          }
        ],
        showChanges: true,
        hideIcon: true,
        confirmLabel: 'Confirm changes',
        cancelLabel: 'Back to editing'
      } satisfies ConfirmDialogData,
      width: '480px',
      maxWidth: '92vw'
    });
    if (!(await firstValueFrom(confirmRef.afterClosed()))) return;

    if (result.mode === 'new') {
      const created = await firstValueFrom(
        this.sectionSvc.createSection(
          claimId,
          result.damageType,
          result.entityNames.map(name => ({
            name,
            instructionStatus: result.instructionStatus,
            dateOfOccurrence: result.dateOfOccurrence,
            interruptionStartDate: result.interruptionStartDate,
            interruptionEndDate: result.interruptionEndDate,
            isContingentBi: result.isContingentBi,
            cbiCaseType: result.cbiCaseType,
            thirdPartyName: result.thirdPartyName,
            thirdPartyRelationship: result.thirdPartyRelationship,
            thirdPartyIndustry: result.thirdPartyIndustry,
            cbiOriginatingLocation: result.cbiOriginatingLocation,
            cbiOriginatingLocationDetail: result.cbiOriginatingLocationDetail
          }))
        )
      );
      this.sections.update(list => [...list, created]);
      this.toast.success(
        `Section "${created.name}" created`,
        `${count} entit${count === 1 ? 'y' : 'ies'} added`
      );
      return;
    }

    // MockSectionService.addEntity() mutates the shared ClaimSection object in
    // place (no cloning) — this.sections() already holds those same
    // references, so appending again here would double the entity. Just
    // refresh the outer array reference to re-render.
    for (const name of result.entityNames) {
      await firstValueFrom(
        this.sectionSvc.addEntity(result.sectionId, {
          name,
          instructionStatus: result.instructionStatus,
          dateOfOccurrence: result.dateOfOccurrence,
          interruptionStartDate: result.interruptionStartDate,
          interruptionEndDate: result.interruptionEndDate,
          isContingentBi: result.isContingentBi,
          cbiCaseType: result.cbiCaseType,
          thirdPartyName: result.thirdPartyName,
          thirdPartyRelationship: result.thirdPartyRelationship,
          thirdPartyIndustry: result.thirdPartyIndustry,
          cbiOriginatingLocation: result.cbiOriginatingLocation,
          cbiOriginatingLocationDetail: result.cbiOriginatingLocationDetail
        })
      );
    }
    this.sections.update(list => [...list]);
    this.toast.success(`${count} entit${count === 1 ? 'y' : 'ies'} added`);
  }

  toggleEntityExpand(section: ClaimSection, entityId: string): void {
    this.sections.update(list =>
      list.map(s =>
        s.id === section.id
          ? {
              ...s,
              entities: s.entities.map(e =>
                e.id === entityId
                  ? { ...e, expanded: !(e as SectionEntity & { expanded?: boolean }).expanded }
                  : e
              )
            }
          : s
      )
    );
  }

  isEntityExpanded(entity: SectionEntity): boolean {
    return (entity as SectionEntity & { expanded?: boolean }).expanded ?? false;
  }

  onAddComment(attachTo: string): void {
    this.stripSvc.openAddNote(attachTo);
  }

  // ── Entity kebab actions ───────────────────────────────────────

  /** Same confirm as Add entity: Field / Original / Updated, nothing saved until confirmed. */
  private async confirmEntityEdit(
    section: ClaimSection,
    entity: SectionEntity,
    result: EditEntityDamageModalResult
  ): Promise<boolean> {
    const date = new AppDatePipe();
    const fmt = (v?: string): string => (v ? date.transform(v) : '–');
    const before = entity.dateOfOccurrence ?? this.claimDateOfLoss();
    const changes = [
      ...(entity.instructionStatus !== result.instructionStatus
        ? [{ label: 'Instruction status', original: entity.instructionStatus, updated: result.instructionStatus }]
        : []),
      ...(before !== result.dateOfOccurrence
        ? [{ label: 'Date of loss', original: fmt(before), updated: fmt(result.dateOfOccurrence) }]
        : [])
    ];
    const ref = this.dialogSvc.open(ConfirmDialogComponent, {
      data: {
        title: 'Confirm entity changes',
        message: `The following fields will be updated for "${entity.name}" in ${section.name}.`,
        changes,
        showChanges: changes.length > 0,
        hideIcon: true,
        confirmLabel: 'Confirm changes',
        cancelLabel: 'Back to editing'
      } satisfies ConfirmDialogData,
      width: '480px',
      maxWidth: '92vw'
    });
    return !!(await firstValueFrom(ref.afterClosed()));
  }

  async onEditEntity(section: ClaimSection, entity: SectionEntity): Promise<void> {
    const ref = this.dialogSvc.open(EditEntityDamageModalComponent, {
      data: {
        entity,
        damageType: section.damageType,
        claimDateOfLoss: this.claimDateOfLoss()
      } satisfies EditEntityDamageModalData,
      // Wider whenever the CBI question is even askable (any
      // business-interruption entity, not just ones already marked CBI —
      // that entity might get answered "Yes" here for the first time and
      // need the location-picker table's room). Everything else stays at
      // the original compact width.
      width: section.damageType === 'business-interruption' ? '720px' : '480px',
      maxWidth: '92vw'
    });
    const result = (await firstValueFrom(ref.afterClosed())) as
      | EditEntityDamageModalResult
      | undefined;
    if (!result) return;
    if (!(await this.confirmEntityEdit(section, entity, result))) return;

    await firstValueFrom(this.sectionSvc.patchEntity(section.id, entity.id, result));
    this.sections.update(list =>
      list.map(s =>
        s.id === section.id
          ? {
              ...s,
              entities: s.entities.map(e => (e.id === entity.id ? { ...e, ...result } : e))
            }
          : s
      )
    );
    this.toast.success(`Entity "${entity.name}" updated`);
  }

  // The handler confirms they checked the section against what changed. Asks first
  // (a sign-off is a commitment), acknowledges with a toast.
  async onMarkReviewed(section: ClaimSection): Promise<void> {
    const fields = section.reviewNeeded?.fields.join(', ') ?? 'the loss information';
    const ref = this.dialogSvc.open(ConfirmDialogComponent, {
      data: {
        title: 'Mark as reviewed',
        message: `Confirm you have checked "${section.name}" against the changed ${fields}. The "Review needed" mark is removed.`,
        confirmLabel: 'Mark as reviewed',
        cancelLabel: 'Not yet'
      } satisfies ConfirmDialogData,
      width: '480px',
      maxWidth: '92vw'
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;
    this.sectionSvc.markReviewed(section.id);
    this.sections.update(list =>
      list.map(s => (s.id === section.id ? { ...s, reviewNeeded: undefined } : s))
    );
    this.toast.success('Section reviewed', `"${section.name}" no longer needs review.`);
  }

  async onDeleteEntity(section: ClaimSection, entity: SectionEntity): Promise<void> {
    // Stage 7: same blocker set section close checks, applied at the entity's
    // owning section — checked before the confirm dialog even opens, so a
    // blocked delete never looks like a normal delete that just needs a click.
    const blockers = this.sectionSvc.deleteEntityBlockers(section);
    if (blockers.length) {
      this.toast.error(
        `Can't remove "${entity.name}"`,
        `${section.name} has ${blockers.join(', ')} — resolve that first.`
      );
      return;
    }

    const ref = this.dialogSvc.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete entity',
        message: `Remove "${entity.name}" from ${section.name}? This cannot be undone.`,
        confirmLabel: 'Delete',
        confirmDanger: true
      } satisfies ConfirmDialogData,
      width: '400px',
      maxWidth: '92vw'
    });
    const confirmed = (await firstValueFrom(ref.afterClosed())) as boolean | undefined;
    if (!confirmed) return;

    const result = await firstValueFrom(
      this.sectionSvc.deleteEntity(section.id, entity.id, {
        userId: 'usr-lf',
        name: 'Leonie Fischer'
      })
    );
    if (!result.ok) {
      this.toast.error(`Can't remove "${entity.name}"`, result.blockers.join(', '));
      return;
    }

    this.sections.update(list =>
      list.map(s =>
        s.id === section.id ? { ...s, entities: s.entities.filter(e => e.id !== entity.id) } : s
      )
    );
    this.toast.success(`Entity "${entity.name}" removed`);
  }

  async onReopenSection(section: ClaimSection): Promise<void> {
    const ref = this.dialogSvc.open(SectionReopenModalComponent, {
      data: {
        section,
        reopenedByName: 'Leonie Fischer'
      } satisfies SectionReopenModalData,
      width: '480px',
      maxWidth: '92vw'
    });
    const result = (await firstValueFrom(ref.afterClosed())) as
      | SectionReopenModalResult
      | undefined;
    if (!result) return;

    this.sections.update(list =>
      list.map(s => (s.id === section.id ? { ...s, ...result.reopenedSection } : s))
    );
    this.toast.success(`Section "${result.reopenedSection.name}" reopened`);
  }

  async onSimulateFinalPayment(section: ClaimSection): Promise<void> {
    const claimId = this.route.snapshot.params['id'];
    try {
      const closed = await firstValueFrom(
        this.closureSvc.triggerFinalPaymentAndClose(claimId, section.id).pipe(
          catchError(err => {
            this.toast.error(
              'Simulate Final Payment failed',
              err?.message ?? 'Check section blockers.'
            );
            return of(null);
          })
        )
      );
      if (!closed) return;
      this.sections.update(list => list.map(s => (s.id === closed.id ? { ...s, ...closed } : s)));
    } catch (err: unknown) {
      this.toast.error('Simulate Final Payment failed', String(err));
    }
  }
}
