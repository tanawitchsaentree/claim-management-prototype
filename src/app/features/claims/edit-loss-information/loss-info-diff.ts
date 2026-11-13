import {
  LossInformation,
  LossInformationFormValue
} from '../../../core/models/loss-information.model';
import { circumstanceLabel } from '../../fnol/config/circumstances';
import { causeLabel } from '../../../core/models/cause-of-loss';
import { LookupOption } from '../../../core/models/lookup.model';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { CBI_LABEL_TO_FIELD_KEY, CbiLabelSources, CbiValues, cbiDisplayRows } from './cbi-edit';

// Diff/impact vocabulary for the Edit claim details screen. Extracted from
// edit-loss-information.component.ts (2026-09-02) — the component was 532
// lines against a 300-line limit, and every constant below is pure data or
// pure computation with no dependency on the component instance.

export interface LossInfoDiffField {
  label: string;
  original: string;
  updated: string;
}

// Fields whose update is treated as sections-impacting (see
// EditLossInformationComponent.onSaveField). 'Type of damages' added
// 2026-08-31 (Marlene feedback) — ClaimSection.damageType maps directly to
// that field, unlike Cause of loss / Loss location, which stay best-effort
// proxies: nothing on ClaimSection or SectionEntity points back at a
// cause-of-loss or location key.
// BMPCC-18492: whether CBI applies and its case type decide how the Business
// Interruption section is set up, so changing either marks open sections for
// review too. The CBI details (name, industry, location...) don't.
export const IMPACT_LABELS = [
  'Cause of loss',
  'Type of damages',
  'Loss location',
  'Contingent business interruption',
  'CBI case type'
];

// Diff label -> which read/edit field group an update belongs to. Used by
// fieldChanged() to highlight the right field group; no longer used for
// per-field revert (removed 2026-08-31, Marlene feedback — Discard and the
// Confirm/Cancel step are the only undo paths now).
export const LABEL_TO_FIELD_KEY: Record<string, string> = {
  'Cause of loss': 'causeOfLoss',
  'Type of damages': 'typeOfDamage',
  // The qualifier points at the group whose edit block contains it, so the
  // changed-field highlight lands where the user can actually see the input.
  'Other Event (please specify)': 'causeOfLoss',
  // BMPCC-18160 — its own field group. Options are filtered by cause of loss,
  // but it gets its own Update link like every other field on this screen, and
  // its highlight has to land on its own row rather than on the cause's.
  'Incident circumstance': 'circumstance',
  'Date of occurrence': 'dateGroup',
  'Time of occurrence': 'dateGroup',
  'Date of notification': 'dateGroup',
  'Time of notification': 'dateGroup',
  // User call 2026-11-13: on Edit claim details this field reads "Claim
  // description" (FNOL keeps "Loss description"). The diff label is also the
  // key LossInfoSyncService.syncClaimCopies() matches on.
  'Claim description': 'lossDescription',
  'Loss location': 'lossLocation',
  ...CBI_LABEL_TO_FIELD_KEY
};

// Diff baseline for a claim with no LossInformation record at all — an unknown
// claimId, since a real claim gets one synthesized (see
// MockLossInformationService.getByClaimId). Without it computeLossInfoDiffs
// returned [] unconditionally, which disabled Save forever on a screen the
// user had just filled in.
const BLANK_ORIGINAL = {
  dateOfLoss: {
    dateOfOccurrence: null,
    timeOfOccurrence: null,
    dateOfNotification: null,
    timeOfNotification: null
  },
  lossLocation: { locations: [] },
  causeOfLoss: [],
  typeOfDamage: [],
  specifyOtherCauseOfLoss: '',
  lossDescription: ''
} as unknown as LossInformation;

type LocationsBag = { locations?: { displayName?: string }[] } | null;

/** The lookups the page itself reads its labels from. */
export interface DiffLabelSources {
  causes: LookupOption[];
  damages: LookupOption[];
  cbi?: CbiLabelSources;
}

