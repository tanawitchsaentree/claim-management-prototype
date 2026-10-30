import { Component, Input, computed, signal } from '@angular/core';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { ClaimSection, SectionEntity } from '../../../../../core/models/section.model';
import { StatusChipComponent } from '../../../../../shared/components/status-chip/status-chip.component';
import { DamageTypeLabelPipe } from '../../../../../shared/pipes/damage-type-label.pipe';

// BMPCC-22357 (Instruction creation, Open/Closed section badge on damage
// selection) — team asked for a read-only row example. Rows under a Closed
// section keep their text at normal contrast but their checkbox is disabled,
// same as production's custom-event-table (claims-management-entities-damages,
// [disabled]="true" on nx-checkbox). Select all only ever touches open rows.
@Component({
  selector: 'app-instruction-damage-table',
  standalone: true,
  imports: [
    NxTableModule,
    NxButtonModule,
    NxIconModule,
    NxCheckboxModule,
    NxTooltipModule,
    StatusChipComponent,
    DamageTypeLabelPipe
  ],
  templateUrl: './instruction-damage-table.component.html',
  styleUrl: './instruction-damage-table.component.scss'
})
export class InstructionDamageTableComponent {
  private readonly sectionsSig = signal<ClaimSection[]>([]);
  @Input({ required: true }) set sections(value: ClaimSection[]) {
    this.sectionsSig.set(value);
    this.expanded.set(new Set(value.filter(s => s.entities.length > 0).map(s => s.id)));
  }
  get sections(): ClaimSection[] {
    return this.sectionsSig();
  }

  readonly closedTooltip = 'Section closed. Reopen the section to instruct a provider.';

  readonly expanded = signal<Set<string>>(new Set());
  readonly selected = signal<Set<string>>(new Set());

  private readonly selectableKeys = computed(() =>
    this.sectionsSig()
      .filter(s => !this.isReadOnly(s))
      .flatMap(s => s.entities.map(e => this.key(s, e)))
  );

  readonly allChecked = computed(() => {
    const keys = this.selectableKeys();
    return keys.length > 0 && keys.every(k => this.selected().has(k));
  });

  readonly someChecked = computed(
    () => !this.allChecked() && this.selectableKeys().some(k => this.selected().has(k))
  );

  isReadOnly(section: ClaimSection): boolean {
    return section.status === 'Closed';
  }

  key(section: ClaimSection, entity: SectionEntity): string {
    return `${section.id}:${entity.id}`;
  }

  isExpanded(section: ClaimSection): boolean {
    return this.expanded().has(section.id);
  }

  toggleSection(section: ClaimSection): void {
    const next = new Set(this.expanded());
    if (next.has(section.id)) next.delete(section.id);
    else next.add(section.id);
    this.expanded.set(next);
  }

  isChecked(section: ClaimSection, entity: SectionEntity): boolean {
    return this.selected().has(this.key(section, entity));
  }

  toggleEntity(section: ClaimSection, entity: SectionEntity, checked: boolean): void {
    if (this.isReadOnly(section)) return;
    const next = new Set(this.selected());
    if (checked) next.add(this.key(section, entity));
    else next.delete(this.key(section, entity));
    this.selected.set(next);
  }

  toggleAll(checked: boolean): void {
    this.selected.set(checked ? new Set(this.selectableKeys()) : new Set());
  }

  instructionChip(entity: SectionEntity): string {
    return entity.instructionStatus.toLowerCase().replace(' ', '-');
  }
}
