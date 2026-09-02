import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { firstValueFrom } from 'rxjs';
import { ClaimSection } from '../../../core/models/section.model';
import { MockSectionService } from '../../../core/mock/services/mock-section.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { CircumstanceLabelPipe } from '../../../shared/pipes/circumstance-label.pipe';

@Component({
  selector: 'app-section-detail',
  standalone: true,
  imports: [
    CommonModule,
    NxButtonModule,
    NxIconModule,
    NxFormfieldModule,
    NxInputModule,
    NxModalModule,
    StatusChipComponent,
    CircumstanceLabelPipe,
  ],
  templateUrl: './section-detail-panel.component.html',
  styleUrl: './section-detail-panel.component.scss',
})
export class SectionDetailPanelComponent {
  @Input({ required: true }) section!: ClaimSection;
  @Input() claimClosed = false;
  /**
   * BMPCC-18160 — the claim's incident circumstance key, shown read-only.
   * Comes from the claim, not the section: see ASSUMPTION [CIRC-4]. When the
   * real model moves it onto the section this becomes section.circumstance and
   * the input goes away — no other caller depends on it.
   */
  @Input() incidentCircumstance: string | null = null;
  @Output() closed = new EventEmitter<void>();

  private readonly sectionSvc = inject(MockSectionService);
  private readonly toast      = inject(ToastService);
  private readonly dialogSvc  = inject(NxDialogService);

  readonly editingName = signal(false);
  readonly nameDraft   = signal('');

  startEditName(): void {
    this.nameDraft.set(this.section.name);
    this.editingName.set(true);
  }

  cancelEditName(): void {
    this.editingName.set(false);
  }

  // Confirms before writing (2026-09-02: no save commits silently). A section
  // name is referenced from the closure checklist, reserves and the entity tree,
  // so a rename is not a local edit — worth one look at the old and new value.
  async saveName(): Promise<void> {
    const name = this.nameDraft().trim();
    if (!name || name === this.section.name) {
      this.editingName.set(false);
      return;
    }

    const data: ConfirmDialogData = {
      title: 'Rename section',
      message: 'The new name is used everywhere this section is referenced — reserves, the entity tree and the closure checklist.',
      changes: [{ label: 'Section name', original: this.section.name, updated: name }],
      confirmLabel: 'Rename',
      cancelLabel: 'Keep editing',
    };
    const ref = this.dialogSvc.open(ConfirmDialogComponent, { data, width: '520px', maxWidth: '92vw' });
    if (await firstValueFrom(ref.afterClosed()) !== true) return;

    const updated = await firstValueFrom(this.sectionSvc.patchSection(this.section.id, { name }));
    this.section = { ...this.section, ...updated };
    this.editingName.set(false);
    this.toast.success(`Section renamed to "${name}"`);
  }
}
