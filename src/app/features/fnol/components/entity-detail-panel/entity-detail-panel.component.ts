import { Component, EventEmitter, HostListener, inject, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { StatusChipComponent } from '../../../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { EntityRow, DamageItem } from '../../../../core/models/entity-damage.model';
import { LookupOption } from '../../../../core/models/lookup.model';
import { MockEntitiesDamagesService } from '../../../../core/mock/services/mock-entities-damages.service';
import { MockLookupService } from '../../../../core/mock/services/mock-lookup.service';
import { FnolStateService } from '../../services/fnol-state.service';

@Component({
  selector: 'app-entity-detail-panel',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxButtonModule,
    NxIconModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule,
    StatusChipComponent,
    EmptyStateComponent,
  ],
  templateUrl: './entity-detail-panel.component.html',
  styleUrl: './entity-detail-panel.component.scss',
})
export class EntityDetailPanelComponent implements OnChanges {
  private readonly entitiesSvc = inject(MockEntitiesDamagesService);
  private readonly lookupSvc   = inject(MockLookupService);
  private readonly fnolState   = inject(FnolStateService);

  @Input({ required: true }) entity!: EntityRow;
  @Input() policyNumber = '';
  @Input() open = false;
  @Output() closePanel  = new EventEmitter<void>();
  @Output() itemSaved   = new EventEmitter<void>();

  currency        = 'EUR';
  addingItem      = false;
  savingItem      = false;
  causeOptions:   LookupOption[] = [];

  readonly itemForm = new FormGroup({
    description: new FormControl('',  [Validators.required, Validators.minLength(3)]),
    causeOfLoss: new FormControl('',  [Validators.required]),
    amount:      new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
  });

  ngOnChanges(): void {
    const hasLoc = (this.fnolState.getLossLocationControl().value?.locations?.length ?? 0) > 0;
    const currencySource = (hasLoc ? this.entity?.limits?.[0]?.value : null) ?? this.entity?.limit ?? '';
    const match = currencySource.match(/\b(EUR|USD|GBP|CHF)\b/);
    this.currency = match?.[1] ?? 'EUR';
    this.loadCauseOptions();
    // Reset add form when entity switches
    if (this.addingItem) this.cancelAddItem();
  }

  get hasItems(): boolean {
    return (this.entity?.damageItems?.length ?? 0) > 0;
  }

  get hasLossLocation(): boolean {
    return (this.fnolState.getLossLocationControl().value?.locations?.length ?? 0) > 0;
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.addingItem) { this.cancelAddItem(); return; }
    if (this.open) this.closePanel.emit();
  }

  onClose(): void { this.closePanel.emit(); }

  startAddItem(): void {
    this.itemForm.reset();
    this.addingItem = true;
  }

  cancelAddItem(): void {
    this.addingItem = false;
    this.itemForm.reset();
  }

  async saveItem(): Promise<void> {
    this.itemForm.markAllAsTouched();
    if (this.itemForm.invalid) return;

    this.savingItem = true;
    const { description, causeOfLoss, amount } = this.itemForm.value;
    const newItem: DamageItem = {
      itemId:      `DMG-NEW-${Date.now()}`,
      description: description!,
      causeOfLoss: causeOfLoss!,
      amount:      amount!,
      currency:    this.currency,
      status:      'open',
      documents:   [],
    };

    await firstValueFrom(this.entitiesSvc.addDamageItem(this.policyNumber, this.entity.entityId, newItem));

    // Mutate local reference so view updates without a full refresh
    this.entity.damageItems = [...(this.entity.damageItems ?? []), newItem];
    this.savingItem = false;
    this.addingItem = false;
    this.itemForm.reset();
    this.itemSaved.emit();
  }

  private async loadCauseOptions(): Promise<void> {
    // Prefer causes already selected in step 2; fall back to full lookup list
    const selected = this.fnolState.fnolForm.get('lossInformation.causeOfLoss')?.value as string[] | undefined;
    if (selected?.length) {
      const all = await firstValueFrom(this.lookupSvc.getCauseOfLoss());
      this.causeOptions = all.filter(o => selected.includes(o.value));
    } else {
      this.causeOptions = await firstValueFrom(this.lookupSvc.getCauseOfLoss());
    }
  }
}
