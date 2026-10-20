import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { Deductible } from '../../../../core/models/deductible.model';
import { FinancialReserve } from '../../../../core/models/financial-overview.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

// Accordion 3 "Payment amount": currency, one amount per reserve line, VAT,
// co-insurance and the summary box. A dumb view; the page owns every number.
@Component({
  selector: 'app-amount-section',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, NxDropdownModule, NxFormfieldModule, NxInputModule, NxRadioModule, NxTableModule, EmptyStateComponent],
  templateUrl: './amount-section.component.html',
  styleUrl: './amount-section.component.scss'
})
export class AmountSectionComponent {
  readonly form = input.required<FormGroup>();
  readonly rows = input.required<FinancialReserve[]>();
  readonly controlFor = input.required<(reserveId: string) => FormControl<number | null>>();
  readonly remaining = input.required<(r: FinancialReserve) => number>();
  readonly currencies = input.required<string[]>();
  readonly currency = input('EUR');
  readonly vatYes = input(false);
  readonly coInsurance = input<'allianz' | 'market' | null>(null);
  readonly total = input(0);
  readonly deductibles = input<Deductible[]>([]);
  readonly deductibleTotal = input(0);
  readonly linesMissing = input(false);

  setVat(v: boolean): void {
    this.form().controls['vat'].setValue(v);
  }

  setCoInsurance(v: 'allianz' | 'market'): void {
    this.form().controls['coInsurance'].setValue(v);
  }
}
