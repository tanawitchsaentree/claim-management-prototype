import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { firstValueFrom } from 'rxjs';
import { ClaimClosureService } from '../../../../../core/services/claim-closure.service';
import { MockSectionService } from '../../../../../core/mock/services/mock-section.service';
import { ClaimOverview } from '../../../../../core/models/claim-overview.model';
import { ClaimSection } from '../../../../../core/models/section.model';
import { ReopenPayload } from '../../../../../core/models/claim-closure.model';
import { SectionReopenReason } from '../../../../../core/models/section.model';

export interface ClaimReopenModalData {
  claim: ClaimOverview;
}

export interface ClaimReopenModalResult {
  reopenedClaim: ClaimOverview;
  reopenedSectionIds: string[];
}

type Step = 1 | 2;

@Component({
  selector: 'app-claim-reopen-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule,
    NxButtonModule,
    NxIconModule,
    NxSpinnerModule,
    NxMessageModule,
    NxCheckboxModule,
  ],
  templateUrl: './claim-reopen-modal.component.html',
  styleUrl: './claim-reopen-modal.component.scss',
})
export class ClaimReopenModalComponent {
  readonly data       = inject<ClaimReopenModalData>(NX_MODAL_DATA);
  readonly modalRef   = inject<NxModalRef<ClaimReopenModalComponent, ClaimReopenModalResult>>(NxModalRef);
  private readonly fb         = inject(FormBuilder);
  private readonly closureSvc = inject(ClaimClosureService);
  private readonly sectionSvc = inject(MockSectionService);

  readonly reopenReasons: string[] = [
    'New evidence received',
    'Additional damage discovered',
    'Settlement disputed by claimant',
    'Recovery / subrogation opportunity',
    'Court ruling / litigation outcome',
    'Other',
  ];

  readonly sectionReopenReasons: SectionReopenReason[] = [
    'New information received',
    'Additional claim activity',
    'Reassessment required',
    'Error correction',
    'Other',
  ];

  readonly form = this.fb.group({
    reason: [null as string | null, Validators.required],
    note:   [''],
  });

  readonly step          = signal<Step>(1);
  readonly saving        = signal(false);
  readonly saveError     = signal<string | null>(null);
  readonly loadingSecs   = signal(true);
  readonly closedSections = signal<ClaimSection[]>([]);
  readonly selectedIds   = signal<Set<string>>(new Set());

  readonly stepTitle = computed(() =>
    this.step() === 1 ? 'Reopen claim — Reason' : 'Reopen claim — Select sections'
  );

  readonly isSingleSection = computed(() => this.closedSections().length === 1);

  readonly canContinue = computed(() => {
    if (this.step() === 1) return this.form.valid;
    if (this.isSingleSection()) return true;
    return this.selectedIds().size > 0;
  });

  get claim() { return this.data.claim; }

  constructor() {
    this.loadClosedSections();
  }

  private async loadClosedSections(): Promise<void> {
    this.loadingSecs.set(true);
    try {
      const all = await firstValueFrom(this.sectionSvc.getByClaimId(this.claim.claimId));
      const closed = all.filter(s => s.status === 'Closed');
      this.closedSections.set(closed);
      if (closed.length === 1) {
        this.selectedIds.set(new Set([closed[0].id]));
      }
    } finally {
      this.loadingSecs.set(false);
    }
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  entitySummary(section: ClaimSection): string {
    if (section.entities.length === 0) return 'No linked entities';
    return section.entities.map(e => e.name).join(', ');
  }

  toggleSection(id: string): void {
    this.selectedIds.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  onCancel(): void { this.modalRef.close(undefined as unknown as ClaimReopenModalResult); }

  onBack(): void {
    if (this.step() === 2) this.step.set(1);
  }

  onContinue(): void {
    if (this.step() === 1) {
      if (this.form.invalid) { this.form.markAllAsTouched(); return; }
      this.step.set(2);
    }
  }

  async onReopen(): Promise<void> {
    if (!this.canContinue() || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);

    const v = this.form.value;
    const reason = v.note?.trim() ? `${v.reason} — ${v.note!.trim()}` : v.reason!;
    const reopenedBy = { userId: 'usr-current', name: this.claim.assignedHandler };

    const payload: ReopenPayload = {
      reason,
      reserveAmount: 0,
      reserveType:   'Initial reserve',
      reopenedBy,
    };

    try {
      const reopened = await firstValueFrom(this.closureSvc.reopenClaim(this.claim.claimId, payload));

      const sectionReason: SectionReopenReason = 'New information received';
      const ids = [...this.selectedIds()];
      for (const sectionId of ids) {
        await firstValueFrom(this.sectionSvc.reopenSection(sectionId, reopenedBy, sectionReason));
      }

      this.modalRef.close({ reopenedClaim: reopened, reopenedSectionIds: ids });
    } catch {
      this.saveError.set('Failed to reopen claim. Please try again.');
      this.saving.set(false);
    }
  }
}
