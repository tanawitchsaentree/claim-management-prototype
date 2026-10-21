import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxMultiSelectComponent } from '@allianz/ng-aquila/dropdown';
import { MockLookupService } from '../../../../core/mock/services/mock-lookup.service';
import { MockLossInformationService } from '../../../../core/mock/services/mock-loss-information.service';
import { SkeletonLocationChoiceService } from '../../../services/skeleton-location-choice.service';
import { LocationPickerComponent } from '../../location-picker/location-picker.component';
import { NxRadioToggleModule } from '@allianz/ng-aquila/radio-toggle';
import { firstValueFrom, tap } from 'rxjs';
import { Claim } from '../../../../core/models/claim.model';
import { causeLabel, normalizeCauses } from '../../../../core/models/cause-of-loss';
import { CompletionDetails } from '../../../../core/models/claim-completion.model';
import { LocationPickerOutput, OTHER_CAUSE_KEY } from '../../../../core/models';
import { PolicySearchResult } from '../../../../features/fnol/models/fnol-form.model';
import { syncCbiControls } from '../../../utils/cbi-rules';
import { CbiPanelComponent } from '../../cbi-panel/cbi-panel.component';

const MAX_DESCRIPTION = 500;

// Step 2 of the Link policy sheet: what a skeleton claim never captured. Loss
// description (required), cause of loss (kept if the lookup knows it, else
// "Other Event"), and the CBI questions when the cause is business interruption.
@Component({
  selector: 'app-complete-claim-step',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxButtonModule,
    NxFormfieldModule,
    NxInputModule,
    NxMessageModule,
    NxMultiSelectComponent,
    NxRadioToggleModule,
    CbiPanelComponent,
    LocationPickerComponent
  ],
  templateUrl: './complete-claim-step.component.html',
  styleUrl: './complete-claim-step.component.scss'
})
export class CompleteClaimStepComponent {
  private readonly lookupSvc = inject(MockLookupService);
  private readonly lossInfoSvc = inject(MockLossInformationService);
  private readonly locationChoice = inject(SkeletonLocationChoiceService);

  readonly skeleton = input.required<Claim>();
  readonly policy = input.required<PolicySearchResult>();
  readonly busy = input(false);
  readonly back = output<void>();
  readonly confirmed = output<CompletionDetails>();

  readonly maxDescription = MAX_DESCRIPTION;
  readonly causeOptions = this.lookupSvc.getCauseOfLossSync();
  readonly cbiCaseTypeOptions = this.lookupSvc.getCbiCaseTypesSync();
  readonly cbiLocation = new FormControl<LocationPickerOutput>({ locations: [] }, { nonNullable: true });
  readonly submitAttempted = signal(false);
  readonly otherKey = OTHER_CAUSE_KEY;

  // Location of loss: kept as entered on the skeleton, or changed through the
  // existing Add location sheet. Only a change is written at conversion.
  readonly entered = signal<LocationPickerOutput>({ locations: [] });
  readonly changed = signal<LocationPickerOutput | null>(null);
  readonly shownLocation = computed(() => this.changed() ?? this.entered());
  readonly locationMode = new FormControl<'keep' | 'change'>('keep', { nonNullable: true });
  // Choosing a mode acts at once: Keep drops any change, Change opens the Add location sheet.
  private readonly modeWatch = toSignal(this.locationMode.valueChanges.pipe(tap(m => void this.onLocationMode(m))), {
    initialValue: 'keep' as const
  });
  readonly hasEntered = computed(() => this.entered().locations.length > 0);

  /** Which causes the skeleton had that this policy's list can't take (set once, shown as a note). */
  private readonly start = computed(() => normalizeCauses(this.skeleton().causeOfLoss, this.causeOptions));
  readonly replaced = computed(() => this.start().replaced);
  /** No cause at all on the skeleton, as opposed to one this policy can't take. */
  readonly noCause = computed(() => !(this.skeleton().causeOfLoss ?? []).length);
  readonly keptLabel = computed(() => this.start().codes.map(c => causeLabel(c, this.causeOptions)).join(', '));

