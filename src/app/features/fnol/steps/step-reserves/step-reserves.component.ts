import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { FnolStateService } from '../../services/fnol-state.service';
import { MockReservesService } from '../../../../core/mock/services/mock-reserves.service';
import { MockLookupService } from '../../../../core/mock/services/mock-lookup.service';
import { Reserve, ReserveNarrative, ReservesPolicyData, ReserveType, RESERVE_TYPE_LABELS } from '../../../../core/models/reserve.model';
import { LookupOption } from '../../../../core/models/lookup.model';
import { ReserveDetailPanelStubComponent } from '../../components/reserve-detail-panel-stub/reserve-detail-panel-stub.component';
import { AddReserveModalComponent, AddReserveResult } from '../../components/add-reserve-modal/add-reserve-modal.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { WizardFooterComponent } from '../../../../shared/components/wizard-footer/wizard-footer.component';

@Component({
  selector: 'app-step-reserves',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxButtonModule,
    NxIconModule,
    NxTableModule,
    NxMessageModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule,
    NxRadioModule,
    NxContextMenuModule,
    NxModalModule,
    ReserveDetailPanelStubComponent,
    ConfirmDialogComponent,
    WizardFooterComponent,
  ],
  templateUrl: './step-reserves.component.html',
  styleUrl: './step-reserves.component.scss',
})
export class StepReservesComponent implements OnInit, OnDestroy {
  private readonly fb           = inject(FormBuilder);
  private readonly reservesSvc  = inject(MockReservesService);
  private readonly fnolState    = inject(FnolStateService);
  private readonly lookupSvc    = inject(MockLookupService);
  private readonly dialogSvc    = inject(NxDialogService);
  private readonly router       = inject(Router);

  readonly data$      = new BehaviorSubject<ReservesPolicyData | null>(null);
  readonly typeLabels = RESERVE_TYPE_LABELS;

  narrativeOptions: LookupOption[] = [];
  narrativeOpen = false;
  narrativeForm = this.fb.group({
    reasonKey: ['', Validators.required],
    notes:     [''],
  });

  selectedReserve: Reserve | null = null;
  panelOpen = false;

  get policyNumber(): string { return this.fnolState.selectedPolicy?.policyNumber ?? ''; }
  get reserves(): Reserve[]  { return this.data$.value?.reserves ?? []; }
  get totalReserve(): number { return this.data$.value?.totalReserve ?? 0; }
  get allianzShare(): number { return this.data$.value?.allianzShare ?? 50; }

  get narrative(): ReserveNarrative | undefined { return this.data$.value?.narrative; }

  // State 1: totalReserve=0, no saved narrative (or archived)
  get showNarrativeCta(): boolean {
    const n = this.narrative;
    return this.totalReserve === 0 && (!n || !!n.archivedAt);
  }

  // State 3: totalReserve=0, narrative saved and not archived
  get showNarrativeSaved(): boolean {
    const n = this.narrative;
    return this.totalReserve === 0 && !!n && !n.archivedAt;
  }

  get narrativeReasonLabel(): string {
    const n = this.narrative;
    if (!n) return '';
    return this.narrativeOptions.find(o => o.value === n.reasonKey)?.label ?? n.reasonKey;
  }

  async ngOnInit(): Promise<void> {
    if (!this.fnolState.selectedPolicy && !this.fnolState.selectedClient && !this.fnolState.path) {
      this.router.navigate(['/fnol/search']);
      return;
    }
    this.narrativeOptions = await firstValueFrom(this.lookupSvc.getNarrativeOptions());
    this.loadReserves();
  }

  ngOnDestroy(): void {
    this.unlockBodyScroll();
  }

  reserveTypeLabel(type?: ReserveType): string {
    return type ? RESERVE_TYPE_LABELS[type] : '—';
  }

  trackByReserve(_: number, r: Reserve): string { return r.reserveId; }

  // ── Null-reserve explanation ─────────────────────────────────────────────────

  openNarrative(): void {
    this.narrativeOpen = true;
    const n = this.narrative;
    if (n) this.narrativeForm.patchValue({ reasonKey: n.reasonKey, notes: n.notes ?? '' });
    else   this.narrativeForm.reset();
  }

