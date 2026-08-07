import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import { NxTabsModule } from '@allianz/ng-aquila/tabs';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxAccordionModule } from '@allianz/ng-aquila/accordion';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { StatusChipComponent } from '../../../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { Litigation, LitigationStatus, LitigationType, LitigationExpense } from '../../../../core/models';
import { Party } from '../../../../core/models/party.model';
import {
  AddLitigationPartyModalComponent,
  AddLitigationPartyModalData,
  LitigationPartyKind,
} from '../components/add-litigation-party-modal/add-litigation-party-modal.component';

const STATUS_CHIP_MAP: Record<LitigationStatus, string> = {
  Draft:         'open',
  'In progress': 'in-progress',
  Closed:        'closed',
};

@Component({
  selector: 'app-litigation-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxIconModule,
    NxButtonModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule,
    NxDatefieldModule,
    NxTabsModule,
    NxTableModule,
    NxAccordionModule,
    NxModalModule,
    StatusChipComponent,
    EmptyStateComponent,
  ],
  templateUrl: './litigation-detail.component.html',
  styleUrl: './litigation-detail.component.scss',
})
export class LitigationDetailComponent implements OnChanges {
  @Input({ required: true }) model!: Litigation;
  @Output() close = new EventEmitter<void>();
  @Output() save  = new EventEmitter<Litigation>();

  private readonly toast = inject(ToastService);
  private readonly dialogSvc = inject(NxDialogService);

  readonly types: LitigationType[] = ['Coverage', 'Defense', 'Recovery', 'Pursuit'];
  readonly currencies = ['EUR', 'USD', 'GBP'] as const;
  readonly subTypes   = ['Litigation', 'Legal fees', 'Other'] as const;
  readonly sections   = ['BI', 'PD', 'PI'] as const;

  readonly form = new FormGroup({
    startDate:    new FormControl<string>(''),
    type:         new FormControl<LitigationType | ''>(''),
    title:        new FormControl<string>(''),
    description:  new FormControl<string>(''),
    jurisdiction: new FormControl<string>(''),
  });

  readonly expenses = signal<LitigationExpense[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['model'] && this.model) {
      this.form.reset({
        startDate:    this.model.startDate ?? '',
        type:         this.model.type ?? '',
        title:        this.model.title ?? '',
        description:  this.model.description ?? '',
        jurisdiction: this.model.jurisdiction ?? '',
      });
      this.expenses.set([...this.model.expenses]);
    }
  }

  chipStatus(s: LitigationStatus): string { return STATUS_CHIP_MAP[s]; }

  addExpense(): void {
    this.expenses.update(list => [...list, {
      rowId:    `EXP-${Date.now()}`,
      subType:  'Litigation',
      currency: 'EUR',
      amount:   0,
      section:  'BI',
    }]);
  }

  removeExpense(rowId: string): void {
    this.expenses.update(list => list.filter(e => e.rowId !== rowId));
  }

  updateExpense<K extends keyof LitigationExpense>(rowId: string, field: K, value: LitigationExpense[K]): void {
    this.expenses.update(list => list.map(e => e.rowId === rowId ? { ...e, [field]: value } : e));
  }

  notImplemented(label: string): void {
    this.toast.info(`${label} — coming soon`);
  }

  async openAddParty(kind: LitigationPartyKind): Promise<void> {
    const data: AddLitigationPartyModalData = { kind };
    const ref = this.dialogSvc.open(AddLitigationPartyModalComponent, { data, width: '960px', maxWidth: '92vw' });
    const selected = await firstValueFrom(ref.afterClosed()) as Party | null | undefined;
    if (!selected) return;
    const partyRef = { partyId: selected.partyId, name: selected.legalName };
    const next: Litigation = { ...this.model };
    switch (kind) {
      case 'plaintiff':       next.plaintiff       = partyRef; break;
      case 'defendant':       next.defendant       = partyRef; break;
      case 'attorney':        next.attorney        = { attorneyId: selected.partyId, name: selected.legalName }; break;
      case 'opposing-lawyer': next.opposingLawyer  = { attorneyId: selected.partyId, name: selected.legalName }; break;
    }
    this.save.emit(next);
  }

  onSave(): void {
    const v = this.form.getRawValue();
    const next: Litigation = {
      ...this.model,
      startDate:    v.startDate    ?? '',
      type:         (v.type ?? '') as LitigationType | '',
      title:        v.title        ?? '',
      description:  v.description  ?? '',
      jurisdiction: v.jurisdiction ?? '',
      expenses:     this.expenses(),
      status:       this.model.status === 'Draft' && v.startDate && v.type ? 'In progress' : this.model.status,
    };
    this.save.emit(next);
  }
}
