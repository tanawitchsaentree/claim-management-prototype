import { Component, inject, signal, computed, effect, ChangeDetectionStrategy, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { MockSectionService } from '../../../core/mock/services/mock-section.service';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import { ReferenceViewService } from '../../../features/claims/claim-reference-panel/reference-view.service';
import { ClaimPreviewService } from '../../services/claim-preview.service';
import { StatusChipComponent } from '../status-chip/status-chip.component';
import { ClaimOverview } from '../../../core/models/claim-overview.model';
import { ClaimSection } from '../../../core/models/section.model';

interface PreviewVM {
  loading: boolean;
  notFound: boolean;
  claim: ClaimOverview | null;
  sections: ClaimSection[];
}

@Component({
  selector: 'app-claim-preview-popover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, RouterLink, NxIconModule, NxButtonModule, StatusChipComponent],
  templateUrl: './claim-preview-popover.component.html',
  styleUrl: './claim-preview-popover.component.scss',
})
export class ClaimPreviewPopoverComponent implements OnInit {
  readonly previewSvc  = inject(ClaimPreviewService);
  readonly refSvc      = inject(ReferenceViewService);
  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly sectionSvc  = inject(MockSectionService);
  private readonly stateSvc    = inject(MockStateService);

  readonly vm = signal<PreviewVM>({ loading: true, notFound: false, claim: null, sections: [] });
  private loadedFor: string | null = null;

  readonly closedSections = computed(() => this.vm().sections.filter(s => s.status === 'Closed').length);
  readonly totalSections  = computed(() => this.vm().sections.length);

  constructor() {
    effect(() => {
      const id = this.previewSvc.claimId();
      if (id) this.loadFor(id);
    });
  }

  ngOnInit(): void {}

  async loadFor(claimId: string): Promise<void> {
    if (this.loadedFor === claimId) return;
    this.loadedFor = claimId;
    this.vm.set({ loading: true, notFound: false, claim: null, sections: [] });
    const knownIds = Object.keys(this.stateSvc.state().overviews);
    if (!knownIds.includes(claimId)) {
      this.vm.set({ loading: false, notFound: true, claim: null, sections: [] });
      return;
    }
    try {
      const [{ claim }, sections] = await Promise.all([
        firstValueFrom(this.overviewSvc.getOverviewWithActivities(claimId)),
        firstValueFrom(this.sectionSvc.getByClaimId(claimId)),
      ]);
      this.vm.set({ loading: false, notFound: false, claim, sections });
    } catch {
      this.vm.set({ loading: false, notFound: true, claim: null, sections: [] });
    }
  }

  openInPanel(): void {
    const id = this.previewSvc.claimId();
    if (!id) return;
    this.refSvc.openRefTab(id);
    if (!this.refSvc.isPanelMode()) {
      this.refSvc.setVariant('panel', this.refSvc.primaryClaimId());
    }
    this.previewSvc.hide();
  }

  onCardMouseEnter(): void {
    // keep open — handled by directive leave timer cancellation via service
  }

  onCardMouseLeave(): void {
    this.previewSvc.hide();
  }
}
