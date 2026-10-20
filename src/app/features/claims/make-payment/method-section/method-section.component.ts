import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { Payee, PAYMENT_METHODS, PaymentMethodOption } from '../../../../core/models/payee.model';

// Accordion 2 "Payment method". ASSUMPTION [MP-1] (legacy CLAWS flow): method,
// bank account of the payee when the method needs one, payment date, reference.
@Component({
  selector: 'app-method-section',
  standalone: true,
  imports: [ReactiveFormsModule, NxDatefieldModule, NxDropdownModule, NxFormfieldModule, NxInputModule],
  templateUrl: './method-section.component.html',
  styleUrl: './method-section.component.scss'
})
export class MethodSectionComponent {
  readonly form = input.required<FormGroup>();
  readonly payee = input<Payee | null>(null);
  readonly method = input<PaymentMethodOption | null>(null);
  // Fields still empty, passed in only after the first attempt to submit.
  readonly missing = input<string[]>([]);

  readonly methods = PAYMENT_METHODS;
}
