import { Injectable } from '@angular/core';
import { AbstractControl, FormArray, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { LocationPickerOutput } from '../../../core/models';
import {
  FnolSelectedClient,
  FnolSelectedPolicy,
  SkeletonFormValue,
  StepConfig,
} from '../models/fnol-form.model';
import { Policy } from '../../../core/models';

const HAPPY_PATH_STEPS: StepConfig[] = [
  { key: 'loss-information', route: '/fnol/loss-information', label: 'Loss information'  },
  { key: 'entities-damages', route: '/fnol/entities-damages', label: 'Entities & Damages' },
  { key: 'parties',          route: '/fnol/parties',          label: 'Parties'            },
  { key: 'reserves',         route: '/fnol/reserves',         label: 'Reserves'           },
  { key: 'summary',          route: '/fnol/summary',          label: 'Summary'            },
];

// Skeleton path steps — TBD Phase 2
const SKELETON_PATH_STEPS: StepConfig[] = [];

// Provided in root so FormGroup state persists across wizard navigation.
@Injectable({ providedIn: 'root' })
export class FnolStateService {
  readonly fnolForm = new FormGroup({
    search: new FormGroup({
      clientName:           new FormControl('', []),
      policyNumber:         new FormControl('', []),
      underwritingYear:     new FormControl<string | null>(null, []),
      externalRef:          new FormControl('', []),
      claimLossEventNumber: new FormControl('', []),
      dateOfLoss:           new FormControl('', []),
      broker:               new FormControl('', []),
      lineOfBusiness:       new FormControl<string | null>(null, []),
      location:             new FormControl('', []),
      operatingEntity:      new FormControl<string | null>(null, []),
    }),
    lossInformation: new FormGroup({
      dateOfLoss: new FormGroup({
        dateOfOccurrence:   new FormControl<string | null>(null, [Validators.required, FnolStateService.futureDateValidator]),
        timeOfOccurrence:   new FormControl<string | null>(null, [Validators.required]),
        dateOfNotification: new FormControl<string | null>(null, [Validators.required, FnolStateService.futureDateValidator]),
        timeOfNotification: new FormControl<string | null>(null, [Validators.required]),
      }, { validators: FnolStateService.dateOrderValidator }),
      lossLocation: new FormControl<LocationPickerOutput>({ locations: [] }),
      causeOfLoss:     new FormControl<string[]>([], []),
      typeOfDamage:    new FormControl<string[]>([], []),
      lossDescription: new FormControl('', [Validators.maxLength(500)]),
      causeDetails: new FormGroup({
        fire: new FormGroup({
          fireOrigin:                new FormControl(''),
          fireDepartmentCalled:      new FormControl<boolean | null>(null),
          fireDepartmentReportNumber: new FormControl(''),
        }),
        waterDamage: new FormGroup({
          waterSource:    new FormControl<string | null>(null),
          affectedAreaSqm: new FormControl<number | null>(null),
        }),
        theft: new FormGroup({
          policeReportNumber:    new FormControl(''),
          estimatedValueStolen:  new FormControl<number | null>(null),
          dateReportedToPolice:  new FormControl<string | null>(null),
        }),
      }),
      events: new FormArray([]),
    }),
  });

  readonly completedSteps = new Set<string>();

  // Dev-only bridge: dev banner → search component
  readonly devSearchFill$ = new Subject<{ policyNumber: string; clientName: string }>();

  selectedClient: FnolSelectedClient | null = null;
  selectedPolicy: FnolSelectedPolicy | null = null;
  selectedPolicyFull: Policy | null = null;
  path: 'standard' | 'orphan' | null = null;
  skeleton: SkeletonFormValue | null = null;
  skeletonClaimId: string | null = null;

  // ── Step config ────────────────────────────────────────────────────

  getStepsForPath(wizardPath: 'happy' | 'skeleton'): StepConfig[] {
    return wizardPath === 'happy' ? HAPPY_PATH_STEPS : SKELETON_PATH_STEPS;
  }

  isWizardRoute(url: string): boolean {
    return HAPPY_PATH_STEPS.some(s => url.includes(s.route)) ||
           SKELETON_PATH_STEPS.some(s => url.includes(s.route));
  }

  getCurrentStepIndex(url: string, wizardPath: 'happy' | 'skeleton' = 'happy'): number {
    const steps = this.getStepsForPath(wizardPath);
    return steps.findIndex(s => url.includes(s.route));
  }

  // ── Validators ────────────────────────────────────────────────────

  // Values from NxDatefieldModule+NxIsoDateModule come in as ISO strings ("YYYY-MM-DD")
  static futureDateValidator(control: AbstractControl): ValidationErrors | null {
    const val = control.value as string | null;
    if (val && val > new Date().toISOString().split('T')[0]) {
      return { futureDate: true };
    }
    return null;
  }

  static dateOrderValidator(group: AbstractControl): ValidationErrors | null {
    const occurrence   = group.get('dateOfOccurrence')?.value as string | null;
    const notification = group.get('dateOfNotification')?.value as string | null;
    if (occurrence && notification && occurrence > notification) {
      return { dateOrder: true };
    }
    return null;
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

  getCauseDetailsGroup(): FormGroup {
    return this.fnolForm.get('lossInformation.causeDetails') as FormGroup;
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
