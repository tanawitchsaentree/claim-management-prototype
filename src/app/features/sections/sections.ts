import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { firstValueFrom, catchError, of } from 'rxjs';
import { ClaimSection, SectionEntity, CoverageReview } from '../../core/models/section.model';
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
import {
  AddCommentModalComponent,
  AddCommentModalData,
} from './add-comment-modal/add-comment-modal.component';

@Component({
  selector: 'app-sections',
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
    AddCommentModalComponent,
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

  readonly sections  = signal<ClaimSection[]>([]);
  readonly loading   = signal(true);
  readonly loadError = signal(false);
  readonly devMode   = true; // always show dev tools in prototype

  constructor() {
    effect(async () => {
      const id = this.route.snapshot.params['id'];
      if (!id) return;
      this.loading.set(true);
      this.loadError.set(false);
      try {
        const sections = await firstValueFrom(this.sectionSvc.getByClaimId(id));
        this.sections.set(sections);
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

  async onSimulateFinalPayment(section: ClaimSection): Promise<void> {
    const claimId = this.route.snapshot.params['id'];
    try {
      const closed = await firstValueFrom(
        this.closureSvc.triggerFinalPaymentAndClose(claimId, section.id).pipe(
          catchError(err => {
            this.toast.error(
              'Simulate Final Payment failed',
              err?.message ?? 'Check section blockers.',
            );
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

  coverageClass(review: CoverageReview): string {
    return review.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '');
  }

  async onOverrideCoverageReview(section: ClaimSection, entity: SectionEntity): Promise<void> {
    const ref = this.dialogSvc.open(CoverageReviewModalComponent, {
      data: { entity } satisfies CoverageReviewModalData,
      width: '480px',
      maxWidth: '92vw',
    });

    const result = await firstValueFrom(ref.afterClosed()) as CoverageReviewModalResult | undefined;
    if (!result) return;

    await firstValueFrom(this.sectionSvc.patchEntity(section.id, entity.id, result));
    this.sections.update(list =>
      list.map(s => s.id === section.id
        ? { ...s, entities: s.entities.map(e => e.id === entity.id ? { ...e, ...result } : e) }
        : s
      )
    );
    this.toast.success(`Coverage review updated for "${entity.name}"`);
  }

  onAddComment(attachTo: string): void {
    const claimId = this.route.snapshot.params['id'];
    this.dialogSvc.open(AddCommentModalComponent, {
      data: { claimId, attachTo } satisfies AddCommentModalData,
      width: '480px',
      maxWidth: '92vw',
    });
  }

  onAction(action: string, name: string): void {
    console.log(`${action}: ${name}`);
  }
}
