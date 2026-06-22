import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { firstValueFrom } from 'rxjs';
import { ClaimSection, InstructionStatus } from '../../core/models/section.model';
import { MockSectionService } from '../../core/mock/services/mock-section.service';
import { ClaimClosureService } from '../../core/services/claim-closure.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { StatusChipComponent } from '../../shared/components/status-chip/status-chip.component';
import {
  SectionClosureModalComponent,
  SectionClosureModalData,
  SectionClosureModalResult,
} from './section-closure-modal/section-closure-modal.component';

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
  ],
  templateUrl: './sections.html',
  styleUrl: './sections.scss',
})
export class Sections {
  private readonly route      = inject(ActivatedRoute);
  private readonly sectionSvc = inject(MockSectionService);
  private readonly closureSvc = inject(ClaimClosureService);
  private readonly dialogSvc  = inject(NxDialogService);
  private readonly toast      = inject(ToastService);

  readonly sections  = signal<ClaimSection[]>([]);
  readonly loading   = signal(true);
  readonly loadError = signal(false);

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

  statusClass(status: InstructionStatus): string {
    return status.toLowerCase().replace(/\s+/g, '-');
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
      this.toast.info(
        'All sections closed',
        'Claim can now be closed — navigate to Overview.',
      );
    }
  }

  onAction(action: string, name: string): void {
    console.log(`${action}: ${name}`);
  }
}
