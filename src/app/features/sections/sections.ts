import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { animate, style, transition, trigger } from '@angular/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { MockClaimOverviewService } from '../../core/mock/services/mock-claim-overview.service';
import { CircumstanceLabelPipe } from '../../shared/pipes/circumstance-label.pipe';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { RightStripService } from '../../core/services/right-strip.service';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { firstValueFrom, catchError, of } from 'rxjs';
import { ClaimSection, SectionEntity, InstructionStatus } from '../../core/models/section.model';
import { MockNotesService } from '../../core/mock/services/mock-notes.service';
import {
  CoverageReviewModalComponent,
  CoverageReviewModalData,
  CoverageReviewModalResult,
} from './coverage-review-modal/coverage-review-modal.component';
import { MockSectionService } from '../../core/mock/services/mock-section.service';
import { ClaimClosureService } from '../../core/services/claim-closure.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { StatusChipComponent } from '../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import {
  SectionClosureModalComponent,
  SectionClosureModalData,
  SectionClosureModalResult,
} from './section-closure-modal/section-closure-modal.component';
import {
  EditEntityDamageModalComponent,
  EditEntityDamageModalData,
  EditEntityDamageModalResult,
} from './edit-entity-damage-modal/edit-entity-damage-modal.component';
import { EntityDetailPanelComponent } from './entity-detail-panel/entity-detail-panel.component';
import { SectionDetailPanelComponent } from './section-detail-panel/section-detail-panel.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  AddSectionEntityModalComponent,
  AddSectionEntityModalData,
  AddSectionEntityModalResult,
} from './add-section-entity-modal/add-section-entity-modal.component';
import {
  SectionReopenModalComponent,
  SectionReopenModalData,
  SectionReopenModalResult,
} from './section-reopen-modal/section-reopen-modal.component';

@Component({
  selector: 'app-sections',
  animations: [
    trigger('rowExpand', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-4px)' }),
        animate('160ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      transition(':leave', [
        animate('120ms ease-in', style({ opacity: 0, transform: 'translateY(-4px)' })),
      ]),
    ]),
  ],
  imports: [
    CommonModule,
    NxButtonModule,
    NxIconModule,
    NxContextMenuModule,
    NxTableModule,
    NxSpinnerModule,
    NxTooltipModule,
    NxModalModule,
    StatusChipComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    CoverageReviewModalComponent,
    EntityDetailPanelComponent,
    SectionDetailPanelComponent,
    ConfirmDialogComponent,
    AddSectionEntityModalComponent,
    CircumstanceLabelPipe,
  ],
  templateUrl: './sections.html',
  styleUrl: './sections.scss',
})
export class Sections {
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly sectionSvc = inject(MockSectionService);
  private readonly closureSvc = inject(ClaimClosureService);
  private readonly dialogSvc  = inject(NxDialogService);
  private readonly toast      = inject(ToastService);
  private readonly notesSvc   = inject(MockNotesService);
  private readonly stripSvc   = inject(RightStripService);
  private readonly overviewSvc = inject(MockClaimOverviewService);

