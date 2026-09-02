import { Component, inject, signal } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { TrackerViewerService } from '../../../core/services/tracker-viewer.service';
import { OWNER_LABEL } from '../../../core/services/tracker-visibility';

// Personal-password unlock for the manager's own rows, sitting in the tracker
// toolbar. Collapsed to a single plain button until used, because for everyone
// except one person it is permanent dead weight on the screen.
//
// Deliberately NOT a full-screen gate like features/access-gate: the team is
// not being asked to authenticate, the owner is opting *in* to seeing more. A
// wrong password says nothing about whether extra rows exist.
@Component({
  selector: 'app-tracker-owner-unlock',
  standalone: true,
  imports: [ReactiveFormsModule, NxFormfieldModule, NxInputModule, NxButtonModule, NxIconModule],
  templateUrl: './tracker-owner-unlock.component.html',
  styleUrl: './tracker-owner-unlock.component.scss',
})
export class TrackerOwnerUnlockComponent {
  private readonly viewerService = inject(TrackerViewerService);
  private readonly live = inject(LiveAnnouncer);

  readonly ownerLabel = OWNER_LABEL;
  readonly isOwner = this.viewerService.isOwner;

  readonly passwordControl = new FormControl('', { nonNullable: true });
  readonly expanded = signal(false);
  readonly checking = signal(false);
  readonly failed = signal(false);

  expand(): void {
    this.expanded.set(true);
  }

  collapse(): void {
    this.expanded.set(false);
    this.failed.set(false);
    this.passwordControl.setValue('');
  }

  async submit(): Promise<void> {
    const value = this.passwordControl.value.trim();
    if (!value || this.checking()) return;

    this.checking.set(true);
    this.failed.set(false);
    const ok = await this.viewerService.unlock(value);
    this.checking.set(false);
    this.passwordControl.setValue('');

    if (ok) {
      this.expanded.set(false);
      // The table reloads off viewer.isOwner() via its filter effect, so the row
      // count changes with no other visible confirmation — say so out loud.
      this.live.announce(`Unlocked. Now viewing as ${OWNER_LABEL}.`, 'polite');
      return;
    }

    this.failed.set(true);
    this.live.announce('Incorrect password.', 'assertive');
  }

  lock(): void {
    this.viewerService.lock();
    this.collapse();
    this.live.announce('Locked. Viewing as the team again.', 'polite');
  }
}