  onCancelNarrative(): void {
    this.narrativeOpen = false;
    this.narrativeForm.reset();
  }

  async onSaveNarrative(): Promise<void> {
    if (this.narrativeForm.invalid) { this.narrativeForm.markAllAsTouched(); return; }
    const { reasonKey, notes } = this.narrativeForm.value;
    const narrative: ReserveNarrative = {
      reasonKey: reasonKey!,
      notes:     notes || undefined,
      savedAt:   new Date().toISOString(),
    };
    await firstValueFrom(this.reservesSvc.setNarrative(this.policyNumber, narrative));
    this.narrativeOpen = false;
    this.loadReserves();
  }

  // ── Add reserve ─────────────────────────────────────────────────────────────

  async onAddReserve(): Promise<void> {
    const ref = this.dialogSvc.open(AddReserveModalComponent, {
      data: { policyNumber: this.policyNumber },
      width: '480px',
    });
    const result = await firstValueFrom(ref.afterClosed()) as AddReserveResult | null | undefined;
    if (!result) return;

    await firstValueFrom(this.reservesSvc.addReserve(this.policyNumber, result));
    this.loadReserves();

    setTimeout(() => {
      const rows = document.querySelectorAll('.reserve-row--recently-added');
      rows[rows.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }

  // ── Kebab actions ────────────────────────────────────────────────────────────

  onViewDetails(reserve: Reserve): void {
    this.selectedReserve = reserve;
    this.panelOpen = true;
    this.lockBodyScroll();
  }

  async onEditReserve(reserve: Reserve): Promise<void> {
    const ref = this.dialogSvc.open(AddReserveModalComponent, {
      data: { policyNumber: this.policyNumber, prefill: reserve },
      width: '480px',
    });
    const result = await firstValueFrom(ref.afterClosed()) as AddReserveResult | null | undefined;
    if (!result) return;
    await firstValueFrom(this.reservesSvc.updateReserve(this.policyNumber, reserve.reserveId, result));
    this.loadReserves();
  }

  async onRemoveReserve(reserve: Reserve): Promise<void> {
    const data: ConfirmDialogData = {
      title:         'Remove reserve',
      message:       `Remove reserve for "${reserve.partyName} — ${reserve.damageType}"?`,
      confirmLabel:  'Remove',
      confirmDanger: true,
    };
    const ref = this.dialogSvc.open(ConfirmDialogComponent, { data, width: '480px' });
    const confirmed = await firstValueFrom(ref.afterClosed()) as boolean | undefined;
    if (!confirmed) return;
    await firstValueFrom(this.reservesSvc.removeReserve(this.policyNumber, reserve.reserveId));
    await this.autoArchiveNarrativeIfNeeded();
    this.loadReserves();
  }

  // ── Panel ────────────────────────────────────────────────────────────────────

  onClosePanel(): void {
    this.panelOpen = false;
    this.unlockBodyScroll();
    setTimeout(() => { if (!this.panelOpen) this.selectedReserve = null; }, 300);
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  onCancel(): void { this.router.navigate(['/dashboard']); }
  onBack(): void   { this.router.navigate(['/fnol/parties']); }
  onNext(): void   { this.fnolState.markStepComplete('reserves'); this.router.navigate(['/fnol/summary']); }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async loadReserves(): Promise<void> {
    const data = await firstValueFrom(this.reservesSvc.getReservesForPolicy(this.policyNumber));
    this.data$.next(data);
  }

  private async autoArchiveNarrativeIfNeeded(): Promise<void> {
    const data = this.data$.value;
    if (!data || !data.narrative || data.narrative.archivedAt) return;
    const total = data.reserves.reduce((s, r) => s + (r.amount || 0), 0);
    if (total > 0) {
      await firstValueFrom(this.reservesSvc.archiveNarrative(this.policyNumber));
    }
  }

  private lockBodyScroll(): void   { document.body.style.overflow = 'hidden'; }
  private unlockBodyScroll(): void { document.body.style.overflow = ''; }
}
