import { Component, computed, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { PreCheck } from '../../../core/models/financial-precheck.model';
import { MockBookingService } from '../../../core/mock/services/mock-booking.service';

// One stacked list for every pre-submit problem (claim not in GG, unpaid
// premium, currency, limit), identical on Make payment and Add reserve. The
// list arrives already ordered (blocks first) from financialPreChecks().
// Checks that only matter once an outside block is cleared (afterOutsideBlock)
// drop under their own quieter heading so the handler fixes the right thing first.
@Component({
  selector: 'app-financial-warnings',
  standalone: true,
  imports: [NgTemplateOutlet, ReactiveFormsModule, NxMessageModule, NxFormfieldModule, NxInputModule, NxButtonModule],
  templateUrl: './financial-warnings.component.html',
  styleUrl: './financial-warnings.component.scss'
})
export class FinancialWarningsComponent {
  private readonly router = inject(Router);
  private readonly booking = inject(MockBookingService);

  readonly checks = input.required<PreCheck[]>();
  readonly claimId = input('');
  // Reason for going over a limit sits inside the warning it belongs to.
  readonly reason = input<FormControl<string | null> | null>(null);
  readonly showReasonError = input(false);
  // Where "Add a USD reserve" should land (section id + currency being paid in).
  readonly sectionId = input('');
  readonly currency = input('');

  readonly now = computed(() => this.checks().filter(c => !c.afterOutsideBlock));
  readonly later = computed(() => this.checks().filter(c => c.afterOutsideBlock));

  context(check: PreCheck): 'error' | 'warning' | 'info' {
    if (check.level === 'block') return 'error';
    return check.id === 'claim-registering' ? 'info' : 'warning';
  }

  act(check: PreCheck): void {
    const id = this.claimId();
    if (check.action?.kind === 'send-claim-again') {
      this.booking.sendClaimAgain(id);
    } else if (check.action?.kind === 'add-reserve') {
      // "Go to reserves" (payment over the reserve) just opens the list; "Add a USD reserve" opens the form.
      const list = check.id === 'over-reserve';
      this.router.navigate(['/claims', id, 'financial'], {
        queryParams: {
          view: 'reserves',
          addReserve: list ? null : 1,
          currency: list ? null : this.currency() || null,
          section: list ? null : this.sectionId() || null
        }
      });
    }
  }
}
