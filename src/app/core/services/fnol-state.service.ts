import { Injectable } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Subject } from 'rxjs';
import { LocationPickerOutput } from '../models';
import {
  FnolSelectedClient,
  FnolSelectedPolicy,
  SkeletonFormValue,
  StepConfig
} from '../../features/fnol/models/fnol-form.model';
import { Policy } from '../models';
import { LossInformation } from '../models/loss-information.model';
import { FileRestriction } from '../models/claim-overview.model';
import { futureDateValidator, dateOrderValidator } from '../../shared/validators/date.validators';

const HAPPY_PATH_STEPS: StepConfig[] = [
  { key: 'loss-information', route: '/fnol/loss-information', label: 'Loss information' },
  { key: 'entities-damages', route: '/fnol/entities-damages', label: 'Entities & Damages' },
  { key: 'parties', route: '/fnol/parties', label: 'Parties' },
  { key: 'reserves', route: '/fnol/reserves', label: 'Reserves' },
  { key: 'summary', route: '/fnol/summary', label: 'Summary' }
];

// Orphan / skeleton-claim path steps (BMPCC-241). Location capture lives on
// the Loss information page itself (Vasudha feedback, 2026-09-11) — same
// placement as the regular happy-path flow — so it is not its own step here.
const SKELETON_PATH_STEPS: StepConfig[] = [
  { key: 'skeleton-create', route: '/fnol/skeleton-create', label: 'Loss information' },
  { key: 'skeleton-parties', route: '/fnol/skeleton-parties', label: 'Parties' },
  { key: 'skeleton-summary', route: '/fnol/skeleton-summary', label: 'Summary' }
];

// Provided in root so FormGroup state persists across wizard navigation.
@Injectable({ providedIn: 'root' })
export class FnolStateService {
  readonly fnolForm = new FormGroup({
    search: new FormGroup({
      clientName: new FormControl('', []),
      policyNumber: new FormControl('', []),
      underwritingYear: new FormControl<string | null>(null, []),
      externalRef: new FormControl('', []),
      claimLossEventNumber: new FormControl('', []),
      dateOfLoss: new FormControl('', []),
      broker: new FormControl('', []),
      lineOfBusiness: new FormControl<string | null>(null, []),
      location: new FormControl('', []),
      operatingEntity: new FormControl<string | null>(null, [])
    }),
    lossInformation: new FormGroup({
      dateOfLoss: new FormGroup(
        {
          dateOfOccurrence: new FormControl<string | null>(null, [
            Validators.required,
            FnolStateService.futureDateValidator
          ]),
          timeOfOccurrence: new FormControl<string | null>(null, [Validators.required]),
          dateOfNotification: new FormControl<string | null>(null, [
            Validators.required,
            FnolStateService.futureDateValidator
          ]),
          timeOfNotification: new FormControl<string | null>(null, [Validators.required])
        },
        { validators: FnolStateService.dateOrderValidator }
      ),
      lossLocation: new FormControl<LocationPickerOutput>({ locations: [] }),
      causeOfLoss: new FormControl<string[]>([], []),
      typeOfDamage: new FormControl<string[]>([], []),
      // BMPCC-18160 — single incident circumstance, options filtered by the
      // confirmed cause of loss. Not required: the peril is often confirmed
      // before anyone can say what actually happened.
      circumstance: new FormControl<string | null>(null),
      // Free-text qualifier, shown and required only while causeOfLoss includes
      // its "Other" option. The validator is added and cleared by the step
      // component, not declared here, because "required" depends on a sibling
      // control's value (see step-loss-information's syncSpecifyOther()).
      specifyOtherCauseOfLoss: new FormControl<string>(''),
      // CBI (contingent business interruption) — BMPCC-18353. Shown and
      // required only while typeOfDamage includes 'business-interruption';
      // required-ness of cbiCaseType/cbiThirdPartyName/cbiLocation is added
      // and cleared by the step component (see step-loss-information's
      // syncCbi()), same reasoning as specifyOtherCauseOfLoss above.
      cbiApplicable: new FormControl<'yes' | 'no' | null>(null),
      cbiCaseType: new FormControl<string | null>(null),
      cbiThirdPartyName: new FormControl<string>(''),
      cbiThirdPartyIndustry: new FormControl<string>(''),
      // Reuses the exact same GIS-search-or-manual pattern as lossLocation
      // above (LocationPickerComponent, no-policy path — CBI's originating
      // location is a third party's site, never the insured's own policy
      // locations). Was free text briefly (team call, 2026-09-25), before
      // that a 7-field FormGroup (country/city/zip/street/houseNumber/
      // landRecordNumber/state) — this supersedes both.
      cbiLocation: new FormControl<LocationPickerOutput>({ locations: [] }),
      lossDescription: new FormControl('', [Validators.maxLength(500)]),
      events: new FormArray([])
    })
  });

  readonly completedSteps = new Set<string>();

  // Dev-only bridge: dev banner → search component
  readonly devSearchFill$ = new Subject<{ policyNumber: string; clientName: string }>();

  selectedClient: FnolSelectedClient | null = null;
  selectedPolicy: FnolSelectedPolicy | null = null;

  // Shared by step-reserves and step-summary (both fall back to '', not null).
  get policyNumber(): string {
    return this.selectedPolicy?.policyNumber ?? '';
  }

  // File restriction state (BMPCC-10994) — set from summary step
  restriction: FileRestriction = { isRestricted: false, accessList: [] };

