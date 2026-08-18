import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { combineLatest, firstValueFrom } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxTimefieldModule } from '@allianz/ng-aquila/timefield';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxMultiSelectComponent } from '@allianz/ng-aquila/dropdown';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxLinkModule } from '@allianz/ng-aquila/link';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxModalModule, NxDialogService } from '@allianz/ng-aquila/modal';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxAccordionModule } from '@allianz/ng-aquila/accordion';
import { toSignal } from '@angular/core/rxjs-interop';
import { MockLossInformationService } from '../../../core/mock/services/mock-loss-information.service';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LocationPickerComponent } from '../../../shared/components/location-picker/location-picker.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { LossInformation, LossInformationFormValue } from '../../../core/models/loss-information.model';
import { ClaimActivity } from '../../../core/models/claim-overview.model';
import { LocationPickerOutput } from '../../../core/models';
import { FnolStateService } from '../../fnol/services/fnol-state.service';
import {
  LossInfoConfirmModalComponent,
  LossInfoConfirmModalData,
  LossInfoDiffField,
} from './loss-info-confirm-modal.component';
import { LossInfoDiscardModalComponent } from './loss-info-discard-modal.component';

// Claim description lives on ClaimOverview, not on LossInformation — it is
// edited here (this is the only edit screen) but saved through a different
// service and logged against a different objectType. The label is the key
// that routes it, so it is a const rather than a repeated literal.
const CLAIM_DESC_LABEL = 'Claim description';

@Component({
  selector: 'app-edit-loss-information',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    NxButtonModule, NxIconModule, NxFormfieldModule, NxInputModule,
    NxTimefieldModule, NxDatefieldModule,
    NxDropdownModule, NxMultiSelectComponent, NxRadioModule, NxLinkModule,
    NxMessageModule, NxModalModule, NxSpinnerModule,
    NxAccordionModule,
    LocationPickerComponent,
    PageHeaderComponent,
  ],
  templateUrl: './edit-loss-information.component.html',
  styleUrl: './edit-loss-information.component.scss',
})
export class EditLossInformationComponent implements OnInit {
  private readonly route        = inject(ActivatedRoute);
  private readonly router       = inject(Router);
  private readonly lossInfoSvc  = inject(MockLossInformationService);
  private readonly lookupSvc    = inject(MockLookupService);
  private readonly overviewSvc  = inject(MockClaimOverviewService);
  private readonly dialogSvc    = inject(NxDialogService);
  private readonly toast        = inject(ToastService);
  private readonly fnolState    = inject(FnolStateService);

  readonly claimId      = signal<string>('');
  readonly loading      = signal(true);
  readonly saving       = signal(false);
  readonly saveSuccess  = signal(false);
  readonly original     = signal<LossInformation | null>(null);
  readonly policyNumber = signal<string | null>(null);
  readonly originalClaimDescription = signal<string>('');
  readonly maxDesc   = 500;
  submitAttempted    = false;

  // ── Own FormGroup — isolated from FNOL wizard ────────────────────────
  readonly form = new FormGroup({
    // Claim-level, not loss-level. Deliberately not required: an existing
    // claim can arrive with an empty description (skeleton claims synthesize
    // it from lossDescription), and that must not block a loss-info save.
    claimDescription: new FormControl('', [Validators.maxLength(500)]),
    dateOfLoss: new FormGroup({
      dateOfOccurrence:   new FormControl<string | null>(null, [Validators.required, FnolStateService.futureDateValidator]),
      timeOfOccurrence:   new FormControl<string | null>(null, [Validators.required]),
      dateOfNotification: new FormControl<string | null>(null, [Validators.required, FnolStateService.futureDateValidator]),
      timeOfNotification: new FormControl<string | null>(null, [Validators.required]),
    }, { validators: FnolStateService.dateOrderValidator }),
    lossLocation:    new FormControl<LocationPickerOutput>({ locations: [] }),
    causeOfLoss:     new FormControl<string[]>([], []),
    lossDescription: new FormControl('', [Validators.required, Validators.maxLength(500)]),
  });

  get dateOfLoss()   { return this.form.get('dateOfLoss') as FormGroup; }
  get claimDescription() { return this.form.get('claimDescription') as FormControl<string | null>; }
  get lossLocation() { return this.form.get('lossLocation') as FormControl<LocationPickerOutput>; }

  // ── Lookups ──────────────────────────────────────────────────────────
  readonly causeOfLossOptions$  = this.lookupSvc.getCauseOfLoss();

  readonly causeOfLossOptions  = toSignal(this.causeOfLossOptions$,  { initialValue: [] });

