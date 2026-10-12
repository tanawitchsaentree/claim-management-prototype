import { LocationItem, PolicyLocation } from '../../../core/models';

const norm = (s?: string): string => (s ?? '').trim().toLowerCase();
const tokens = (s?: string): string[] => norm(s).split(/[^\p{L}\p{N}]+/u).filter(t => t.length > 1);

/** How close a policy location is to a hand-typed one (higher = closer). */
function closeness(original: LocationItem, candidate: PolicyLocation): number {
  let score = 0;
  if (norm(original.postalCode) && norm(original.postalCode) === norm(candidate.postalCode)) score += 4;
  if (norm(original.city) && norm(original.city) === norm(candidate.city)) score += 3;
  if (norm(original.country) && norm(original.country) === norm(candidate.country)) score += 1;
  const candidateTokens = new Set([...tokens(candidate.addressLine1), ...tokens(candidate.name)]);
  for (const t of tokens(original.addressLine1)) if (candidateTokens.has(t)) score += 2;
  return score;
}

/** Closest policy location to any of the typed ones first; ties keep policy order. */
export function rankByCloseness(
  originals: LocationItem[],
  candidates: PolicyLocation[]
): PolicyLocation[] {
  const best = (c: PolicyLocation): number =>
    Math.max(0, ...originals.map(o => closeness(o, c)));
  return candidates
    .map((c, i) => ({ c, i, s: best(c) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(x => x.c);
}

export type LocationField = 'street' | 'postal code' | 'city' | 'country';

/**
 * Which fields of a policy location differ from the typed one. Compared
 * trimmed + case-insensitive; the typed country is free text ("Germany")
 * while the policy holds a code ("DE"), so the caller passes the country's
 * display name for the policy side.
 */
export function differingFields(
  original: LocationItem,
  candidate: PolicyLocation,
  candidateCountryName: string
): LocationField[] {
  const out: LocationField[] = [];
  if (norm(original.addressLine1) !== norm(candidate.addressLine1)) out.push('street');
  if (norm(original.postalCode) !== norm(candidate.postalCode)) out.push('postal code');
  if (norm(original.city) !== norm(candidate.city)) out.push('city');
  const c = norm(original.country);
  if (c !== norm(candidate.country) && c !== norm(candidateCountryName)) out.push('country');
  return out;
}
