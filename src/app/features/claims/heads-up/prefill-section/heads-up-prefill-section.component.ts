import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import {
  LargeLossHeadsUp,
  PREFILL_FIELDS,
  PREFILL_GROUPS,
  PrefillField
} from '../../../../core/models/large-loss-heads-up.model';
import { AppDatePipe } from '../../../../shared/pipes/app-date.pipe';
import { ValuesGroup } from '../heads-up-form';

// BMPCC-22350 AC3: every pre-filled value shown, editable, and clearly marked.
// Each field says where its value came from under the input ("From the claim",
// "Changed by you" + the claim value, or "Not on the claim yet"), and a changed
// value has "Use the claim value" next to it. Submitted = read-only list.
@Component({
  selector: 'app-heads-up-prefill-section',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxFormfieldModule,
    NxInputModule,
    NxDatefieldModule,
    NxButtonModule,
    NxIconModule,
    NxMessageModule
  ],
  templateUrl: './heads-up-prefill-section.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './heads-up-prefill-section.component.scss'
})
export class HeadsUpPrefillSectionComponent {
  readonly values = input.required<ValuesGroup>();
  readonly headsUp = input.required<LargeLossHeadsUp>();
  readonly readonly = input(false);

  readonly groups = PREFILL_GROUPS.map(g => ({ ...g, fields: PREFILL_FIELDS.filter(f => f.group === g.group) }));

  ctrl(f: PrefillField): FormControl<string> {
    return this.values().controls[f.key];
  }

  claimValue(f: PrefillField): string {
    return this.headsUp().prefill?.[f.key] ?? '';
  }

  changed(f: PrefillField): boolean {
    return (this.ctrl(f).value ?? '').trim() !== this.claimValue(f);
  }

  reset(f: PrefillField): void {
    this.ctrl(f).setValue(this.claimValue(f));
    this.ctrl(f).markAsDirty();
  }

  /** "Not on the claim yet" for a whole block (Finance pending). */
  groupPending(group: string): boolean {
    return group === 'financial' && !!this.headsUp().financialPending;
  }

  hint(f: PrefillField): string {
    const claim = this.claimValue(f);
    if (!claim) {
      if (this.changed(f)) return 'Entered by you. Not on the claim.';
      return f.group === 'financial' && this.headsUp().financialPending
        ? 'Waiting for Finance. You can enter it yourself.'
        : 'Not on the claim yet. Enter it yourself.';
    }
    if (!this.changed(f)) return f.group === 'financial' ? 'From Finance' : 'From the claim';
    return `Changed by you. Claim value: ${this.display(f, claim)}`;
  }

  patternError(f: PrefillField): string {
    return f.kind === 'percent' ? 'Enter a percentage from 0 to 100.' : 'Enter a number, e.g. 250000.';
  }

  display(f: PrefillField, v: string): string {
    if (!v) return '–';
    if (f.kind === 'date') return new AppDatePipe().transform(v);
    if (f.kind === 'amount') return Number(v.replace(',', '.')).toLocaleString('en-US');
    if (f.kind === 'percent') return `${v} %`;
    return v;
  }
}
