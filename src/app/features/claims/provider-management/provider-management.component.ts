import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { MockProviderService } from '../../../core/mock/services/mock-provider.service';
import { MockLossAdjusterSurveyService } from '../../../core/mock/services/mock-loss-adjuster-survey.service';
import { ProviderAssignment, ProviderAssignmentStatus, ProviderType } from '../../../core/models/provider-assignment.model';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { ToastService } from '../../../shared/components/toast/toast.service';
import {
  SendCommunicationModalComponent,
  SendCommunicationModalData,
} from './components/send-communication-modal/send-communication-modal.component';
import {
  LossAdjusterSurveyModalComponent,
  LossAdjusterSurveyModalData,
} from './components/loss-adjuster-survey-modal/loss-adjuster-survey-modal.component';
import { LossAdjusterSurvey } from '../../../core/models/loss-adjuster-survey.model';

// BMPCC-14454 — no isExternal flag exists on ProviderAssignment; assumption:
// 'adjuster' assignments are internal (Allianz Expertise Center), everything
// else (legal/expert/other) is treated as an external provider communication.
const INTERNAL_TYPES: ProviderType[] = ['adjuster'];

const TYPE_LABEL: Record<ProviderType, string> = {
  adjuster: 'Adjuster',
  legal:    'Legal',
  expert:   'Expert',
  other:    'Other',
};

@Component({
  selector: 'app-provider-management',
  standalone: true,
  imports: [
    CommonModule,
    NxTableModule,
    NxButtonModule,
    StatusChipComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    AppDatePipe,
  ],
  templateUrl: './provider-management.component.html',
  styleUrl: './provider-management.component.scss',
})
export class ProviderManagementComponent implements OnInit {
  private readonly route     = inject(ActivatedRoute);
  private readonly svc       = inject(MockProviderService);
  private readonly surveySvc = inject(MockLossAdjusterSurveyService);
  private readonly dialogSvc = inject(NxDialogService);
  private readonly toast     = inject(ToastService);

  private claimId = '';

  readonly rows          = signal<ProviderAssignment[]>([]);
  readonly loading       = signal(true);
  // Optional ?sectionId= query param — set when arriving from a section's
  // "Instruct provider" action, so that section's assignment can be highlighted.
  readonly highlightSectionId = signal<string | null>(null);
  readonly submittedSurveyAssignmentIds = signal<Set<string>>(new Set());

  async ngOnInit(): Promise<void> {
    this.claimId = this.route.snapshot.paramMap.get('id')
      ?? this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.highlightSectionId.set(this.route.snapshot.queryParamMap.get('sectionId'));

    this.loading.set(true);
    const data = await firstValueFrom(this.svc.search({ claimId: this.claimId }));
    this.rows.set(data);
    this.loading.set(false);
  }

  typeLabel(t: ProviderType): string { return TYPE_LABEL[t]; }

  chipStatus(s: ProviderAssignmentStatus): string { return s.toLowerCase(); }

  isHighlighted(row: ProviderAssignment): boolean {
    return !!this.highlightSectionId() && row.sectionId === this.highlightSectionId();
  }

  isExternal(row: ProviderAssignment): boolean {
    return !INTERNAL_TYPES.includes(row.providerType);
  }

  // BMPCC-14452 AC — survey eligible once the instruction is completed, for
  // adjuster-type assignments, and only if not already submitted this session.
  isSurveyEligible(row: ProviderAssignment): boolean {
    return row.providerType === 'adjuster'
      && row.status === 'Completed'
      && !this.submittedSurveyAssignmentIds().has(row.assignmentId);
  }

  async openSendCommunicationModal(row: ProviderAssignment): Promise<void> {
    const ref = this.dialogSvc.open(SendCommunicationModalComponent, {
      data: { claimId: this.claimId, assignment: row, isExternal: this.isExternal(row) } satisfies SendCommunicationModalData,
      width: '560px',
      maxWidth: '92vw',
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    this.toast.success('Communication sent', `${row.providerName} — ${result.attachmentCount} attachment(s)`);
  }

  async openSurveyModal(row: ProviderAssignment): Promise<void> {
    const ref = this.dialogSvc.open(LossAdjusterSurveyModalComponent, {
      data: { claimId: this.claimId, assignment: row } satisfies LossAdjusterSurveyModalData,
      width: '440px',
      maxWidth: '92vw',
    });
    const result = await firstValueFrom(ref.afterClosed()) as LossAdjusterSurvey | null | undefined;
    if (!result) return;
    await firstValueFrom(this.surveySvc.submit(row.assignmentId, this.claimId, result.rating ?? 0, result.comments));
    this.submittedSurveyAssignmentIds.set(new Set([...this.submittedSurveyAssignmentIds(), row.assignmentId]));
    this.toast.success('Rating submitted', `Thanks for rating ${row.providerName}.`);
  }
}
