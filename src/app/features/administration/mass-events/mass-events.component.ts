import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { firstValueFrom } from 'rxjs';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxLinkModule } from '@allianz/ng-aquila/link';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxPaginationModule } from '@allianz/ng-aquila/pagination';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxBreadcrumbModule } from '@allianz/ng-aquila/breadcrumb';
import { NxGridModule } from '@allianz/ng-aquila/grid';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { Navbar } from '../../layout/navbar/navbar';
import { BreadcrumbItem } from '../../../shared/components/page-shell/page-shell.component';
import { MassEvent, MassEventFilters } from '../../../core/models';
import { MockMassEventService } from '../../../core/mock/services/mock-mass-event.service';
import { MassEventEditModalComponent, MassEventModalData, MassEventModalResult } from './edit-modal/mass-event-edit-modal.component';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

const PAGE_SIZE = 10;
const TOAST_DURATION_MS = 4000;

@Component({
  selector: 'app-mass-events',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    Navbar,
    NxIconModule,
    NxButtonModule,
    NxLinkModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule,
    NxDatefieldModule,
    NxTableModule,
    NxPaginationModule,
    NxContextMenuModule,
    NxBreadcrumbModule,
    NxGridModule,
    NxMessageModule,
    AppDatePipe,
    EmptyStateComponent,
    PageHeaderComponent,
  ],
  templateUrl: './mass-events.component.html',
  styleUrl: './mass-events.component.scss',
})
export class MassEventsComponent {
  private readonly svc    = inject(MockMassEventService);
  private readonly dialog = inject(NxDialogService);
  private readonly live   = inject(LiveAnnouncer);

  readonly all      = signal<MassEvent[]>([]);
  readonly loading  = signal(true);
  readonly page     = signal(1);
  readonly pageSize = PAGE_SIZE;
  readonly toast    = signal<string | null>(null);

  readonly breadcrumb: BreadcrumbItem[] = [
    { label: 'Administration', route: '/administration' },
    { label: 'Mass events' },
  ];

  readonly filterForm = new FormGroup({
    id:             new FormControl(''),
    code:           new FormControl(''),
    name:           new FormControl(''),
    dateStartFrom:  new FormControl(''),
    dateStartTo:    new FormControl(''),
    country:        new FormControl<string | null>(null),
    region:         new FormControl<string | null>(null),
    lossCause:      new FormControl<string | null>(null),
  });

  readonly countries = ['United States', 'France', 'Australia', 'Poland', 'Czech Republic', 'Canada', 'Colombia', 'Germany', 'United Kingdom'];
  readonly regions   = ['North Coast', 'South East', 'Normandy', 'Saxony', 'Silesia', 'Pardubice', 'Missouri Plateau', 'Alberta', 'Antioquia'];
  readonly lossCauses = ['Earthquake', 'Flood', 'Fire', 'Storm', 'Natural Event', 'Landslide'];

  readonly total       = computed(() => this.all().length);
  readonly pagedRows   = computed<MassEvent[]>(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.all().slice(start, start + this.pageSize);
  });

  constructor() {
    this.load();
  }

  private async load(filters?: MassEventFilters): Promise<void> {
    this.loading.set(true);
    const data = await firstValueFrom(this.svc.search(filters));
    this.all.set(data);
    this.loading.set(false);
    this.page.set(1);
  }

  onFilter(): void {
    const v = this.filterForm.getRawValue();
    this.load({
      id:            v.id            ?? undefined,
      code:          v.code          ?? undefined,
      name:          v.name          ?? undefined,
      dateStartFrom: v.dateStartFrom ?? undefined,
      dateStartTo:   v.dateStartTo   ?? undefined,
      country:       v.country       ?? undefined,
      region:        v.region        ?? undefined,
      lossCause:     v.lossCause     ?? undefined,
    });
  }

  onReset(): void {
    this.filterForm.reset({
      id: '', code: '', name: '', dateStartFrom: '', dateStartTo: '',
      country: null, region: null, lossCause: null,
    });
    this.load();
  }

  async onAdd(): Promise<void> {
    const result = await this.openModal({
      mode: 'create',
      existingIds: this.svc.allIds(),
    });
    if (!result) return;
    await firstValueFrom(this.svc.addEvent(result.event));
    this.all.update(rows => [result.event, ...rows]);
    this.flashToast(`Mass event "${result.event.name}" created`);
  }

  async onDelete(event: MassEvent): Promise<void> {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          title:         'Delete Mass Event?',
          message:       'Deleting this Mass Event will impact loss events linked to it.',
          confirmLabel:  'Delete',
          cancelLabel:   'Cancel',
          confirmDanger: true,
        },
        width: '480px',
      },
    );
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.all.update(rows => rows.filter(r => r.id !== event.id));
    this.flashToast(`Mass event "${event.name}" deleted`);
  }

  async openDetail(event: MassEvent): Promise<void> {
    const result = await this.openModal({ mode: 'edit', event });
    if (!result) return;
    this.all.update(rows => rows.map(r => (r.id === result.event.id ? result.event : r)));
    this.flashToast(`Mass event "${result.event.name}" updated`);
  }

  // Single shared opener for edit + create. Animation/positioning lives in
  // styles.scss .me-edit-modal-panel so both modes share UX.
  private async openModal(data: MassEventModalData): Promise<MassEventModalResult | null> {
    const ref = this.dialog.open<MassEventEditModalComponent, MassEventModalData, MassEventModalResult | null>(
      MassEventEditModalComponent,
      {
        data,
        panelClass: 'me-edit-modal-panel',
        showCloseIcon: false,
      },
    );
    const result = await firstValueFrom(ref.afterClosed());
    return result ?? null;
  }

  // Visual banner + LiveAnnouncer announcement so the success message is
  // also picked up by NVDA/JAWS (VoiceOver reads aria-live banners directly).
  private flashToast(msg: string): void {
    this.toast.set(msg);
    this.live.announce(msg, 'polite');
    setTimeout(() => this.toast.set(null), TOAST_DURATION_MS);
  }
}
