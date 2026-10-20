import { PolicyLimit } from '../../../core/models/deductible.model';
import { FinancialReserve } from '../../../core/models/financial-overview.model';

export interface LimitHeadroom {
  remaining: number;
  name: string;
}

// Finance sections are named "Section 2: - Business Interruption" and carry ids
// S1/S2, limits use SEC-00x ids and plain names, so the match goes by name.
const clean = (name: string): string =>
  name
    .replace(/^section\s*\d+\s*:\s*-?\s*/i, '')
    .split(/\s[—–-]\s/)[0]
    .trim()
    .toLowerCase();

/** Same section under either naming scheme (finance "Section 2: - X" vs real "X — detail"). */
export const sameSection = (a: string, b: string): boolean => clean(a) === clean(b);

/**
 * Room left on the tightest limit that applies: the section's own limit and the
 * claim-wide limit, each minus what is already reserved against it (same
 * currency only). Returns null when no limit applies.
 */
export function limitHeadroom(
  limits: PolicyLimit[],
  reserves: FinancialReserve[],
  currency: string,
  sectionName?: string
): LimitHeadroom | null {
  const open = reserves.filter(r => r.status !== 'Rejected' && r.currency === currency);
  const candidates: LimitHeadroom[] = [];
  for (const l of limits.filter(x => x.currency === currency)) {
    if (l.level === 'claim') {
      const used = open.reduce((sum, r) => sum + r.reserveValue, 0);
      candidates.push({ remaining: l.amount - used, name: l.type.toLowerCase() });
    } else if (sectionName && l.sectionName && sameSection(l.sectionName, sectionName)) {
      const used = open
        .filter(r => sameSection(r.section, sectionName))
        .reduce((sum, r) => sum + r.reserveValue, 0);
      candidates.push({ remaining: l.amount - used, name: l.type.toLowerCase() });
    }
  }
  return candidates.length ? candidates.reduce((a, b) => (b.remaining < a.remaining ? b : a)) : null;
}