export function computeLossInfoDiffs(
  original: LossInformation | null,
  cur: LossInformationFormValue,
  labels: DiffLabelSources = { causes: [], damages: [] }
): LossInfoDiffField[] {
  const diffs: LossInfoDiffField[] = [];

  // Compared on the stored values, shown the way the page shows them: a handler
  // reads "Material damage, Business interruption", not "material-damage, ...".
  const addIf = (label: string, o: unknown, n: unknown, show: (v: string) => string = v => v) => {
    const os = o == null ? '' : String(o);
    const ns = n == null ? '' : String(n);
    if (os !== ns) diffs.push({ label, original: show(os), updated: show(ns) });
  };
  const showKeys = (options: LookupOption[]) => (joined: string) =>
    joined
      .split(', ')
      .filter(Boolean)
      .map(k => causeLabel(k, options))
      .join(', ');

  // Dates read DD-MM-YYYY like everywhere else; the compare above stays on the stored value.
  const appDate = new AppDatePipe();
  const showDate = (v: string) => (v ? appDate.transform(v) : v);

  const orig = original ?? BLANK_ORIGINAL;

  // Dates & times
  addIf(
    'Date of occurrence',
    orig.dateOfLoss?.dateOfOccurrence,
    cur.dateOfLoss?.dateOfOccurrence,
    showDate
  );
  addIf('Time of occurrence', orig.dateOfLoss?.timeOfOccurrence, cur.dateOfLoss?.timeOfOccurrence);
  addIf(
    'Date of notification',
    orig.dateOfLoss?.dateOfNotification,
    cur.dateOfLoss?.dateOfNotification,
    showDate
  );
  addIf(
    'Time of notification',
    orig.dateOfLoss?.timeOfNotification,
    cur.dateOfLoss?.timeOfNotification
  );

  // General
  addIf(
    'Cause of loss',
    (orig.causeOfLoss ?? []).join(', '),
    (cur.causeOfLoss ?? []).join(', '),
    showKeys(labels.causes)
  );
  addIf(
    'Type of damages',
    (orig.typeOfDamage ?? []).join(', '),
    (cur.typeOfDamage ?? []).join(', '),
    showKeys(labels.damages)
  );
  // Deliberately NOT in IMPACT_LABELS — retyping the qualifier describes the
  // same cause more precisely, it doesn't re-point ClaimSection.damageType.
  addIf('Other Event (please specify)', orig.specifyOtherCauseOfLoss, cur.specifyOtherCauseOfLoss);
  // BMPCC-18160 — compared as labels, not keys: this diff is read by a human in
  // the confirm modal, and 'hot-work' tells them nothing. Deliberately NOT in
  // IMPACT_LABELS — a more precise circumstance doesn't re-point any section.
  addIf(
    'Incident circumstance',
    circumstanceLabel(orig.circumstance),
    circumstanceLabel(cur.circumstance)
  );
  addIf('Claim description', orig.lossDescription, cur.lossDescription);

  // BMPCC-18492: every CBI answer, compared as the label the card shows.
  const cbiLabels = labels.cbi ?? { caseTypes: [], utilityTypes: [] };
  const cbiBefore = cbiDisplayRows(orig as CbiValues, cbiLabels);
  const cbiAfter = cbiDisplayRows(cur as CbiValues, cbiLabels);
  cbiBefore.forEach((row, i) => addIf(row.label, row.value, cbiAfter[i].value));

  // Loss location: every location, by display name. (Comparing only the first
  // one meant adding, removing or changing a 2nd+ location was no change at all.)
  const names = (bag: LocationsBag): string =>
    (bag?.locations ?? []).map(l => l.displayName ?? '').join(', ');
  const origLoc = names(orig.lossLocation as LocationsBag);
  const curLoc = names(cur.lossLocation as LocationsBag);
  addIf('Loss location', origLoc, curLoc);

  return diffs;
}
