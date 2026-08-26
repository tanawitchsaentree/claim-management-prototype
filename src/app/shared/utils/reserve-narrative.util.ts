import { ReserveNarrative } from '../../core/models/reserve.model';
import { LookupOption } from '../../core/models/lookup.model';
import { lookupLabel } from './lookup.util';

/** A narrative is "active" once saved and not superseded by a later archive (e.g. reserves were added). */
export function isNarrativeActive(narrative: ReserveNarrative | null | undefined): boolean {
  return !!narrative && !narrative.archivedAt;
}

export function narrativeReasonLabel(narrative: ReserveNarrative | null | undefined, options: LookupOption[]): string {
  if (!narrative) return '';
  return lookupLabel(options, narrative.reasonKey);
}
