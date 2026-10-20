import { Deductible } from '../../../core/models/deductible.model';
import { FinancialOverview, FinancialReserve } from '../../../core/models/financial-overview.model';
import { PaymentLine } from '../../../core/models/payee.model';
import { sameSection } from '../../../shared/components/financial-warnings/limit-headroom';

// Pure helpers for the Payment amount accordion (rows, totals, sections paid,
// deductibles) and for turning URL prefill into reserve rows. No Angular here.

/** Reserves a payment can be made from, in the chosen currency. */
export function payableRows(fo: FinancialOverview | undefined, currency: string): FinancialReserve[] {
  return (fo?.reserves ?? []).filter(r => r.status !== 'Rejected' && r.currency === currency);
}

export const outstanding = (r: FinancialReserve): number => r.reserveValue;

export function totalOf(lines: PaymentLine[]): number {
  return lines.reduce((sum, l) => sum + l.amount, 0);
}

/** Lines the handler actually filled in (amount above zero). */
export function filledLines(rows: FinancialReserve[], amounts: Record<string, number | null | undefined>): PaymentLine[] {
  return rows
    .map(r => ({ reserveId: r.reserveId, amount: Number(amounts[r.reserveId] ?? 0) }))
    .filter(l => l.amount > 0);
}

/** Distinct sections the filled lines draw from (GG books one payment per section). */
export function sectionsPaid(rows: FinancialReserve[], lines: PaymentLine[]): FinancialReserve[] {
  const seen = new Map<string, FinancialReserve>();
  for (const l of lines) {
    const r = rows.find(x => x.reserveId === l.reserveId);
    if (r) seen.set(r.sectionId ?? r.section, seen.get(r.sectionId ?? r.section) ?? r);
  }
  return [...seen.values()];
}

/** Amount per section, for checking each section's own limit. */
export function amountBySection(rows: FinancialReserve[], lines: PaymentLine[]): { section: string; amount: number }[] {
  const out: { section: string; amount: number }[] = [];
  for (const l of lines) {
    const r = rows.find(x => x.reserveId === l.reserveId);
    if (!r) continue;
    const hit = out.find(o => sameSection(o.section, r.section));
    if (hit) hit.amount += l.amount;
    else out.push({ section: r.section, amount: l.amount });
  }
  return out;
}

/** Deductibles that apply to what is being paid: claim level plus each section paid. */
export function applicableDeductibles(all: Deductible[], paid: FinancialReserve[], currency: string): Deductible[] {
  return all.filter(
    d =>
      d.currency === currency &&
      (d.level === 'claim' ||
        paid.some(r => d.sectionName && sameSection(d.sectionName, r.section)))
  );
}

/** Informational total of the fixed-amount deductibles; percentages can't be added up. */
export function fixedDeductibleTotal(ded: Deductible[]): number {
  return ded.filter(d => d.applicationMethod === 'Fixed amount').reduce((s, d) => s + d.amount, 0);
}

export interface RowPrefill {
  /** Section already resolved to a name (the URL carries an id). */
  sectionName?: string | null;
  type?: string | null;
  amount?: number | null;
}

/**
 * URL prefill -> which reserve row gets the amount: the section's rows (by
 * name), then the matching type (Indemnity / Expenses), else the first row.
 */
export function prefillTarget(rows: FinancialReserve[], p: RowPrefill): string | null {
  if (!rows.length || !p.amount) return null;
  const inSection = p.sectionName ? rows.filter(r => sameSection(r.section, p.sectionName!)) : rows;
  const pool = inSection.length ? inSection : rows;
  const wanted = (p.type ?? '').toLowerCase().slice(0, 5);
  const typed = wanted ? pool.filter(r => r.reserveType.toLowerCase().startsWith(wanted)) : [];
  return (typed[0] ?? pool[0]).reserveId;
}

/** Same name ignoring case, apostrophes and punctuation ("Kaufmann's" = "Kaufmann"). */
export const looseName = (s: string): string =>
  s.toLowerCase().replace(/['\u2019]s\b/g, '').replace(/[^a-z0-9]+/g, '');


/** Amounts to put on reserve rows when the page opens (edit mode keeps the payment's own lines). */
export function prefillAmounts(
  rows: FinancialReserve[],
  editing: { lines?: PaymentLine[]; amount: number; sectionType: string } | null,
  p: { sectionName?: string | null; type?: string | null; amount?: number | null }
): Record<string, number> {
  if (editing?.lines?.length) return Object.fromEntries(editing.lines.map(l => [l.reserveId, l.amount]));
  const amount = editing?.amount ?? p.amount ?? null;
  const target = prefillTarget(rows, { sectionName: p.sectionName, type: editing?.sectionType ?? p.type, amount });
  return target && amount ? { [target]: amount } : {};
}
