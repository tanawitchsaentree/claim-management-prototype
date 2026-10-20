import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { Payee } from '../../../../core/models/payee.model';

// Accordion 1 "Payee & beneficiary". ASSUMPTION [MP-1]: field set from the
// legacy CLAWS Make Payment flow (payee -> ultimate beneficiary -> email).
// A dumb view: the page owns the form and the values derived from it.
@Component({
  selector: 'app-payee-section',
  standalone: true,
  imports: [ReactiveFormsModule, NxDropdownModule, NxFormfieldModule, NxInputModule, NxRadioModule],
  templateUrl: './payee-section.component.html',
  styleUrl: './payee-section.component.scss'
})
export class PayeeSectionComponent {
  readonly form = input.required<FormGroup>();
  readonly payees = input.required<Payee[]>();
  readonly selected = input<Payee | null>(null);
  readonly differentBeneficiary = input(false);
  readonly emailYes = input(false);
  // Fields still empty, passed in only after the first attempt to submit.
  readonly missing = input<string[]>([]);

  setBeneficiary(v: 'same' | 'different'): void {
    this.form().controls['beneficiary'].setValue(v);
  }

  setEmail(v: boolean): void {
    this.form().controls['confirmEmail'].setValue(v);
  }
}