  // ── Computed cause selected values ───────────────────────────────────
  get selectedCauses(): string[]  { return (this.form.get('causeOfLoss')?.value  as string[]) ?? []; }

  get causeOfLossDisplay(): string {
    const keys = this.selectedCauses;
    if (!keys.length) return '–';
    const opts = this.causeOfLossOptions();
    return keys.map(k => opts.find(o => o.value === k)?.label ?? k).join(', ');
  }

  // Cause of loss reads as a static value with an explicit "Change" affordance
  // rather than an always-open multi-select — most edit visits never touch it,
  // and re-presenting it as a fresh pick every time is the FNOL-intake pattern
  // this screen is trying to move away from. Starts open only when there is no
  // cause on record yet.
  readonly causeEditMode = signal(false);

  readonly isDirty = toSignal(this.form.valueChanges.pipe(map(() => this.form.dirty)), { initialValue: false });

  // ── Lifecycle ────────────────────────────────────────────────────────
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.claimId.set(id);

    firstValueFrom(this.lossInfoSvc.getByClaimId(id)).then(li => {
      this.loading.set(false);
      if (li) {
        this.original.set(li);
        this.prefillForm(li);
      }
    });

    firstValueFrom(this.overviewSvc.getOverview(id)).then(claim => {
      this.policyNumber.set(claim?.policyNumber ?? null);
      const desc = claim?.description ?? '';
      this.originalClaimDescription.set(desc);
      this.claimDescription.setValue(desc);
      this.claimDescription.markAsPristine();
    });
  }

  private prefillForm(li: LossInformation): void {
    this.dateOfLoss.patchValue({
      dateOfOccurrence:   li.dateOfLoss?.dateOfOccurrence   ?? null,
      timeOfOccurrence:   li.dateOfLoss?.timeOfOccurrence   ?? null,
      dateOfNotification: li.dateOfLoss?.dateOfNotification ?? null,
      timeOfNotification: li.dateOfLoss?.timeOfNotification ?? null,
    });
    this.form.patchValue({
      causeOfLoss:     li.causeOfLoss     ?? [],
      lossDescription: li.lossDescription ?? '',
      lossLocation:    (li.lossLocation as unknown as LocationPickerOutput) ?? { locations: [] },
    });
    this.causeEditMode.set(!li.causeOfLoss?.length);
    this.form.markAsPristine();
  }

  // ── Diff computation ─────────────────────────────────────────────────
  private computeDiffs(): LossInfoDiffField[] {
    const diffs: LossInfoDiffField[] = [];

    const addIf = (label: string, o: unknown, n: unknown) => {
      const os = o == null ? '' : String(o);
      const ns = n == null ? '' : String(n);
      if (os !== ns) diffs.push({ label, original: os, updated: ns });
    };

    // Claim-level field, diffed against the ClaimOverview value it came from.
    // Computed before the LossInformation guard below — a claim can have no
    // loss-information record yet, and a description edit must still register.
    addIf(CLAIM_DESC_LABEL, this.originalClaimDescription(), this.claimDescription.value);

    const orig = this.original();
    if (!orig) return diffs;
    const cur = this.form.getRawValue() as unknown as LossInformationFormValue;

    // Dates & times
    addIf('Date of occurrence',    orig.dateOfLoss?.dateOfOccurrence,   cur.dateOfLoss?.dateOfOccurrence);
    addIf('Time of occurrence',    orig.dateOfLoss?.timeOfOccurrence,   cur.dateOfLoss?.timeOfOccurrence);
    addIf('Date of notification',  orig.dateOfLoss?.dateOfNotification, cur.dateOfLoss?.dateOfNotification);
    addIf('Time of notification',  orig.dateOfLoss?.timeOfNotification, cur.dateOfLoss?.timeOfNotification);

    // General
    addIf('Cause of loss',   (orig.causeOfLoss ?? []).join(', '),  (cur.causeOfLoss ?? []).join(', '));
    addIf('Loss description', orig.lossDescription, cur.lossDescription);

    // Loss location (compare by displayName of first location as proxy)
    const origLoc = (orig.lossLocation as { locations?: { displayName?: string }[] } | null)?.locations?.[0]?.displayName ?? '';
    const curLoc  = (cur.lossLocation  as { locations?: { displayName?: string }[] } | null)?.locations?.[0]?.displayName ?? '';
    addIf('Loss location', origLoc, curLoc);

    return diffs;
  }

  // ── Save flow ─────────────────────────────────────────────────────────
  async onSaveChanges(): Promise<void> {
    this.submitAttempted = true;
    if (this.form.invalid) return;

    const diffs = this.computeDiffs();
    const data: LossInfoConfirmModalData = { claimId: this.claimId(), diffs };
    const ref = this.dialogSvc.open(LossInfoConfirmModalComponent, { data, width: '600px', maxWidth: '92vw' });
    const result = await firstValueFrom(ref.afterClosed());
    if (result !== 'confirmed') return;

    this.saveSuccess.set(false);
    this.saving.set(true);
    // claimDescription belongs to ClaimOverview — keep it out of the payload
    // or MockLossInformationService.save spreads it onto the stored record.
    const { claimDescription: _claimDesc, ...lossInfoRaw } = this.form.getRawValue();
    const formValue = lossInfoRaw as unknown as LossInformationFormValue;
    try {
      await firstValueFrom(this.lossInfoSvc.save(formValue, this.claimId()));

      // Write activity log entries for changed fields
      const activities: ClaimActivity[] = diffs.map((d, i) => ({
        id:         `act-edit-${Date.now()}-${i}`,
        claimId:    this.claimId(),
        user:       'Current User',
        timestamp:  new Date().toISOString(),
        objectType: d.label === CLAIM_DESC_LABEL ? 'Claim' : 'Loss Information',
        attribute:  d.label,
        valueOld:   d.original || null,
        valueNew:   d.updated  || null,
      }));

      if (activities.length) {
        this.overviewSvc.appendActivities?.(this.claimId(), activities);
      }

      // Claim Overview shows its own dateOfLoss/proximateLossCause fields —
      // separate from the LossInformation record this form edits. Without
      // this, the overview page (and any downstream copy of the claim, e.g.
      // its financial and reference-panel summaries) keeps showing the
      // original date/cause after an investigation reveals the real ones.
      await this.syncOverviewFromLossInfo(formValue, diffs);

      this.form.markAsPristine();
      this.saveSuccess.set(true);

      // ClaimSection/SectionEntity carry no structured link back to a cause-of-loss
      // or location key (name/damage are free text) — there is no reliable way to
      // tell which existing sections a change actually affects. Treat cause-of-loss
      // OR location changes as sections-impacting and send the user to review
      // manually, per the Miro flow ("triggers changes to existing sections" →
      // notify + redirect). Signed off 2026-08-18 — see CONVERSIONS.md.
      const impactLabels = ['Cause of loss', 'Loss location'];
      const impacted = diffs.filter(d => impactLabels.includes(d.label)).map(d => d.label);
      if (impacted.length) {
        this.toast.warning(
          `${impacted.join(' and ')} changed`,
          'Existing sections may no longer match — review them on the Sections page.',
        );
        this.router.navigate(['/claims', this.claimId(), 'sections']);
      } else {
        this.toast.success('Loss information updated', `${activities.length} field(s) changed on ${this.claimId()}`);
        this.router.navigate(['/claims', this.claimId(), 'overview']);
      }
    } catch {
      this.toast.error('Failed to save', 'Please try again. Your changes have been kept.');
      // Form stays dirty — user remains on edit screen to retry.
    } finally {
      this.saving.set(false);
    }
  }

  private async syncOverviewFromLossInfo(formValue: LossInformationFormValue, diffs: LossInfoDiffField[]): Promise<void> {
    const patch: { dateOfLoss?: string; proximateLossCause?: string; description?: string } = {};

    if (diffs.some(d => d.label === 'Date of occurrence') && formValue.dateOfLoss?.dateOfOccurrence) {
      patch.dateOfLoss = formValue.dateOfLoss.dateOfOccurrence;
    }
    if (diffs.some(d => d.label === 'Cause of loss')) {
      const firstCauseKey = formValue.causeOfLoss?.[0];
      const label = this.causeOfLossOptions().find(o => o.value === firstCauseKey)?.label;
      patch.proximateLossCause = label ?? firstCauseKey ?? '–';
    }
    // Claim description has no loss-information home — the overview record is
    // where it lives, and the overview page reads it straight back.
    if (diffs.some(d => d.label === CLAIM_DESC_LABEL)) {
      patch.description = this.claimDescription.value ?? '';
    }

    if (Object.keys(patch).length) {
      await firstValueFrom(this.overviewSvc.updateGeneralInfo(this.claimId(), patch));
    }
  }

  // ── Discard flow ──────────────────────────────────────────────────────
  async onDiscard(): Promise<void> {
    if (!this.form.dirty) {
      this.router.navigate(['/claims', this.claimId(), 'overview']);
      return;
    }
    const ref = this.dialogSvc.open(LossInfoDiscardModalComponent, { width: '440px' });
    const result = await firstValueFrom(ref.afterClosed());
    if (result === 'discard') {
      this.router.navigate(['/claims', this.claimId(), 'overview']);
    }
  }
}
