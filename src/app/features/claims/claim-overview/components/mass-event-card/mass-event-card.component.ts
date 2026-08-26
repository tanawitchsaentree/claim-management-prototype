import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxPopoverModule } from '@allianz/ng-aquila/popover';
import { NxLinkModule } from '@allianz/ng-aquila/link';
import { StatusChipComponent } from '../../../../../shared/components/status-chip/status-chip.component';
import { AppDatePipe } from '../../../../../shared/pipes/app-date.pipe';
import { ToastService } from '../../../../../shared/components/toast/toast.service';
import { AuthService } from '../../../../../core/services/auth';
import { MockMassEventService } from '../../../../../core/mock/services/mock-mass-event.service';
import { ClaimOverview } from '../../../../../core/models/claim-overview.model';
import { MassEvent } from '../../../../../core/models/mass-event.model';
import { MassEventLinkStatus } from '../../../../../core/models/claim.model';
import {
  MassEventEditModalComponent,
  MassEventModalData,
  MassEventModalResult,
} from '../../../../administration/mass-events/edit-modal/mass-event-edit-modal.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  MassEventSearchModalComponent,
  MassEventSearchModalData,
  MassEventSearchModalResult,
} from '../../../../../shared/components/mass-event-search-modal/mass-event-search-modal.component';

export interface MassEventChanged {
  claimId: string;
  massEventId: string | undefined;
  massEventLinkStatus: MassEventLinkStatus | undefined;
  massEvent: MassEvent | null;
}

@Component({
  selector: 'app-mass-event-card',
  standalone: true,
  imports: [NxIconModule, NxPopoverModule, NxLinkModule, StatusChipComponent, AppDatePipe],
  templateUrl: './mass-event-card.component.html',
  styleUrl: './mass-event-card.component.scss',
})
export class MassEventCardComponent {
  @Input({ required: true }) claim!: ClaimOverview;
  @Input() massEvent: MassEvent | null = null;
  @Output() massEventChanged = new EventEmitter<MassEventChanged>();

  private readonly dialogSvc    = inject(NxDialogService);
  private readonly massEventSvc = inject(MockMassEventService);
  private readonly toast        = inject(ToastService);
  readonly auth                 = inject(AuthService);

  openMassEventDetail(): void {
    const me = this.massEvent;
    if (!me) return;
    const data: MassEventModalData = { mode: 'view', event: me };
    // Use the same bottom-sheet panel as the admin Mass Events page so the
    // modal has a proper height constraint + scroll (the component's SCSS
    // assumes the .bottom-sheet-modal-panel wrapper).
    this.dialogSvc.open(MassEventEditModalComponent, { data, panelClass: 'bottom-sheet-modal-panel' });
  }

  // ── Mass Event linking ──────────────────────────────────────────────────────
  // Open to any handler. Only "Confirm link" stays KCM-gated in the template.
  // Surfaced as "Link mass event" in the UI; it both links and replaces, and
  // the replace case asks for confirmation below.

  async onChangeMassEvent(): Promise<void> {
    const claim = this.claim;
    const currentMassEventId = claim.massEventId;
    const ref = this.dialogSvc.open<MassEventSearchModalComponent, MassEventSearchModalData, MassEventSearchModalResult>(
      MassEventSearchModalComponent,
      { data: { currentMassEventId }, panelClass: 'bottom-sheet-modal-panel' },
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;

    let event: MassEvent;
    if (result.kind === 'fallback-manual') {
      const created = await this.createMassEventManually();
      if (!created) return;
      event = created;
    } else {
      event = result.event;
    }

    if (currentMassEventId && currentMassEventId !== event.id) {
      const confirmed = await firstValueFrom(
        this.dialogSvc.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
          data: {
            title: 'Replace linked mass event?',
            message: `This claim is already linked to ${currentMassEventId}. Linking ${event.id} will replace that link.`,
            confirmLabel: 'Replace link',
          },
          width: '440px',
        }).afterClosed(),
      );
      if (!confirmed) return;
    }

