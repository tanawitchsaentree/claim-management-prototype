import { Deductible, PolicyLimit } from '../../../core/models/deductible.model';
import { FinancialOverview } from '../../../core/models/financial-overview.model';
import { ClaimOverview } from '../../../core/models/claim-overview.model';
import { PreCheck, financialPreChecks } from '../../../core/models/financial-precheck.model';
import { PaymentLine, Payee, PaymentMethodOption } from '../../../core/models/payee.model';
import { claimHeadroom } from '../../../shared/components/financial-warnings/limit-headroom';
import { FinancialReserve } from '../../../core/models/financial-overview.model';
import { amountBySection, looseName } from './make-payment-lines';

// The pre-submit check list for the Make payment sheet, as one pure function
// (the page just feeds it what the handler has chosen so far).

export interface CheckContext {
  fo: FinancialOverview | undefined;
  overview: ClaimOverview | undefined;
  limits: PolicyLimit[];
  currency: string;
  premiumMode: 'block' | 'warn';
  payee: Payee | null;
  method: PaymentMethodOption | null;
  bankAccountId: string | null;
  rows: FinancialReserve[];
  lines: PaymentLine[];
  total: number;
  sectionCount: number;
}

export function buildChecks(c: CheckContext): PreCheck[] {
  const account = c.payee?.bankAccounts.find(a => a.accountId === c.bankAccountId);
  // The first section whose own limit is passed, else the whole claim's limit.
  let amount = c.total;
  let head = claimHeadroom(c.fo, c.limits, c.currency);
  for (const g of amountBySection(c.rows, c.lines)) {
    const h = claimHeadroom(c.fo, c.limits, c.currency, g.section);
    if (h && g.amount > h.remaining) {
      amount = g.amount;
      head = h;
      break;
    }
  }
  return financialPreChecks({
    journey: 'payment',
    ggRegistration: c.overview?.ggRegistration,
    ggResendInFlight: c.overview?.ggResendInFlight,
    premiumOutstanding: c.overview?.premiumOutstanding,
    premiumMode: c.premiumMode,
    currency: c.currency,
    reserveCurrencies: [...new Set((c.fo?.reserves ?? []).filter(r => r.status !== 'Rejected').map(r => r.currency))],
    amount: amount || undefined,
    limitRemaining: head?.remaining,
    limitName: head?.name,
    payee: c.payee ? { name: c.payee.name, clearance: c.payee.clearance, ggNameCode: c.payee.ggNameCode } : undefined,
    bankAccountOperational: c.method?.needsBankAccount && account ? account.operational : undefined,
    sectionCount: c.sectionCount,
    overReserveLines: c.lines
      .map(l => ({ reserveId: l.reserveId, amount: l.amount, outstanding: c.rows.find(r => r.reserveId === l.reserveId)?.reserveValue ?? 0 }))
      .filter(l => l.amount > l.outstanding)
  });
}

export interface FormValues {
  payeeId: string | null;
  beneficiary: 'same' | 'different';
  beneficiaryName: string;
  confirmEmail: boolean;
  emailAddress: string;
  method: string | null;
  bankAccountId: string | null;
  paymentDate: Date | null;
}

/** Fields still empty; the sheet shows them only after the first attempt to submit. */
export function missingFields(
  v: FormValues,
  method: PaymentMethodOption | null,
  lineCount: number,
  // Changing an older payment whose payee isn't in the payee list: it keeps its own payee and account.
  keepsOwnPayee = false
): string[] {
  const out: string[] = [];
  if (!v.payeeId && !keepsOwnPayee) out.push('payeeId');
  if (v.beneficiary === 'different' && !v.beneficiaryName.trim()) out.push('beneficiaryName');
  if (v.confirmEmail && !v.emailAddress.trim()) out.push('emailAddress');
  if (!v.method) out.push('method');
  if (method?.needsBankAccount && !v.bankAccountId && !keepsOwnPayee) out.push('bankAccountId');
  if (!v.paymentDate) out.push('paymentDate');
  if (lineCount === 0) out.push('lines');
  return out;
}

/** Payee by id, or by name ignoring case, apostrophes and punctuation. */
export function findPayee(payees: Payee[], ref: string | null | undefined): Payee | undefined {
  if (!ref) return undefined;
  const loose = looseName(ref);
  return payees.find(p => p.payeeId === ref || looseName(p.name) === loose || looseName(p.name).includes(loose));
}

export type { Deductible };
