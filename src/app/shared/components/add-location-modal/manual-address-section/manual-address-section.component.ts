import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { LookupOption, CwbManualAddress } from '../../../../core/models';

@Component({
  selector: 'app-manual-address-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule,
    NxButtonModule,
    NxIconModule
  ],
  templateUrl: './manual-address-section.component.html',
  styleUrl: './manual-address-section.component.scss'
})
export class ManualAddressSectionComponent {
  readonly form = input.required<FormGroup>();
  readonly countries = input<LookupOption[]>([]);
  readonly entries = input<CwbManualAddress[]>([]);
  readonly submitted = input(false);

  readonly add = output<void>();
  readonly remove = output<number>();

  showError(field: string): boolean {
    const c = this.form().get(field);
    return !!c && c.invalid && (c.touched || this.submitted());
  }
}
