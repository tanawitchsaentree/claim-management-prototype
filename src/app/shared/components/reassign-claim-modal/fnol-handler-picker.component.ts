import { Component, OnDestroy, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { AuthService } from '../../../core/services/auth';
import { FnolHandlerChoiceService } from './fnol-handler-choice.service';
import {
  ReassignClaimModalComponent,
  ReassignClaimModalData,
  ReassignClaimModalResult
} from './reassign-claim-modal.component';

// BMPCC-22666 AC01: one line on the FNOL Summary step. Shows who gets the
// claim and lets the handler pick someone else (or a team queue) before
// Submit, using the same dialog as every other reassign entry point.
@Component({
  selector: 'app-fnol-handler-picker',
  standalone: true,
  imports: [NxButtonModule],
  templateUrl: './fnol-handler-picker.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './fnol-handler-picker.component.scss'
})
export class FnolHandlerPickerComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly dialogSvc = inject(NxDialogService);
  readonly choiceSvc = inject(FnolHandlerChoiceService);

  readonly label = computed(() => {
    const c = this.choiceSvc.choice();
    if (!c) return `${this.auth.user().name} (you)`;
    return c.kind === 'team' ? `${c.name} queue` : c.name;
  });

  async change(): Promise<void> {
    const ref = this.dialogSvc.open(ReassignClaimModalComponent, {
      data: {
        claims: [],
        mode: 'registration',
        currentHandler: this.auth.user().name
      } satisfies ReassignClaimModalData,
      width: '480px',
      maxWidth: '92vw'
    });
    const result = (await firstValueFrom(ref.afterClosed())) as ReassignClaimModalResult | null;
    if (result) this.choiceSvc.set(result.target, result.reason);
  }

  reset(): void {
    this.choiceSvc.set(null);
  }

  // Leaving the Summary step without submitting drops the pick, so the next
  // registration starts from the default again.
  ngOnDestroy(): void {
    this.reset();
  }
}