  // Recovery Potential flag — can be left blank at FNOL and answered later,
  // but the claim cannot be closed until it has a Yes/No on record (see
  // claim-closure-blocker.builder.ts). Not "optional" in the sense of not
  // mattering — see recovery-potential.model.ts.
  recoveryPotential: 'yes' | 'no' | null = null;
  // Required rationale when recoveryPotential is 'no' — same rule Claim
  // Overview's card enforces (RecoveryPotentialCardComponent). FNOL used to
  // let a "No" through with no reason captured anywhere, which is exactly
  // the unaudited answer the rule exists to prevent.
  recoveryPotentialNote: string | null = null;
  selectedPolicyFull: Policy | null = null;
  path: 'standard' | 'orphan' | null = null;
  skeleton: SkeletonFormValue | null = null;
  skeletonClaimId: string | null = null;

  // ── Step config ────────────────────────────────────────────────────

  getStepsForPath(wizardPath: 'happy' | 'skeleton'): StepConfig[] {
    return wizardPath === 'happy' ? HAPPY_PATH_STEPS : SKELETON_PATH_STEPS;
  }

  isWizardRoute(url: string): boolean {
    return (
      HAPPY_PATH_STEPS.some(s => url.includes(s.route)) ||
      SKELETON_PATH_STEPS.some(s => url.includes(s.route))
    );
  }

  getCurrentStepIndex(url: string, wizardPath: 'happy' | 'skeleton' = 'happy'): number {
    const steps = this.getStepsForPath(wizardPath);
    return steps.findIndex(s => url.includes(s.route));
  }

  // ── Validators ────────────────────────────────────────────────────

  // Values from NxDatefieldModule+NxIsoDateModule come in as ISO strings ("YYYY-MM-DD")
  // Moved to shared/validators/date.validators.ts — kept as static methods (not
  // field assignments — a field initializer referencing another static field
  // declared later in this same class breaks on evaluation order; a method
  // doesn't have that problem) so existing FnolStateService.futureDateValidator/
  // dateOrderValidator call sites don't need to change.
  static futureDateValidator(control: AbstractControl): ValidationErrors | null {
    return futureDateValidator(control);
  }

  static dateOrderValidator(group: AbstractControl): ValidationErrors | null {
    return dateOrderValidator(group);
  }

  // ── Form accessors ─────────────────────────────────────────────────

  getStepGroup(step: 'search' | 'lossInformation'): FormGroup {
    return this.fnolForm.get(step) as FormGroup;
  }

  getDateOfLossGroup(): FormGroup {
    return this.fnolForm.get('lossInformation.dateOfLoss') as FormGroup;
  }

  getLossLocationControl(): FormControl<LocationPickerOutput> {
    return this.fnolForm.get('lossInformation.lossLocation') as FormControl<LocationPickerOutput>;
  }

  getCbiLocationControl(): FormControl<LocationPickerOutput> {
    return this.fnolForm.get('lossInformation.cbiLocation') as FormControl<LocationPickerOutput>;
  }

  getLossEventsArray(): FormArray {
    return this.fnolForm.get('lossInformation.events') as FormArray;
  }

  // ── Context setters ────────────────────────────────────────────────

  setSelectedClient(client: FnolSelectedClient): void {
    this.selectedClient = client;
    this.selectedPolicy = null;
  }

  setSelectedPolicy(policy: FnolSelectedPolicy, full?: Policy): void {
    this.selectedPolicy = policy;
    this.selectedPolicyFull = full ?? null;
    this.selectedClient = null;
  }

  setSkeleton(value: SkeletonFormValue, claimId: string): void {
    this.skeleton = value;
    this.skeletonClaimId = claimId;
  }

  // BMPCC-415: prefill the loss-information FormGroup from an existing LossInformation
  // record (edit flow). Follows prefillFromSkeleton() pattern. Does NOT reset the
  // full form — caller controls context. Only patches lossInformation sub-group.
  prefillFromExistingLossInfo(li: LossInformation): void {
    this.getDateOfLossGroup().patchValue({
      dateOfOccurrence: li.dateOfLoss?.dateOfOccurrence ?? null,
      timeOfOccurrence: li.dateOfLoss?.timeOfOccurrence ?? null,
      dateOfNotification: li.dateOfLoss?.dateOfNotification ?? null,
      timeOfNotification: li.dateOfLoss?.timeOfNotification ?? null
    });
    this.fnolForm.get('lossInformation.causeOfLoss')?.setValue(li.causeOfLoss ?? []);
    this.fnolForm.get('lossInformation.typeOfDamage')?.setValue(li.typeOfDamage ?? []);
    this.fnolForm.get('lossInformation.circumstance')?.setValue(li.circumstance ?? null);
    this.fnolForm
      .get('lossInformation.specifyOtherCauseOfLoss')
      ?.setValue(li.specifyOtherCauseOfLoss ?? '');
    this.fnolForm.get('lossInformation.lossDescription')?.setValue(li.lossDescription ?? '');

    // Rebuild events FormArray
    const eventsArray = this.getLossEventsArray();
    eventsArray.clear();
    (li.events ?? []).forEach(ev => {
      eventsArray.push(
        new FormGroup({
          eventKey: new FormControl(ev.eventKey),
          damages: new FormControl<string[]>(ev.damages ?? [], [Validators.required]),
          ...(ev.causedBy ? { causedBy: new FormControl<string[]>(ev.causedBy) } : {})
        })
      );
    });

    if (li.lossLocation) {
      this.getLossLocationControl().setValue({ locations: [] });
    }
  }

  markStepComplete(step: string): void {
    this.completedSteps.add(step);
  }

  reset(): void {
    this.fnolForm.reset();
    (this.fnolForm.get('lossInformation.events') as FormArray).clear();
    this.completedSteps.clear();
    this.selectedClient = null;
    this.selectedPolicy = null;
    this.selectedPolicyFull = null;
    this.path = null;
    this.skeleton = null;
    this.skeletonClaimId = null;
  }
}
