import { Component, computed, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { NewAddressEntryComponent } from '../../../../shared/components/new-address-entry/new-address-entry.component';
import { StatusChipComponent } from '../../../../shared/components/status-chip/status-chip.component';
import { Payee, PayeeEmail } from '../../../../core/models/payee.model';

// Accordion 1 "Payee & beneficiary". ASSUMPTION [MP-1]: field set from the
// legacy CLAWS Make Payment flow (payee -> ultimate beneficiary -> email).
// A dumb view: the page owns the form and the values derived from it.
@Component({
  selector: 'app-payee-section',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxButtonModule,
    NxCheckboxModule,
    NxDropdownModule,
    NxFormfieldModule,
    NxIconModule,
    NxInputModule,
    NxRadioModule,
    NxTableModule,
    EmptyStateComponent,
    NewAddressEntryComponent,
    StatusChipComponent
  ],
  templateUrl: './payee-section.component.html',
  styleUrl: './payee-section.component.scss'
})
export class PayeeSectionComponent {
  readonly form = input.required<FormGroup>();
  readonly payees = input.required<Payee[]>();
  readonly selected = input<Payee | null>(null);
  readonly differentBeneficiary = input(false);
  readonly emailYes = input(false);
  readonly channel = input<'email' | 'letter'>('email');
  // Fields still empty, passed in only after the first attempt to submit.
  readonly missing = input<string[]>([]);

  readonly adding = signal(false);
  readonly newEmail = new FormControl('', { nonNullable: true });
  // Addresses typed in here, kept per payee so switching payee does not mix them up.
  private readonly extraEmails = signal<{ payeeId: string; address: string }[]>([]);

  readonly emails = computed<PayeeEmail[]>(() => {
    const p = this.selected();
    if (!p) return [];
    const extra = this.extraEmails()
      .filter(e => e.payeeId === p.payeeId)
      .map(e => ({ address: e.address, preferred: false }));
    return [...(p.emails ?? []), ...extra];
  });

  readonly addresses = computed(() => {
    const p = this.selected();
    if (!p) return [];
    const rest = (p.otherAddresses ?? []).map(address => ({ address, preferred: false }));
    return [...(p.address ? [{ address: p.address, preferred: true }] : []), ...rest];
  });

  setDifferentAddress(on: boolean): void {
    this.form().controls['letterDifferent'].setValue(on);
    if (!on) this.form().controls['letterCustom'].setValue('');
  }

  addEmail(): void {
    const address = this.newEmail.value.trim();
    const p = this.selected();
    if (!address || !p || this.emails().some(e => e.address === address)) return;
    this.extraEmails.update(list => [...list, { payeeId: p.payeeId, address }]);
    this.form().controls['emailAddress'].setValue(address);
    this.newEmail.setValue('');
    this.adding.set(false);
  }

  setBeneficiary(v: 'same' | 'different'): void {
    this.form().controls['beneficiary'].setValue(v);
  }

  setEmail(v: boolean): void {
    this.form().controls['confirmEmail'].setValue(v);
  }
}
