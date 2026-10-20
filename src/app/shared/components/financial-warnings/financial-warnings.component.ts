import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { PreCheck } from '../../../core/models/financial-precheck.model';

// One stacked list for every pre-submit problem (claim not in GG, unpaid
// premium, currency, limit), identical on Make payment and Add reserve. The
// list arrives already ordered (blocks first) from financialPreChecks().
@Component({
  selector: 'app-financial-warnings',
  standalone: true,
  imports: [ReactiveFormsModule, NxMessageModule, NxFormfieldModule, NxInputModule],
  templateUrl: './financial-warnings.component.html',
  styleUrl: './financial-warnings.component.scss'
})
export class FinancialWarningsComponent {
  readonly checks = input.required<PreCheck[]>();
  // Limit breach: the reason the handler gives sits inside the warning it belongs to.
  readonly reason = input<FormControl<string | null> | null>(null);
  readonly showReasonError = input(false);

  context(check: PreCheck): 'error' | 'warning' | 'info' {
    if (check.level === 'block') return 'error';
    return check.id === 'claim-registering' ? 'info' : 'warning';
  }
}
