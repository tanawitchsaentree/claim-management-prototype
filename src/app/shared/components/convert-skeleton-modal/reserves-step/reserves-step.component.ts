import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { MockLookupService } from '../../../../core/mock/services/mock-lookup.service';
import { Claim } from '../../../../core/models/claim.model';
import { ReservePlan, SectionPlan } from '../../../../core/models/claim-completion.model';
import { PolicySearchResult } from '../../../../features/fnol/models/fnol-form.model';

// Step 4 of the Link policy sheet, optional: a first reserve for each section
// about to be created. Leave the amounts empty to set reserves later (the
// "Set up reserves" task stays). Same fields as Add reserve (type, sub-type,
// amount); the party is the client.
@Component({
  selector: 'app-reserves-step',
  standalone: true,
  imports: [ReactiveFormsModule, NxButtonModule, NxDropdownModule, NxFormfieldModule, NxInputModule],
  templateUrl: './reserves-step.component.html',
  styleUrl: './reserves-step.component.scss'
})
export class ReservesStepComponent {
  private readonly lookupSvc = inject(MockLookupService);

  readonly skeleton = input.required<Claim>();
  readonly policy = input.required<PolicySearchResult>();
  readonly sections = input.required<SectionPlan[]>();
  readonly busy = input(false);
  readonly back = output<void>();
  readonly confirmed = output<ReservePlan[]>();

  readonly typeOptions = this.lookupSvc.getReserveTypesSync().filter(o => o.value !== 'recoveries');
  readonly subTypeOptions = this.lookupSvc.getReserveSubTypesSync();
  readonly attempted = signal(false);

  // A signal (not a FormArray): the app is zoneless, so only signal changes redraw.
  readonly rows = signal<FormGroup[]>([]);
  readonly labels = computed(() => this.sections().map(s => `${this.damageLabel(s.damageType)} — ${s.entityNames[0] ?? ''}`.replace(/ — $/, '')));

  constructor() {
    queueMicrotask(() => this.init());
  }

  private damageLabel(key: string): string {
    return this.lookupSvc.getTypeOfDamageSync().find(o => o.value === key)?.label ?? key;
  }

  private init(): void {
    const plans = this.sections().length ? this.sections() : [{ damageType: '', entityNames: [] }];
    this.rows.set(
      plans.map(
        () =>
          new FormGroup({
            reserveType: new FormControl<string | null>('indemnity'),
            reserveSubType: new FormControl<string | null>('direct-loss'),
            amount: new FormControl<number | null>(null, [Validators.min(0.01)])
          })
      )
    );
  }

  rowLabel(i: number): string {
    return this.sections().length ? this.labels()[i] : 'Section built from the cause of loss';
  }

  onLink(): void {
    this.attempted.set(true);
    if (this.rows().some(r => r.invalid)) return;
    const plans: ReservePlan[] = this.rows()
      .map((r, i) => ({
        sectionIndex: i,
        reserveType: r.value.reserveType ?? 'indemnity',
        reserveSubType: r.value.reserveSubType ?? 'direct-loss',
        amount: Number(r.value.amount ?? 0)
      }))
      .filter(p => p.amount > 0);
    this.confirmed.emit(plans);
  }
}
