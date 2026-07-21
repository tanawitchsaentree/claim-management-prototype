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
  ],
  templateUrl: './section-detail-panel.component.html',
  styleUrl: './section-detail-panel.component.scss',
})
export class SectionDetailPanelComponent {
  @Input({ required: true }) section!: ClaimSection;
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
