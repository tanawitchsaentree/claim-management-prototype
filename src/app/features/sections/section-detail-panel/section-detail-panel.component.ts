import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { firstValueFrom } from 'rxjs';
import { ClaimSection } from '../../../core/models/section.model';
import { MockSectionService } from '../../../core/mock/services/mock-section.service';
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

  readonly editingName = signal(false);
  readonly nameDraft   = signal('');

  startEditName(): void {
    this.nameDraft.set(this.section.name);
    this.editingName.set(true);
  }

  cancelEditName(): void {
    this.editingName.set(false);
  }

  async saveName(): Promise<void> {
    const name = this.nameDraft().trim();
    if (!name || name === this.section.name) {
      this.editingName.set(false);
      return;
    }
    const updated = await firstValueFrom(this.sectionSvc.patchSection(this.section.id, { name }));
    this.section = { ...this.section, ...updated };
    this.editingName.set(false);
    this.toast.success(`Section renamed to "${name}"`);
  }
}
