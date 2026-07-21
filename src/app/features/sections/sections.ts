import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { animate, style, transition, trigger } from '@angular/animations';
import { ActivatedRoute, Router } from '@angular/router';
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
import { Note } from '../../core/models/note.model';
import {
  CoverageReviewModalComponent,
  CoverageReviewModalData,
  CoverageReviewModalResult,
} from './coverage-review-modal/coverage-review-modal.component';
import { MockSectionService } from '../../core/mock/services/mock-section.service';
import { ClaimClosureService } from '../../core/services/claim-closure.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { StatusChipComponent } from '../../shared/components/status-chip/status-chip.component';
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
import {
  MakePaymentModalComponent,
  MakePaymentModalData,
  MakePaymentModalResult,
} from './make-payment-modal/make-payment-modal.component';
import {
  InstructProviderModalComponent,
  InstructProviderModalData,
  InstructProviderModalResult,
} from './instruct-provider-modal/instruct-provider-modal.component';
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
    CoverageReviewModalComponent,
    EntityDetailPanelComponent,
    SectionDetailPanelComponent,
    MakePaymentModalComponent,
    InstructProviderModalComponent,
    ConfirmDialogComponent,
    AddSectionEntityModalComponent,
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

  readonly sections       = signal<ClaimSection[]>([]);
  readonly loading        = signal(true);
  readonly loadError      = signal(false);
  readonly allNotes       = signal<Note[]>([]);
  readonly selectedEntity  = signal<{ entity: SectionEntity; section: ClaimSection } | null>(null);
  readonly selectedSection = signal<ClaimSection | null>(null);
  readonly hasDetailOpen   = computed(() => !!this.selectedEntity() || !!this.selectedSection());

  readonly devMode = true;

  constructor() {
    effect(async () => {
      const id = this.route.snapshot.params['id'];
      if (!id) return;
      this.loading.set(true);
      this.loadError.set(false);
      try {
        const [sections, notes] = await Promise.all([
          firstValueFrom(this.sectionSvc.getByClaimId(id)),
          firstValueFrom(this.notesSvc.getByClaim(id)),
        ]);
        this.sections.set(sections);
        this.allNotes.set(notes);
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

  private noteFor(entityName: string): Note | undefined {
    return this.allNotes().find(n =>
      n.body.toLowerCase().includes(entityName.toLowerCase()) ||
      (n.title ?? '').toLowerCase().includes(entityName.toLowerCase())
    );
  }

  hasNoteFor(entityName: string): boolean {
    return !!this.noteFor(entityName);
  }

  viewEntityComments(entityName: string): void {
    const note = this.noteFor(entityName);
    if (!note) return;
    this.stripSvc.open('comments', note.id);
  }

  // ── Section kebab actions ──────────────────────────────────────

  async onMakePayment(section: ClaimSection): Promise<void> {
    const ref = this.dialogSvc.open(MakePaymentModalComponent, {
      data: { section } satisfies MakePaymentModalData,
      width: '500px',
      maxWidth: '92vw',
    });
    const result = await firstValueFrom(ref.afterClosed()) as MakePaymentModalResult | undefined;
    if (!result) return;
    this.toast.success(`Payment of ${result.amount} ${result.currency} submitted for ${section.name}`);
  }

  async onInstructProvider(section: ClaimSection): Promise<void> {
    const ref = this.dialogSvc.open(InstructProviderModalComponent, {
      data: { section } satisfies InstructProviderModalData,
      width: '500px',
      maxWidth: '92vw',
    });
    const result = await firstValueFrom(ref.afterClosed()) as InstructProviderModalResult | undefined;
    if (!result) return;
    this.toast.success(`Instruction sent to ${result.provider} for ${section.name}`);
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
    await firstValueFrom(this.sectionSvc.addEntity(result.sectionId, {
      name:              result.name,
      damage:            result.damage,
      instructionStatus: result.instructionStatus,
    }));
    this.sections.update(list =>
      list.map(s => s.id === result.sectionId
        ? { ...s, entities: [...s.entities, {
            id: `SE-${Date.now()}`,
            name: result.name,
            damage: result.damage,
            instructionStatus: result.instructionStatus,
            expandable: false,
          }] }
        : s
      )
    );
    this.toast.success(`Entity "${result.name}" added`);
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
      data: { entity } satisfies EditEntityDamageModalData,
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

    const updatedNotes = await firstValueFrom(
      this.notesSvc.addNote(claimId, {
        title:   `Coverage review override — ${entity.name}`,
        section: 'general',
        body:    `Coverage review changed to "${result.coverageReview}". Reason: ${result.coverageReviewNote}`,
      })
    );
    this.allNotes.set(updatedNotes);

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
