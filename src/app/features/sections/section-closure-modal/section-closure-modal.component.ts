import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { firstValueFrom } from 'rxjs';
import { ClaimSection, SectionClosureReason } from '../../../core/models/section.model';
import { Blocker } from '../../../core/models/claim-closure.model';
import { RouterModule } from '@angular/router';
import { MockSectionService } from '../../../core/mock/services/mock-section.service';

export interface SectionClosureModalData {
  section: ClaimSection;
  blockers: Blocker[];
  canClose: boolean;
}

export type SectionClosureModalResult = ClaimSection;

type Step = 1 | 2 | 3;

const CLOSURE_REASONS: SectionClosureReason[] = [
  'Section Finalised',
  'Section Not Pursued',
  'Section Rejected',
];

interface ChecklistItem {
  label: string;
  passed: boolean;
  failHint: string;
}

const CURRENT_USER = { userId: 'MM001', name: 'Mara Mustermann' };

@Component({
  selector: 'app-section-closure-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    NxModalModule,
    NxButtonModule,
    NxIconModule,
    NxSpinnerModule,
    NxMessageModule,
    NxFormfieldModule,
    NxDropdownModule,
  ],
  templateUrl: './section-closure-modal.component.html',
  styleUrl: './section-closure-modal.component.scss',
})
export class SectionClosureModalComponent {
  readonly data      = inject<SectionClosureModalData>(NX_MODAL_DATA);
  readonly modalRef  = inject<NxModalRef<SectionClosureModalComponent, SectionClosureModalResult>>(NxModalRef);
  private readonly sectionSvc = inject(MockSectionService);
  private readonly fb         = inject(FormBuilder);

  readonly step      = signal<Step>(this.data.canClose ? 2 : 1);
  readonly saving    = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly expanded  = signal<Set<string>>(new Set());

  readonly closureReasons = CLOSURE_REASONS;

  readonly checklistItems: ChecklistItem[] = [
    { label: 'No open deductible tasks',          passed: !this.data.section.hasOpenDeductible,   failHint: 'Open deductible task must be closed first.' },
    { label: 'No active litigation',              passed: !this.data.section.hasActiveLitigation, failHint: 'Active litigation must be resolved.' },
    { label: 'No pending subrogation or salvage', passed: !this.data.section.hasSubrogation && !this.data.section.hasActiveSalvage, failHint: 'Pending recovery activity must be resolved.' },
    { label: 'Reserves released to zero',         passed: !this.data.section.hasOpenReserves,     failHint: 'All reserves must be released before closing.' },
    { label: 'All payments settled',              passed: !this.data.section.hasOpenPayments,     failHint: 'Pending payments must be settled.' },
    { label: 'No active provider assignment',     passed: !this.data.section.hasActiveProvider,   failHint: 'Active provider assignment must be finalised.' },
  ];

  readonly checklistAllDone = computed(() => this.checklistItems.every(i => i.passed));

  readonly form = this.fb.group({
    reason: [null as SectionClosureReason | null, Validators.required],
  });

  readonly stepTitle = computed(() => {
    switch (this.step()) {
      case 1: return `Close Section — Blockers`;
      case 2: return `Close Section — Pre-closure Checklist`;
      case 3: return `Close Section — Reason`;
    }
  });

  get blockers() { return this.data.blockers; }
  get section()  { return this.data.section; }

  readonly reasonInvalid = computed(() => this.form.get('reason')!.invalid);

  toggleBlocker(key: string): void {
    this.expanded.update(set => {
      const next = new Set(set);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  isExpanded(key: string): boolean {
    return this.expanded().has(key);
  }

  onCancel(): void { this.modalRef.close(undefined); }

  onBack(): void {
    if (this.step() === 3) this.step.set(2);
  }

  onContinue(): void {
    if (this.step() === 2 && this.checklistAllDone()) this.step.set(3);
  }

  async onCloseSection(): Promise<void> {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const reason = this.form.get('reason')!.value as SectionClosureReason;
      const closed = await firstValueFrom(
        this.sectionSvc.closeSection(this.section.id, CURRENT_USER, reason)
      );
      this.modalRef.close(closed);
    } catch {
      this.saveError.set('Failed to close section. Please try again.');
      this.saving.set(false);
    }
  }
}