  readonly form = new FormGroup({
    lossDescription: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_DESCRIPTION)]
    }),
    causeOfLoss: new FormControl<string[]>([], { nonNullable: true, validators: [Validators.required] }),
    specifyOtherCauseOfLoss: new FormControl('', { nonNullable: true }),
    cbiApplicable: new FormControl<'yes' | 'no' | null>(null),
    cbiCaseType: new FormControl<string | null>(null),
    cbiThirdPartyName: new FormControl('', { nonNullable: true }),
    cbiThirdPartyIndustry: new FormControl('', { nonNullable: true })
  });

  private readonly causes = toSignal(this.form.controls.causeOfLoss.valueChanges.pipe(startWith([] as string[])), {
    initialValue: [] as string[]
  });
  readonly showOther = computed(() => this.causes().includes(OTHER_CAUSE_KEY));
  /** CBI is asked when the cause is business interruption (the section it creates). */
  readonly askCbi = computed(() => this.causes().includes('business-interruption'));

  constructor() {
    queueMicrotask(() => this.init());
  }

  private init(): void {
    this.form.patchValue({
      lossDescription: this.skeleton().description ?? '',
      causeOfLoss: this.start().codes
    });
    this.syncCbi();
    void firstValueFrom(this.lossInfoSvc.getByClaimId(this.skeleton().claimId)).then(li =>
      this.entered.set((li?.lossLocation as unknown as LocationPickerOutput | undefined) ?? { locations: [] })
    );
  }

  syncCbi(): void {
    syncCbiControls(this.form, this.cbiLocation, this.askCbi());
  }

  /** The answer controls update just after their change event, so re-sync on the next tick. */
  onAnswerChange(): void {
    queueMicrotask(() => this.syncCbi());
  }

  /** Picking "Change location" opens the Add location sheet; closing it without a pick goes back to Keep. */
  async onLocationMode(mode: 'keep' | 'change'): Promise<void> {
    if (mode === 'keep') {
      this.changed.set(null);
      return;
    }
    await this.pickLocation();
  }

  /** Back to what the skeleton had (or to no location, when it had none). */
  useSkeletonLocation(): void {
    this.changed.set(null);
    this.locationMode.setValue('keep', { emitEvent: false });
  }

  async pickLocation(): Promise<void> {
    const picked = await this.locationChoice.choose(this.policy().policyNumber, this.entered().locations, {
      claim: this.skeleton().lineOfBusiness,
      policy: this.policy().lineOfBusiness
    });
    if (picked) this.changed.set(picked);
    else if (!this.changed()) this.locationMode.setValue('keep', { emitEvent: false });
  }

  get descriptionLength(): number {
    return this.form.controls.lossDescription.value.length;
  }

  private cbiComplete(): boolean {
    if (!this.askCbi()) return true;
    const v = this.form.getRawValue();
    if (!v.cbiApplicable) return false;
    if (v.cbiApplicable === 'no') return true;
    if (!v.cbiCaseType) return false;
    const named = v.cbiCaseType.endsWith('-named');
    if (named && !v.cbiThirdPartyName.trim()) return false;
    return this.cbiLocation.value.locations.length > 0;
  }

  onConfirm(): void {
    this.submitAttempted.set(true);
    this.syncCbi();
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.form.controls.lossDescription.value.trim() || !this.cbiComplete()) return;
    const v = this.form.getRawValue();
    this.confirmed.emit({
      lossDescription: v.lossDescription.trim(),
      causeOfLoss: v.causeOfLoss,
      specifyOtherCauseOfLoss: this.showOther() ? v.specifyOtherCauseOfLoss.trim() : undefined,
      location: this.changed() ?? undefined,
      cbi: this.askCbi()
        ? {
            cbiApplicable: v.cbiApplicable,
            cbiCaseType: v.cbiCaseType,
            cbiThirdPartyName: v.cbiThirdPartyName,
            cbiThirdPartyIndustry: v.cbiThirdPartyIndustry,
            cbiLocation: this.cbiLocation.value
          }
        : undefined
    });
  }
}
