import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl, FormArray, FormControl, FormGroup,
  ReactiveFormsModule, Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { combineLatest, firstValueFrom, Observable } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule, NxMultiSelectComponent } from '@allianz/ng-aquila/dropdown';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxTimefieldModule } from '@allianz/ng-aquila/timefield';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { FnolStateService } from '../../services/fnol-state.service';
import { SkeletonReason } from '../../models/fnol-form.model';
import { MockLookupService } from '../../../../core/mock/services/mock-lookup.service';
import { BrokerSearchModalComponent, BrokerSearchModalResult } from '../../../../shared/components/broker-search-modal/broker-search-modal.component';
import { Broker, LookupOption } from '../../../../core/models';
import { WizardFooterComponent } from '../../../../shared/components/wizard-footer/wizard-footer.component';
import { StatusChipComponent } from '../../../../shared/components/status-chip/status-chip.component';
import { getCauseSchema, DEFAULT_CAUSE_SCHEMA, CauseSchema } from '../../config/cause-schemas';

export type NotifierType = 'broker' | 'insured';

interface ReasonOption { value: SkeletonReason; label: string; }

interface LossInfoVM {
  causeOfLoss: LookupOption[];
  typeOfDamage: LookupOption[];
}

const REASON_OPTIONS: ReasonOption[] = [
  { value: 'policy_not_issued',    label: 'Policy not yet issued' },
  { value: 'policy_not_found',     label: 'Policy not found in system' },
  { value: 'multi_policy_pending', label: 'Multi-policy case (pending investigation)' },
  { value: 'other',                label: 'Other' },
];

@Component({
  selector: 'app-step-skeleton-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxButtonModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule,
    NxMultiSelectComponent,
    NxIconModule,
    NxMessageModule,
    NxSpinnerModule,
    NxRadioModule,
    NxCheckboxModule,
    NxTimefieldModule,
    NxDatefieldModule,
    NxTableModule,
    WizardFooterComponent,
    StatusChipComponent,
  ],
  templateUrl: './step-skeleton-create.component.html',
  styleUrl: './step-skeleton-create.component.scss',
})
export class StepSkeletonCreateComponent implements OnInit {
  private fnolState   = inject(FnolStateService);
  private lookupSvc   = inject(MockLookupService);
  private router      = inject(Router);
  private dialogSvc   = inject(NxDialogService);

  readonly reasonOptions = REASON_OPTIONS;
  readonly maxNotes = 500;
  readonly maxDesc = 500;

  submitted = false;
  readonly notifierType   = signal<NotifierType>('broker');
  readonly notifierBroker = signal<Broker | null>(null);

  // Local form: client / reason / notes / notifier text
  readonly form = new FormGroup({
    clientName:   new FormControl('', [Validators.required, Validators.minLength(2)]),
    reason:       new FormControl<SkeletonReason | null>(null, [Validators.required]),
    notes:        new FormControl('', [Validators.maxLength(500)]),
    notifierText: new FormControl(''),
  });

  // Shared loss-info FormGroup (same shape as happy path)
  readonly lossForm     = this.fnolState.fnolForm.get('lossInformation') as FormGroup;
  readonly dateOfLoss   = this.fnolState.getDateOfLossGroup();
  readonly eventsArray  = this.fnolState.getLossEventsArray();

  vm$!: Observable<LossInfoVM>;

  ngOnInit(): void {
    this.vm$ = combineLatest({
      causeOfLoss:  this.lookupSvc.getCauseOfLoss(),
      typeOfDamage: this.lookupSvc.getTypeOfDamage(),
    });

    const client = this.fnolState.selectedClient;
    if (client?.clientName) {
      this.form.controls.clientName.setValue(client.clientName);
      this.form.controls.clientName.disable();
    }

    const existing = this.fnolState.skeleton;
    if (existing) {
      this.form.patchValue({
        clientName: existing.clientName,
        reason:     existing.reason,
        notes:      existing.notes ?? '',
      });
      if (existing.brokerName) {
        this.notifierType.set('broker');
        this.notifierBroker.set({
          brokerId: existing.brokerIpmId ?? '', partyType: 'company', legalName: existing.brokerName,
          ipmId: existing.brokerIpmId ?? '', address: '', status: 'cleared', country: '',
        });
      } else if (existing.insuredName) {
        this.notifierType.set('insured');
        this.form.controls.notifierText.setValue(existing.insuredName);
      }
    }
  }

  // ── Notifier ────────────────────────────────────────────────
  setNotifierType(t: NotifierType): void {
    this.notifierType.set(t);
    this.form.controls.notifierText.setValue('');
    this.notifierBroker.set(null);
  }

  async openBrokerSearch(): Promise<void> {
    const ref = this.dialogSvc.open(BrokerSearchModalComponent, {
      data: {}, width: '960px', maxWidth: '92vw',
    });
    const picked = await firstValueFrom(ref.afterClosed()) as BrokerSearchModalResult;
    if (!picked) return;
    this.notifierBroker.set(picked);
    this.form.controls.notifierText.setValue(picked.legalName);
  }

  clearBroker(): void {
    this.notifierBroker.set(null);
    this.form.controls.notifierText.setValue('');
  }

  // ── Local form errors ───────────────────────────────────────
  get clientNameError(): string | null {
    const c = this.form.controls.clientName;
    if (!this.submitted && !c.touched) return null;
    if (c.hasError('required')) return 'Client name is required.';
    if (c.hasError('minlength')) return 'Minimum 2 characters.';
    return null;
  }
  get reasonError(): string | null {
    const c = this.form.controls.reason;
    if (!this.submitted && !c.touched) return null;
    if (c.hasError('required')) return 'Please select a reason.';
    return null;
  }
  get notesError(): string | null {
    return this.form.controls.notes.hasError('maxlength') ? `Maximum ${this.maxNotes} characters.` : null;
  }
  get notesLength(): number { return this.form.controls.notes.value?.length ?? 0; }
  get descLength(): number { return (this.lossForm.get('lossDescription')?.value as string)?.length ?? 0; }