    const user = this.auth.user();
    await firstValueFrom(this.massEventSvc.linkClaim(claim.claimId, event.id, { userId: user.id, name: user.name }));
    await this.refreshMassEvent(claim.claimId, event.id, 'pending');
    this.toast.success('Mass event linked', `${event.id} — pending confirmation`);
  }

  /** Opens the full create form; the new event is persisted (findable everywhere) but never auto-linked here. */
  private async createMassEventManually(): Promise<MassEvent | null> {
    const data: MassEventModalData = { mode: 'create', existingIds: this.massEventSvc.allIds() };
    const ref = this.dialogSvc.open<MassEventEditModalComponent, MassEventModalData, MassEventModalResult | null>(
      MassEventEditModalComponent,
      { data, panelClass: 'bottom-sheet-modal-panel' },
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return null;
    return firstValueFrom(this.massEventSvc.addEvent(result.event));
  }

  async onConfirmMassEventLink(): Promise<void> {
    const claim = this.claim;
    if (!claim.massEventId) return;
    await firstValueFrom(this.massEventSvc.confirmLink(claim.claimId));
    await this.refreshMassEvent(claim.claimId, claim.massEventId, 'confirmed');
    this.toast.success('Mass event link confirmed', claim.massEventId);
  }

  async onUnlinkMassEvent(): Promise<void> {
    const claim = this.claim;
    const massEventId = claim.massEventId;
    if (!massEventId) return;

    const confirmed = await firstValueFrom(
      this.dialogSvc.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: 'Unlink mass event?',
          message: `Remove the link to ${massEventId} from this claim?`,
          confirmLabel: 'Unlink mass event',
          confirmDanger: true,
        },
        width: '440px',
      }).afterClosed(),
    );
    if (!confirmed) return;

    await firstValueFrom(this.massEventSvc.unlinkClaim(claim.claimId));
    await this.refreshMassEvent(claim.claimId, undefined, undefined);
    this.toast.success('Mass event unlinked', massEventId);
  }

  /**
   * Claim handler override (BMPCC-10510), surfaced as "Not associated with this
   * claim". Where Unlink removes the mass event from the claim, this keeps the
   * tag as a visible record of what was auto-allocated and rejected, and only
   * moves the link status. The UI reads that status to show "auto-checks
   * disabled" and to stop offering Confirm for this link.
   *
   * The two actions sat side by side without explanation and were read as the
   * same thing (design review, 2026-08-13), so the popover now carries a hint
   * line and this dialog spells out the difference.
   */
  async onOverrideMassEvent(): Promise<void> {
    const claim = this.claim;
    const massEventId = claim.massEventId;
    if (!massEventId) return;

    const confirmed = await firstValueFrom(
      this.dialogSvc.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: 'Override mass event allocation?',
          message: `This marks ${massEventId} as not associated with this claim. The tag stays on the claim as a record of what was allocated, and the system stops running automatic checks against it. To remove the mass event from the claim entirely, use "Unlink mass event" instead. This can be undone via "Link mass event."`,
          confirmLabel: 'Mark as not associated',
          confirmDanger: true,
        },
        width: '440px',
      }).afterClosed(),
    );
    if (!confirmed) return;

    const user = this.auth.user();
    await firstValueFrom(this.massEventSvc.overrideLink(claim.claimId, { userId: user.id, name: user.name }));
    await this.refreshMassEvent(claim.claimId, massEventId, 'overridden');
    this.toast.success('Mass event allocation overridden', 'Auto-checks are now disabled for this claim.');
  }

  private async refreshMassEvent(
    claimId: string,
    massEventId: string | undefined,
    linkStatus: MassEventLinkStatus | undefined,
  ): Promise<void> {
    const massEvent = massEventId ? await firstValueFrom(this.massEventSvc.getById(massEventId)) : null;
    this.massEventChanged.emit({ claimId, massEventId, massEventLinkStatus: linkStatus, massEvent });
  }
}
