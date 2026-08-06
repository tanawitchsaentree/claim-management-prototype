import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { MassEvent } from '../../../core/models';
import { MockMassEventService } from '../../../core/mock/services/mock-mass-event.service';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

export interface MassEventSearchModalData {
  currentMassEventId?: string;
}

export type MassEventSearchModalResult =
  | { kind: 'picked'; event: MassEvent }
  | { kind: 'fallback-manual'; seedQuery?: string }
  | null;

@Component({
  selector: 'app-mass-event-search-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxInputModule,
    NxButtonModule,
    NxIconModule,
    NxRadioModule,
    NxTableModule,
    EmptyStateComponent,
  ],
  templateUrl: './mass-event-search-modal.component.html',
  styleUrl: './mass-event-search-modal.component.scss',
})
export class MassEventSearchModalComponent implements OnInit {
  readonly data     = inject<MassEventSearchModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<MassEventSearchModalComponent, MassEventSearchModalResult>>(NxModalRef);
  private readonly massEventSvc = inject(MockMassEventService);

  readonly searchForm = new FormGroup({
    id:   new FormControl(''),
    code: new FormControl(''),
    name: new FormControl(''),
  });

  readonly results      = signal<MassEvent[]>([]);
  readonly selectedId   = signal<string | null>(null);
  readonly hasSelection = computed(() => this.selectedId() !== null);

  async ngOnInit(): Promise<void> {
    this.selectedId.set(this.data.currentMassEventId ?? null);
    await this.runSearch();
  }

  async onSearch(): Promise<void> {
    await this.runSearch();
  }

  async onReset(): Promise<void> {
    this.searchForm.reset();
    await this.runSearch();
  }

  private async runSearch(): Promise<void> {
    const { id, code, name } = this.searchForm.value;
    const found = await firstValueFrom(this.massEventSvc.search({
      id: id || undefined,
      code: code || undefined,
      name: name || undefined,
    }));
    this.results.set(found);
  }

  isSelected(id: string): boolean { return this.selectedId() === id; }

  selectRow(id: string): void {
    this.selectedId.set(id);
  }

  onCancel(): void { this.modalRef.close(null); }

  onCreateManually(): void {
    const seed = this.searchForm.value.name?.trim() || undefined;
    this.modalRef.close({ kind: 'fallback-manual', seedQuery: seed });
  }

  onConfirm(): void {
    const id = this.selectedId();
    if (!id) return;
    const event = this.results().find(e => e.id === id);
    if (!event) return;
    this.modalRef.close({ kind: 'picked', event });
  }
}