  readonly sections       = signal<ClaimSection[]>([]);
  readonly loading        = signal(true);
  readonly loadError      = signal(false);
  readonly selectedEntity  = signal<{ entity: SectionEntity; section: ClaimSection } | null>(null);
  readonly selectedSection = signal<ClaimSection | null>(null);
  readonly hasDetailOpen   = computed(() => !!this.selectedEntity() || !!this.selectedSection());
  readonly claimClosed    = signal(false);

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
          firstValueFrom(this.overviewSvc.getOverview(id)),
        ]);
        this.sections.set(sections);
        this.claimClosed.set(claim.status === 'Closed');
      } catch {
        this.loadError.set(true);
      } finally {
        this.loading.set(false);
      }
    });
  }

  toggleSection(id: string): void {
    this.sections.update(list =>
      list.map(s => s.id === id ? { ...s, expanded: !s.expanded } : s)
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
  onMakePayment(section: ClaimSection): void {
    const claimId = this.route.snapshot.params['id'];
    this.router.navigate(['/claims', claimId, 'financial'], { queryParams: { view: 'payments' } });
  }

  onInstructProvider(section: ClaimSection): void {
    const claimId = this.route.snapshot.params['id'];
    this.router.navigate(['/claims', claimId, 'providers'], { queryParams: { sectionId: section.id } });
  }

  async onCloseSection(section: ClaimSection): Promise<void> {
    const { canClose, blockers } = this.closureSvc.validateSectionBlockers(section);

    const ref = this.dialogSvc.open(SectionClosureModalComponent, {
      data: { section, blockers, canClose } satisfies SectionClosureModalData,
      width: '600px',
      maxWidth: '92vw',
    });

    const result = await firstValueFrom(ref.afterClosed()) as SectionClosureModalResult | undefined;
    if (!result) return;

    const updated = this.sections().map(s => s.id === section.id ? result : s);
    this.sections.set(updated);

    const allClosed = updated.every(s => s.status === 'Closed');
    if (allClosed) {
      const claimId = this.route.snapshot.params['id'];
      this.router.navigate(['/claims', claimId, 'overview']);
    }
  }

  async onAddEntity(): Promise<void> {
    const ref = this.dialogSvc.open(AddSectionEntityModalComponent, {
      data: { sections: this.sections() } satisfies AddSectionEntityModalData,
      width: '480px',
      maxWidth: '92vw',
    });
    const result = await firstValueFrom(ref.afterClosed()) as AddSectionEntityModalResult | undefined;
    if (!result) return;

    // Modal submits one selection across possibly-multiple damage-type groups —
    // add each as its own entity, all sharing the section + instruction status
    // picked once for the whole submission. MockSectionService.addEntity()
    // mutates the shared ClaimSection object in place (no cloning) — this.sections()
    // already holds those same references, so appending again here would
    // double the entity. Just refresh the outer array reference to re-render.
    for (const e of result.entities) {
      await firstValueFrom(this.sectionSvc.addEntity(result.sectionId, {
        name:              e.name,
        damage:            e.damage,
        instructionStatus: result.instructionStatus,
      }));
    }

    this.sections.update(list => [...list]);
    const count = result.entities.length;
    this.toast.success(`${count} entit${count === 1 ? 'y' : 'ies'} added`);
  }

  toggleEntityExpand(section: ClaimSection, entityId: string): void {
    this.sections.update(list =>
      list.map(s => s.id === section.id
        ? { ...s, entities: s.entities.map(e => e.id === entityId ? { ...e, expanded: !(e as SectionEntity & { expanded?: boolean }).expanded } : e) }
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

  async onEditEntity(section: ClaimSection, entity: SectionEntity): Promise<void> {
    const ref = this.dialogSvc.open(EditEntityDamageModalComponent, {
      data: { entity, confirmedPeril: section.confirmedPeril } satisfies EditEntityDamageModalData,
      width: '480px',
      maxWidth: '92vw',
    });
    const result = await firstValueFrom(ref.afterClosed()) as EditEntityDamageModalResult | undefined;
    if (!result) return;

    await firstValueFrom(this.sectionSvc.patchEntity(section.id, entity.id, result));
    this.sections.update(list =>
      list.map(s => s.id === section.id
        ? { ...s, entities: s.entities.map(e => e.id === entity.id ? { ...e, ...result } : e) }
        : s
      )
    );
    this.toast.success(`Entity "${entity.name}" updated`);
  }

  async onDeleteEntity(section: ClaimSection, entity: SectionEntity): Promise<void> {
    const ref = this.dialogSvc.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete entity',
        message: `Remove "${entity.name}" from ${section.name}? This cannot be undone.`,
        confirmLabel: 'Delete',
        confirmDanger: true,
      } satisfies ConfirmDialogData,
      width: '400px',
      maxWidth: '92vw',
    });
    const confirmed = await firstValueFrom(ref.afterClosed()) as boolean | undefined;
    if (!confirmed) return;

    this.sections.update(list =>
      list.map(s => s.id === section.id
        ? { ...s, entities: s.entities.filter(e => e.id !== entity.id) }
        : s
      )
    );
    this.toast.success(`Entity "${entity.name}" removed`);
  }

  async onOverrideCoverageReview(section: ClaimSection, entity: SectionEntity): Promise<void> {
    const ref = this.dialogSvc.open(CoverageReviewModalComponent, {
      data: { entity } satisfies CoverageReviewModalData,
      width: '480px',
      maxWidth: '92vw',
    });
    const result = await firstValueFrom(ref.afterClosed()) as CoverageReviewModalResult | undefined;
    if (!result) return;

    const claimId = this.route.snapshot.params['id'];

    await firstValueFrom(this.sectionSvc.patchEntity(section.id, entity.id, result));
    this.sections.update(list =>
      list.map(s => s.id === section.id
        ? { ...s, entities: s.entities.map(e => e.id === entity.id ? { ...e, ...result } : e) }
        : s
      )
    );

    // allNotes is a live computed off the shared notes store — addNote() already
    // updates that store, so no separate assignment is needed here.
    await firstValueFrom(
      this.notesSvc.addNote(claimId, {
        title:   `Coverage review override — ${entity.name}`,
        section: 'general',
        body:    `Coverage review changed to "${result.coverageReview}". Reason: ${result.coverageReviewNote}`,
      })
    );

    this.toast.success(`Coverage review updated for "${entity.name}"`);
  }

  async onReopenSection(section: ClaimSection): Promise<void> {
    const ref = this.dialogSvc.open(SectionReopenModalComponent, {
      data: {
        section,
        reopenedByName: 'Leonie Fischer',
      } satisfies SectionReopenModalData,
      width: '480px',
      maxWidth: '92vw',
    });
    const result = await firstValueFrom(ref.afterClosed()) as SectionReopenModalResult | undefined;
    if (!result) return;

    this.sections.update(list =>
      list.map(s => s.id === section.id ? { ...s, ...result.reopenedSection } : s)
    );
    this.toast.success(`Section "${result.reopenedSection.name}" reopened`);
  }

  async onSimulateFinalPayment(section: ClaimSection): Promise<void> {
    const claimId = this.route.snapshot.params['id'];
    try {
      const closed = await firstValueFrom(
        this.closureSvc.triggerFinalPaymentAndClose(claimId, section.id).pipe(
          catchError(err => {
            this.toast.error('Simulate Final Payment failed', err?.message ?? 'Check section blockers.');
            return of(null);
          }),
        ),
      );
      if (!closed) return;
      this.sections.update(list =>
        list.map(s => s.id === closed.id ? { ...s, ...closed } : s),
      );
    } catch (err: unknown) {
      this.toast.error('Simulate Final Payment failed', String(err));
    }
  }
}
