import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { ClaimSection, SectionClosureReason } from '../../core/models/section.model';
import { MockSectionService } from '../../core/mock/services/mock-section.service';
import { MockLookupService } from '../../core/mock/services/mock-lookup.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { AppDatePipe } from '../../shared/pipes/app-date.pipe';
import {
  BulkClosureModalComponent,
  BulkClosureModalData,
  BulkClosureModalResult
} from '../../shared/components/bulk-closure-modal/bulk-closure-modal.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  SectionReopenModalComponent,
  SectionReopenModalData,
  SectionReopenModalResult
} from './section-reopen-modal/section-reopen-modal.component';
import {
  SectionDolModalComponent,
  SectionDolModalData,
  SectionDolModalResult
} from './section-dol-modal/section-dol-modal.component';

const SECTION_CLOSURE_REASONS: SectionClosureReason[] = [
  'Section Finalised',
  'Section Not Pursued',
  'Section Rejected'
];
const CURRENT_USER = { userId: 'MM001', name: 'Mara Mustermann' };

/**
 * Section overview's selection actions (BMPCC-22328 AC01 + BMPCC-22660 AC02),
 * kept out of sections.ts, which is already over the file size limit.
 * Provided on the Sections component.
 */
@Injectable()
export class SectionsBulkActionsService {
  private readonly dialogSvc = inject(NxDialogService);
  private readonly sectionSvc = inject(MockSectionService);
  private readonly lookupSvc = inject(MockLookupService);
  private readonly toast = inject(ToastService);

  /** "Type of coverage": the section's own cover, else the default for its damage type. */
  coverageOf(section: ClaimSection): string {
    return (
      section.typeOfCoverage ?? this.lookupSvc.getDefaultCoverageSync(section.damageType) ?? '–'
    );
  }

  /** Two or more open sections: one bulk closure. Returns true when anything ran. */
  async closeSections(sections: ClaimSection[]): Promise<boolean> {
    const ref = this.dialogSvc.open(BulkClosureModalComponent, {
      data: {
        kind: 'section',
        ids: sections.map(s => s.id),
        reasons: SECTION_CLOSURE_REASONS,
        actor: CURRENT_USER
      } satisfies BulkClosureModalData,
      width: '640px',
      maxWidth: '92vw'
    });
    const result = (await firstValueFrom(ref.afterClosed())) as BulkClosureModalResult;
    return !!result?.length;
  }

  /** One or more closed sections, one reason. The modal lists exactly which ones. */
  async reopenSections(sections: ClaimSection[]): Promise<ClaimSection[]> {
    const ref = this.dialogSvc.open(SectionReopenModalComponent, {
      data: {
        section: sections[0],
        sections,
        reopenedByName: 'Leonie Fischer'
      } satisfies SectionReopenModalData,
      width: '480px',
      maxWidth: '92vw'
    });
    const result = (await firstValueFrom(ref.afterClosed())) as
      | SectionReopenModalResult
      | undefined;
    if (!result) return [];
    const n = result.reopenedSections.length;
    this.toast.success(
      n === 1 ? `Section "${result.reopenedSection.name}" reopened` : `${n} sections reopened`,
      n === 1 ? undefined : result.reopenedSections.map(s => s.name).join(', ')
    );
    return result.reopenedSections;
  }

  /**
   * Section date of loss (BMPCC-22328 AC03): pick, confirm with
   * Field / Original / Updated (same as Edit claim), save, toast.
   */
  async changeDateOfLoss(
    section: ClaimSection,
    claimDateOfLoss: string | undefined
  ): Promise<ClaimSection | null> {
    const ref = this.dialogSvc.open(SectionDolModalComponent, {
      data: { section, claimDateOfLoss } satisfies SectionDolModalData,
      width: '480px',
      maxWidth: '92vw'
    });
    const result = (await firstValueFrom(ref.afterClosed())) as SectionDolModalResult | undefined;
    if (!result || result.dateOfLoss === section.dateOfLoss) return null;

    const fmt = new AppDatePipe();
    const describe = (own: string | undefined): string =>
      own ? fmt.transform(own) : `${fmt.transform(claimDateOfLoss) || '–'} (same as claim)`;
    const confirm = this.dialogSvc.open(ConfirmDialogComponent, {
      data: {
        title: 'Confirm date of loss change',
        message: `The following field will be updated for ${section.name}. The claim's date of loss does not change.`,
        changes: [
          {
            label: 'Section date of loss',
            original: describe(section.dateOfLoss),
            updated: describe(result.dateOfLoss)
          }
        ],
        showChanges: true,
        hideIcon: true,
        confirmLabel: 'Confirm changes',
        cancelLabel: 'Back to editing'
      } satisfies ConfirmDialogData,
      width: '600px',
      maxWidth: '92vw'
    });
    if (!(await firstValueFrom(confirm.afterClosed()))) return null;

    const updated = await firstValueFrom(
      this.sectionSvc.patchSection(section.id, { dateOfLoss: result.dateOfLoss })
    );
    this.toast.success(
      'Section date of loss updated',
      `${section.name}: ${describe(result.dateOfLoss)}`
    );
    return updated;
  }
}