  // ── Loss-info shared helpers (mirror happy path) ────────────
  showError(field: AbstractControl): boolean {
    return field.invalid && (field.touched || this.submitted);
  }
  showGroupError(group: AbstractControl, key: string): boolean {
    return !!group.errors?.[key] && (group.touched || this.submitted);
  }

  get selectedCauses(): string[]  { return (this.lossForm.get('causeOfLoss')?.value as string[]) ?? []; }
  get selectedDamages(): string[] { return (this.lossForm.get('typeOfDamage')?.value as string[]) ?? []; }

  getCauseLabel(key: string): string { return getCauseSchema(key)?.causeLabel ?? key; }
  getCausedByOptions(key: string): LookupOption[] | null {
    const opts = getCauseSchema(key)?.causedByOptions;
    return opts && opts.length > 0 ? opts : null;
  }
  trackByEventKey(_i: number, c: AbstractControl): string {
    return (c as FormGroup).get('eventKey')!.value as string;
  }
  eventGroup(i: number): FormGroup { return this.eventsArray.at(i) as FormGroup; }

  onCauseOfLossChange(selected: string[]): void { this._syncEventsArray(selected); }
  onTypeOfDamageChange(_s: string[]): void { /* formControlName handles sync */ }

  private _syncEventsArray(selected: string[]): void {
    for (let i = this.eventsArray.length - 1; i >= 0; i--) {
      if (!selected.includes(this.eventsArray.at(i).get('eventKey')!.value as string)) {
        this.eventsArray.removeAt(i);
      }
    }
    selected.forEach(key => {
      const exists = (this.eventsArray.controls as FormGroup[]).some(g => g.get('eventKey')!.value === key);
      if (!exists) this.eventsArray.push(this._createEventGroup(key));
    });
    const sorted = selected.map(key =>
      (this.eventsArray.controls as FormGroup[]).find(g => g.get('eventKey')!.value === key)!
    ).filter(Boolean);
    while (this.eventsArray.length) this.eventsArray.removeAt(0);
    sorted.forEach(g => this.eventsArray.push(g));
  }

  private _createEventGroup(causeKey: string): FormGroup {
    const schema: CauseSchema = getCauseSchema(causeKey) ?? { causeKey, causeLabel: causeKey, ...DEFAULT_CAUSE_SCHEMA };
    const controls: Record<string, AbstractControl> = {
      eventKey: new FormControl(causeKey),
      damages:  new FormControl<string[]>([], [Validators.required]),
    };
    if (schema.causedByOptions && schema.causedByOptions.length > 0) {
      controls['causedBy'] = new FormControl<string[]>([]);
    }
    return new FormGroup(controls);
  }

  availableDamages(vm: LossInfoVM): LookupOption[] {
    const sel = this.selectedDamages;
    return sel.length ? vm.typeOfDamage.filter(o => sel.includes(o.value)) : vm.typeOfDamage;
  }
  isDamageChecked(idx: number, v: string): boolean {
    return ((this.eventGroup(idx).get('damages')!.value as string[]) ?? []).includes(v);
  }
  onDamageToggle(idx: number, v: string, checked: boolean): void {
    const ctrl = this.eventGroup(idx).get('damages')!;
    const list = [...((ctrl.value as string[]) ?? [])];
    checked ? (list.includes(v) ? null : list.push(v)) : list.splice(list.indexOf(v), 1);
    ctrl.setValue(list);
  }
  isCausedByChecked(idx: number, v: string): boolean {
    return ((this.eventGroup(idx).get('causedBy')?.value as string[]) ?? []).includes(v);
  }
  onCausedByToggle(idx: number, v: string, checked: boolean): void {
    const ctrl = this.eventGroup(idx).get('causedBy');
    if (!ctrl) return;
    const list = [...((ctrl.value as string[]) ?? [])];
    checked ? (list.includes(v) ? null : list.push(v)) : list.splice(list.indexOf(v), 1);
    ctrl.setValue(list);
  }
  // ── Navigation ──────────────────────────────────────────────
  onCancel(): void { this.router.navigate(['/dashboard']); }
  onBack(): void   { this.router.navigate(['/fnol/search']); }

  onNext(): void {
    this.submitted = true;
    this.markAllTouched(this.form);
    this.markAllTouched(this.dateOfLoss);

    if (!this.form.valid || this.dateOfLoss.invalid) return;

    const raw    = this.form.getRawValue();
    const type   = this.notifierType();
    const text   = (raw.notifierText ?? '').trim();
    const broker = this.notifierBroker();

    this.fnolState.setSkeleton(
      {
        clientName:       raw.clientName ?? '',
        reason:           raw.reason as SkeletonReason,
        notes:            raw.notes ?? undefined,
        brokerName:  type === 'broker'  ? (broker?.legalName ?? undefined) : undefined,
        brokerIpmId: type === 'broker'  ? (broker?.ipmId     ?? undefined) : undefined,
        insuredName: type === 'insured' ? (text || undefined)              : undefined,
      },
      this.fnolState.skeletonClaimId ?? '',
    );
    this.fnolState.path = 'orphan';
    this.router.navigate(['/fnol/skeleton-parties']);
  }

  private markAllTouched(g: AbstractControl): void {
    g.markAsTouched();
    if (g instanceof FormGroup) Object.values(g.controls).forEach(c => this.markAllTouched(c));
    else if (g instanceof FormArray) g.controls.forEach(c => this.markAllTouched(c));
  }
}
