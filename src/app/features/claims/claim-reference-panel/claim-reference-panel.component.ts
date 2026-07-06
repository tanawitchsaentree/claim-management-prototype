import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { animate, style, transition, trigger } from '@angular/animations';
import { firstValueFrom, combineLatest } from 'rxjs';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { MockSectionService } from '../../../core/mock/services/mock-section.service';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { ClaimOverview } from '../../../core/models/claim-overview.model';
import { ClaimSection } from '../../../core/models/section.model';

interface RefVM {
  claim: ClaimOverview | null;
  sections: ClaimSection[];
  notFound: boolean;
  loading: boolean;
}

const EMPTY_VM: RefVM = { claim: null, sections: [], notFound: false, loading: true };

@Component({
  selector: 'app-claim-reference-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, NxIconModule, NxButtonModule, StatusChipComponent],
  templateUrl: './claim-reference-panel.component.html',
  styleUrl: './claim-reference-panel.component.scss',
  animations: [
    trigger('refPanelSlide', [
      transition(':enter', [
        style({ width: 0, opacity: 0 }),
        animate('220ms cubic-bezier(0.2, 0, 0, 1)', style({ width: '360px', opacity: 1 })),
      ]),
      transition(':leave', [
        style({ width: '360px', opacity: 1, overflow: 'hidden' }),
        animate('180ms cubic-bezier(0.4, 0, 1, 1)', style({ width: 0, opacity: 0 })),
      ]),
    ]),
  ],
})
export class ClaimReferencePanelComponent implements OnChanges {
  @Input({ required: true }) claimId!: string;
  @Output() closePanel = new EventEmitter<void>();

  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly sectionSvc  = inject(MockSectionService);
  private readonly stateSvc    = inject(MockStateService);

  readonly vm = signal<RefVM>(EMPTY_VM);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['claimId'] && this.claimId) this.load();
  }

  private async load(): Promise<void> {
    this.vm.set(EMPTY_VM);

    const knownIds = Object.keys(this.stateSvc.state().overviews);
    if (!knownIds.includes(this.claimId)) {
      this.vm.set({ claim: null, sections: [], notFound: true, loading: false });
      return;
    }

    try {
      const [{ claim }, sections] = await Promise.all([
        firstValueFrom(this.overviewSvc.getOverviewWithActivities(this.claimId)),
        firstValueFrom(this.sectionSvc.getByClaimId(this.claimId)),
      ]);
      this.vm.set({ claim, sections, notFound: false, loading: false });
    } catch {
      this.vm.set({ claim: null, sections: [], notFound: true, loading: false });
    }
  }

  sectionsSummary(sections: ClaimSection[]): string {
    const open   = sections.filter(s => s.status !== 'Closed').length;
    const closed = sections.filter(s => s.status === 'Closed').length;
    const total  = sections.length;
    if (total === 0) return 'No sections';
    return `${closed}/${total} closed${open > 0 ? ` · ${open} open` : ''}`;
  }
}
