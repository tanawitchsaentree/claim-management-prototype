import { LossInformation, LossInformationFormValue } from '../../../core/models/loss-information.model';

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
// EditLossInformationComponent.onSaveChanges). 'Type of damages' added
// 2026-08-31 (Marlene feedback) — ClaimSection.damageType maps directly to
// that field, unlike Cause of loss / Loss location, which stay best-effort
// proxies: nothing on ClaimSection or SectionEntity points back at a
// cause-of-loss or location key.
export const IMPACT_LABELS = ['Cause of loss', 'Type of damages', 'Loss location'];

// Diff label -> which read/edit field group an update belongs to. Used by
// fieldChanged() to highlight the right field group; no longer used for
// per-field revert (removed 2026-08-31, Marlene feedback — Discard and the
// Confirm/Cancel step are the only undo paths now).
export const LABEL_TO_FIELD_KEY: Record<string, string> = {
  'Cause of loss':             'causeOfLoss',
  'Type of damages':           'typeOfDamage',
  // The qualifier points at the group whose edit block contains it, so the
  // changed-field highlight lands where the user can actually see the input.
  'Specify other cause of loss': 'causeOfLoss',
  'Date of occurrence':        'dateGroup',
  'Time of occurrence':        'dateGroup',
  'Date of notification':      'dateGroup',
  'Time of notification':      'dateGroup',
  'Loss description':          'lossDescription',
  'Loss location':             'lossLocation',
};

// Every field group sits collapsed behind an Update/Add link, so a required
// control that fails validation takes its error message down with it — Save
// simply refused with nothing on screen to fix. revealFirstInvalid() walks
// this list to name what is missing and to reopen the group that holds it.
export const VALIDATED_FIELDS: Array<{ path: string; field: string; label: string }> = [
  { path: 'dateOfLoss.dateOfOccurrence',   field: 'dateGroup',       label: 'Date of occurrence' },
  { path: 'dateOfLoss.timeOfOccurrence',   field: 'dateGroup',       label: 'Time of occurrence' },
  { path: 'dateOfLoss.dateOfNotification', field: 'dateGroup',       label: 'Date of notification' },
  { path: 'dateOfLoss.timeOfNotification', field: 'dateGroup',       label: 'Time of notification' },
  { path: 'causeOfLoss',                   field: 'causeOfLoss',     label: 'Cause of loss' },
  { path: 'specifyOtherCauseOfLoss',       field: 'causeOfLoss',     label: 'Specify other cause of loss' },
  { path: 'typeOfDamage',                  field: 'typeOfDamage',    label: 'Type of damage' },
  { path: 'lossDescription',               field: 'lossDescription', label: 'Loss description' },
];

// Diff baseline for a claim with no LossInformation record at all — an unknown
// claimId, since a real claim gets one synthesized (see
// MockLossInformationService.getByClaimId). Without it computeLossInfoDiffs
// returned [] unconditionally, which disabled Save forever on a screen the
// user had just filled in.
const BLANK_ORIGINAL = {
  dateOfLoss: {
    dateOfOccurrence: null, timeOfOccurrence: null,
    dateOfNotification: null, timeOfNotification: null,
  },
  lossLocation: { locations: [] },
  causeOfLoss: [], typeOfDamage: [], specifyOtherCauseOfLoss: '', lossDescription: '',
} as unknown as LossInformation;

type LocationsBag = { locations?: { displayName?: string }[] } | null;

export function computeLossInfoDiffs(
  original: LossInformation | null,
  cur: LossInformationFormValue,
): LossInfoDiffField[] {
  const diffs: LossInfoDiffField[] = [];

  const addIf = (label: string, o: unknown, n: unknown) => {
    const os = o == null ? '' : String(o);
    const ns = n == null ? '' : String(n);
    if (os !== ns) diffs.push({ label, original: os, updated: ns });
  };

  const orig = original ?? BLANK_ORIGINAL;

  // Dates & times
  addIf('Date of occurrence',    orig.dateOfLoss?.dateOfOccurrence,   cur.dateOfLoss?.dateOfOccurrence);
  addIf('Time of occurrence',    orig.dateOfLoss?.timeOfOccurrence,   cur.dateOfLoss?.timeOfOccurrence);
  addIf('Date of notification',  orig.dateOfLoss?.dateOfNotification, cur.dateOfLoss?.dateOfNotification);
  addIf('Time of notification',  orig.dateOfLoss?.timeOfNotification, cur.dateOfLoss?.timeOfNotification);

  // General
  addIf('Cause of loss',   (orig.causeOfLoss ?? []).join(', '),  (cur.causeOfLoss ?? []).join(', '));
  addIf('Type of damages', (orig.typeOfDamage ?? []).join(', '), (cur.typeOfDamage ?? []).join(', '));
  // Deliberately NOT in IMPACT_LABELS — retyping the qualifier describes the
  // same cause more precisely, it doesn't re-point ClaimSection.damageType.
  addIf('Specify other cause of loss', orig.specifyOtherCauseOfLoss, cur.specifyOtherCauseOfLoss);
  addIf('Loss description', orig.lossDescription, cur.lossDescription);

  // Loss location (compare by displayName of first location as proxy)
  const origLoc = (orig.lossLocation as LocationsBag)?.locations?.[0]?.displayName ?? '';
  const curLoc  = (cur.lossLocation  as LocationsBag)?.locations?.[0]?.displayName ?? '';
  addIf('Loss location', origLoc, curLoc);

  return diffs;
}
