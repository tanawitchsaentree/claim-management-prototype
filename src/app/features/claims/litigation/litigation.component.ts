import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { MockLitigationService } from '../../../core/mock/services/mock-litigation.service';
import { Litigation, LitigationStatus } from '../../../core/models';
import { LitigationDetailComponent } from './litigation-detail/litigation-detail.component';

const STATUS_CHIP_MAP: Record<LitigationStatus, string> = {
  Draft:         'open',
  'In progress': 'in-progress',
  Closed:        'closed',
};

@Component({
  selector: 'app-litigation',
  standalone: true,
  imports: [
    CommonModule,
    NxIconModule,
    NxButtonModule,
    NxTableModule,
    NxContextMenuModule,
    StatusChipComponent,
    LitigationDetailComponent,
  ],
  templateUrl: './litigation.component.html',
  styleUrl: './litigation.component.scss',
  animations: [
    trigger('detailSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(24px)' }),
        animate('220ms cubic-bezier(0.2, 0, 0, 1)',
          style({ opacity: 1, transform: 'translateX(0)' })),
      ]),
      transition(':leave', [
        animate('180ms ease-in',
          style({ opacity: 0, transform: 'translateX(24px)' })),
      ]),
    ]),
  ],
})
export class LitigationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly svc   = inject(MockLitigationService);
  private readonly toast = inject(ToastService);

  readonly rows     = signal<Litigation[]>([]);
  readonly loading  = signal(true);
  readonly selected = signal<Litigation | null>(null);

  readonly isSqueezed = computed(() => !!this.selected());

  private claimId = '';

  ngOnInit(): void {
    this.claimId = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    const data = await firstValueFrom(this.svc.search({ claimId: this.claimId }));
    this.rows.set(data);
    this.loading.set(false);
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }

  chipStatus(s: LitigationStatus): string { return STATUS_CHIP_MAP[s]; }

  open(row: Litigation): void {
    this.selected.set(row);
  }

  closeDetail(): void {
    this.selected.set(null);
  }

  async create(): Promise<void> {
    const fresh = this.svc.create(this.claimId, 'Mark Kaufmann');
    this.rows.update(list => [fresh, ...list]);
    this.selected.set(fresh);
  }

  onUpdate(updated: Litigation): void {
    this.svc.update(updated);
    this.rows.update(list => list.map(l => (l.id === updated.id ? updated : l)));
    this.selected.set(updated);
    this.toast.success(`Litigation ${updated.id} saved`);
  }
}
