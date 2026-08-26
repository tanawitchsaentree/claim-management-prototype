import { Injectable } from '@angular/core';
import { AbstractControl, FormArray, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { LocationItem, LocationPickerOutput } from '../../../core/models';
import {
  FnolSelectedClient,
  FnolSelectedPolicy,
  SkeletonFormValue,
  StepConfig,
} from '../models/fnol-form.model';
import { Policy } from '../../../core/models';
import { SkeletonClaim } from '../../../core/models/skeleton-claim.model';
import { LossInformation } from '../../../core/models/loss-information.model';
import { CAUSE_SCHEMAS } from '../config/cause-schemas';
import { FileRestriction, AccessListEntry } from '../../../core/models/claim-overview.model';
import { futureDateValidator, dateOrderValidator } from '../../../shared/validators/date.validators';

const HAPPY_PATH_STEPS: StepConfig[] = [
  { key: 'loss-information', route: '/fnol/loss-information', label: 'Loss information'  },
  { key: 'entities-damages', route: '/fnol/entities-damages', label: 'Entities & Damages' },
  { key: 'parties',          route: '/fnol/parties',          label: 'Parties'            },
  { key: 'reserves',         route: '/fnol/reserves',         label: 'Reserves'           },
  { key: 'summary',          route: '/fnol/summary',          label: 'Summary'            },
];

// Orphan / skeleton-claim path steps (BMPCC-241)
const SKELETON_PATH_STEPS: StepConfig[] = [
  { key: 'skeleton-create',   route: '/fnol/skeleton-create',   label: 'Loss information' },
  { key: 'skeleton-parties',  route: '/fnol/skeleton-parties',  label: 'Parties'          },
  { key: 'skeleton-location', route: '/fnol/skeleton-location', label: 'Location'         },
  { key: 'skeleton-summary',  route: '/fnol/skeleton-summary',  label: 'Summary'          },
];

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
      events: new FormArray([]),
    }),
  });

  readonly completedSteps = new Set<string>();

  // Dev-only bridge: dev banner → search component
  readonly devSearchFill$ = new Subject<{ policyNumber: string; clientName: string }>();

  selectedClient: FnolSelectedClient | null = null;
  selectedPolicy: FnolSelectedPolicy | null = null;

  // Shared by step-reserves and step-summary (both fall back to '', not null).
  get policyNumber(): string { return this.selectedPolicy?.policyNumber ?? ''; }

  // File restriction state (BMPCC-10994) — set from summary step
  restriction: FileRestriction = { isRestricted: false, accessList: [] };

  // Recovery Potential flag — optional, captured during FNOL Summary
  recoveryPotential: 'yes' | 'no' | null = null;
  selectedPolicyFull: Policy | null = null;
  path: 'standard' | 'orphan' | null = null;
  skeleton: SkeletonFormValue | null = null;
  skeletonClaimId: string | null = null;
  // Full skeleton being converted — kept so the search page can show rich
  // context (client + loss event) while the user picks a policy.
  convertingSkeleton: SkeletonClaim | null = null;

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

  // Convert flow (BMPCC-11006): prefill happy-path form from a skeleton claim,
  // remember which skeleton we are converting so summary can link them.
  prefillFromSkeleton(skeleton: SkeletonClaim): void {
    this.reset();
    this.path = 'standard';
    this.skeletonClaimId = skeleton.claimId;
    this.convertingSkeleton = skeleton;
    if (skeleton.lossDate) {
      this.getDateOfLossGroup().patchValue({
        dateOfOccurrence: skeleton.lossDate,
      });
    }
    if (skeleton.lossDescription) {
      this.fnolForm.get('lossInformation.lossDescription')?.setValue(skeleton.lossDescription);
    }
  }

  // BMPCC-11006 demo helper: prefill every wizard form from a skeleton claim
  // so the user lands at /fnol/search with everything teed up and can simply
  // click through Search → select policy → Continue → Next on every step.
  // No step is skipped — the demo proves the convert flow end to end.
  // Schema-driven: cause is inferred from skeleton.lossDescription against
  // CAUSE_SCHEMAS keys; events FormArray is rebuilt to match step-loss-info's
  // own _createEventGroup shape so its required `damages` validator clears.
  prefillFullFromSkeleton(skeleton: SkeletonClaim, opts?: {
    policyNumber?: string;
    causeOfLoss?: string[];
    typeOfDamage?: string[];
    timeOfOccurrence?: string;
    dateOfNotification?: string;
    timeOfNotification?: string;
    location?: LocationItem;
  }): void {
    this.path = 'standard';
    this.skeletonClaimId = skeleton.claimId;
    // Search form — user lands on /fnol/search with name + policy + date set
    // so they only need to click Search and pick the row.
    this.fnolForm.get('search.clientName')?.setValue(skeleton.clientName ?? '');
    this.fnolForm.get('search.policyNumber')?.setValue(opts?.policyNumber ?? '');
    this.fnolForm.get('search.dateOfLoss')?.setValue(skeleton.lossDate ?? '');
    // Loss-information form
    this.getDateOfLossGroup().patchValue({
      dateOfOccurrence:   skeleton.lossDate ?? null,
      timeOfOccurrence:   opts?.timeOfOccurrence   ?? '09:00',
      dateOfNotification: opts?.dateOfNotification ?? skeleton.lossDate ?? null,
      timeOfNotification: opts?.timeOfNotification ?? '10:00',
    });
    this.fnolForm.get('lossInformation.lossDescription')?.setValue(skeleton.lossDescription ?? '');

    // Schema-driven cause inference: scan skeleton.lossDescription for the
    // first CAUSE_SCHEMAS key. Falls back to 'other-event' if nothing matches
    // — never hardcoded to 'fire'.
    const inferredCauseKeys = opts?.causeOfLoss ?? this.inferCauseKeys(skeleton.lossDescription);
    const damageValues      = opts?.typeOfDamage ?? ['material-damage'];

    this.fnolForm.get('lossInformation.causeOfLoss')?.setValue(inferredCauseKeys);
    this.fnolForm.get('lossInformation.typeOfDamage')?.setValue(damageValues);

    // Rebuild events FormArray to mirror step-loss-information._createEventGroup
    // shape — without this the events have no `damages` and Next fails validation.
    const eventsArray = this.getLossEventsArray();
    eventsArray.clear();
    inferredCauseKeys.forEach(causeKey => {
      const schema = CAUSE_SCHEMAS[causeKey];
      const controls: Record<string, FormControl> = {
        eventKey: new FormControl(causeKey),
        damages:  new FormControl<string[]>(damageValues, [Validators.required]),
      };
      if (schema?.causedByOptions?.length) {
        controls['causedBy'] = new FormControl<string[]>([schema.causedByOptions[0].value]);
      }
      eventsArray.push(new FormGroup(controls));
    });

    // Loss location: caller supplies a real PolicyLocation (resolved via
    // MockPolicyLocationService); only fall back to a manual stub if absent
    // so the validator still clears.
    if (opts?.location) {
      this.getLossLocationControl().setValue({ locations: [opts.location] });
    } else {
      this.getLossLocationControl().setValue({
        locations: [{
          id: 'convert-loss-location',
          source: 'manual',
          displayName: skeleton.clientName ?? 'Loss location',
          addressLine1: '',
          postalCode: '',
          city: '',
          country: '',
        }],
      });
    }
  }

  // BMPCC-415: prefill the loss-information FormGroup from an existing LossInformation
  // record (edit flow). Follows prefillFromSkeleton() pattern. Does NOT reset the
  // full form — caller controls context. Only patches lossInformation sub-group.
  prefillFromExistingLossInfo(li: LossInformation): void {
    this.getDateOfLossGroup().patchValue({
      dateOfOccurrence:   li.dateOfLoss?.dateOfOccurrence   ?? null,
      timeOfOccurrence:   li.dateOfLoss?.timeOfOccurrence   ?? null,
      dateOfNotification: li.dateOfLoss?.dateOfNotification ?? null,
      timeOfNotification: li.dateOfLoss?.timeOfNotification ?? null,
    });
    this.fnolForm.get('lossInformation.causeOfLoss')?.setValue(li.causeOfLoss ?? []);
    this.fnolForm.get('lossInformation.typeOfDamage')?.setValue(li.typeOfDamage ?? []);
    this.fnolForm.get('lossInformation.lossDescription')?.setValue(li.lossDescription ?? '');

    // Rebuild events FormArray
    const eventsArray = this.getLossEventsArray();
    eventsArray.clear();
    (li.events ?? []).forEach(ev => {
      eventsArray.push(new FormGroup({
        eventKey: new FormControl(ev.eventKey),
        damages:  new FormControl<string[]>(ev.damages ?? [], [Validators.required]),
        ...(ev.causedBy ? { causedBy: new FormControl<string[]>(ev.causedBy) } : {}),
      }));
    });

    if (li.lossLocation) {
      this.getLossLocationControl().setValue({ locations: [] });
    }
  }

  /** Match each CAUSE_SCHEMAS key against the skeleton description (case-insensitive). */
  private inferCauseKeys(description: string | undefined): string[] {
    if (!description) return ['other-event'];
    const lower = description.toLowerCase();
    const matches = Object.keys(CAUSE_SCHEMAS).filter(key => {
      const label = CAUSE_SCHEMAS[key].causeLabel.toLowerCase();
      return lower.includes(key) || lower.includes(label);
    });
    return matches.length ? matches.slice(0, 1) : ['other-event'];
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
    this.convertingSkeleton = null;
  }
}
