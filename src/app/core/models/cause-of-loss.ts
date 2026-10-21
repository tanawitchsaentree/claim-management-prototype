import { LookupOption, OTHER_CAUSE_KEY } from './lookup.model';

// One place that turns a stored cause-of-loss code into what the handler reads
// and decides which codes the app accepts. Claims store lookup codes ("fire");
// older records also carry loose words ("storm", "water-damage") that are not
// in the lookup.

/** Loose words that mean one of the lookup's causes (Storm is a kind of Natural Event). */
const ALIASES: Record<string, string> = {
  storm: 'natural-event',
  'wind-storm': 'natural-event'
};

/** What to show for a cause code: the lookup's label, else a readable form of the code. */
export function causeLabel(code: string, options: LookupOption[]): string {
  const hit = options.find(o => o.value === code);
  if (hit) return hit.label;
  const words = code.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Codes the lookup knows (loose words mapped to their lookup cause). Anything
 * unknown is dropped; if nothing is left the result is "Other Event" and
 * `replaced` is true, so the screen can say why.
 */
export function normalizeCauses(
  codes: string[] | undefined,
  options: LookupOption[]
): { codes: string[]; replaced: boolean } {
  const known = new Set(options.map(o => o.value));
  const kept = [...new Set((codes ?? []).map(c => ALIASES[c] ?? c).filter(c => known.has(c)))];
  return kept.length ? { codes: kept, replaced: false } : { codes: [OTHER_CAUSE_KEY], replaced: true };
}
