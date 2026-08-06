import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NxModalRef, NX_MODAL_DATA, NxDialogService } from '@allianz/ng-aquila/modal';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import { NxTimefieldModule } from '@allianz/ng-aquila/timefield';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { firstValueFrom } from 'rxjs';
import { MassEvent, Claim } from '../../../../core/models';
import { MockMassEventService } from '../../../../core/mock/services/mock-mass-event.service';
import {
  ClaimSearchModalComponent,
  ClaimSearchModalData,
  ClaimSearchModalResult,
} from '../../../../shared/components/claim-search-modal/claim-search-modal.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

export type MassEventModalMode = 'edit' | 'create' | 'view';

export interface MassEventModalData {
  mode: MassEventModalMode;
  event?: MassEvent;             // required when mode === 'edit' | 'view'
  existingIds?: string[];        // used in create mode to generate next ID
}

export interface MassEventModalResult {
  mode: MassEventModalMode;
  event: MassEvent;
}

@Component({
  selector: 'app-mass-event-edit-modal',
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
    NxTimefieldModule,
    NxTableModule,
    NxContextMenuModule,
    EmptyStateComponent,
  ],
  templateUrl: './mass-event-edit-modal.component.html',
  styleUrl: './mass-event-edit-modal.component.scss',
})
export class MassEventEditModalComponent {
  private readonly ref  = inject<NxModalRef<MassEventEditModalComponent, MassEventModalResult | null>>(NxModalRef);
  private readonly data = inject<MassEventModalData>(NX_MODAL_DATA);
  private readonly massEventSvc = inject(MockMassEventService);
  private readonly dialogSvc    = inject(NxDialogService);

  readonly mode      = signal<MassEventModalMode>(this.data.mode);
  readonly isEdit    = computed(() => this.mode() === 'edit');
  readonly isCreate  = computed(() => this.mode() === 'create');
  readonly isView    = computed(() => this.mode() === 'view');

  readonly types      = ['Type #1', 'Type #2', 'Type #3'];
  readonly countries  = ['United States', 'France', 'Australia', 'Poland', 'Czech Republic', 'Canada', 'Colombia', 'Germany', 'United Kingdom'];
  readonly regions    = ['North Coast', 'South East', 'Normandy', 'Saxony', 'Silesia', 'Pardubice', 'Missouri Plateau', 'Alberta', 'Antioquia'];
  readonly lossCauses = ['Earthquake', 'Flood', 'Fire', 'Storm', 'Natural Event', 'Landslide'];

  private readonly seed: Partial<MassEvent> = this.data.event ?? {};

  readonly form = new FormGroup({
    code:           new FormControl<string>(this.seed.code          ?? '', { nonNullable: true, validators: [Validators.required] }),
    name:           new FormControl<string>(this.seed.name          ?? '', { nonNullable: true, validators: [Validators.required] }),
    type:           new FormControl<string>(this.seed.type          ?? '', { nonNullable: true }),
    globalCatCode:  new FormControl<string>(this.seed.globalCatCode ?? '', { nonNullable: true }),
    productCode:    new FormControl<string>(this.seed.productCode   ?? '', { nonNullable: true }),
    lossCause:      new FormControl<string>(this.seed.lossCause     ?? '', { nonNullable: true }),
    description:    new FormControl<string>(this.seed.description   ?? '', { nonNullable: true }),
    dateStart:      new FormControl<string>(this.seed.dateStart     ?? '', { nonNullable: true, validators: [Validators.required] }),
    dateEnd:        new FormControl<string>(this.seed.dateEnd       ?? '', { nonNullable: true, validators: [Validators.required] }),
    timeStart:      new FormControl<string>(this.seed.timeStart     ?? '', { nonNullable: true }),
    timeEnd:        new FormControl<string>(this.seed.timeEnd       ?? '', { nonNullable: true }),
    country:        new FormControl<string>(this.seed.country       ?? '', { nonNullable: true, validators: [Validators.required] }),
    region:         new FormControl<string>(this.seed.region        ?? '', { nonNullable: true, validators: [Validators.required] }),
    postcodes:      new FormControl<string>((this.seed.postcodes ?? []).join(', '), { nonNullable: true }),
  });

  readonly title = computed(() => {
    if (this.isView())   return this.data.event?.name || 'Mass Event';
    if (this.isEdit())   return this.data.event?.name || 'Mass event';
    return 'Mass Event creation';
  });

  readonly submitLabel = computed(() => (this.isEdit() ? 'Save' : 'Create Mass Event'));

  readonly massEventId = computed(() => this.data.event?.id ?? '');

  readonly linkedClaims = signal<Claim[]>([]);

  constructor() {
    if (this.isView()) {
      this.form.disable();
    }
    if ((this.isEdit() || this.isView()) && this.massEventId()) {
      this.loadLinkedClaims();
    }
  }

  private async loadLinkedClaims(): Promise<void> {
    const claims = await firstValueFrom(this.massEventSvc.getLinkedClaims(this.massEventId()));
    this.linkedClaims.set(claims);
  }

  async onLinkClaim(): Promise<void> {
    const ref = this.dialogSvc.open<ClaimSearchModalComponent, ClaimSearchModalData, ClaimSearchModalResult>(
      ClaimSearchModalComponent,
      { data: { excludeClaimIds: this.linkedClaims().map(c => c.claimId) }, panelClass: 'me-edit-modal-panel' },
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;

    await firstValueFrom(
      this.massEventSvc.linkClaim(result.claim.claimId, this.massEventId(), { userId: 'usr-current', name: 'Current User' }),
    );
    await this.loadLinkedClaims();
  }

  async onConfirmClaimLink(claim: Claim): Promise<void> {
    await firstValueFrom(this.massEventSvc.confirmLink(claim.claimId));
    await this.loadLinkedClaims();
  }

  async onUnlinkClaim(claim: Claim): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialogSvc.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: 'Unlink claim?',
          message: `Remove the link between ${claim.claimId} and this mass event?`,
          confirmLabel: 'Unlink',
          confirmDanger: true,
        },
        width: '440px',
      }).afterClosed(),
    );
    if (!confirmed) return;

    await firstValueFrom(this.massEventSvc.unlinkClaim(claim.claimId));
    await this.loadLinkedClaims();
  }

  onCancel(): void {
    this.ref.close(null);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const id = this.isEdit() ? this.data.event!.id : this.generateNextId();

    const next: MassEvent = {
      id,
      code:           v.code,
      name:           v.name,
      type:           v.type || undefined,
      globalCatCode:  v.globalCatCode || undefined,
      productCode:    v.productCode   || undefined,
      description:    v.description   || undefined,
      dateStart:      v.dateStart,
      dateEnd:        v.dateEnd,
      timeStart:      v.timeStart || undefined,
      timeEnd:        v.timeEnd   || undefined,
      country:        v.country,
      region:         v.region,
      postcodes:      v.postcodes ? v.postcodes.split(',').map(p => p.trim()).filter(Boolean) : [],
      lossCause:      v.lossCause || undefined,
    };

    this.ref.close({ mode: this.mode(), event: next });
  }

  private generateNextId(): string {
    const year = new Date().getFullYear();
    const prefix = `ME-${year}.`;
    const ids = this.data.existingIds ?? [];
    const nums = ids
      .filter(id => id.startsWith(prefix))
      .map(id => parseInt(id.slice(prefix.length), 10))
      .filter(n => !Number.isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 100) + 1;
    return `${prefix}${next}`;
  }
}
