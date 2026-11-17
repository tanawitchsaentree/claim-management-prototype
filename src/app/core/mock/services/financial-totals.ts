import {
  FinancialDetails,
  FinancialOverview,
  FinancialSummary,
  FinancialTransaction
} from '../../models/financial-overview.model';

/**
 * One source for every number on Financial Overview (audit 2026-11-17, F-01).
 *
 * The summary tiles, Financial details and Transaction summary used to be three
 * separately stored copies: CLM-2024-001's tiles said Incurred 125,000 while its
 * transaction rows ran to 10,240,000, and a new reserve moved Outstanding but
 * not Incurred. All three are now worked out from the payment, reserve and
 * recovery lists on every read, with the same rules
 * scripts/seed-financial-overview.mjs `summarize()` uses to seed them:
 *   Outstanding = reserves not Rejected, Completed = Done + Credit payments,
 *   Pending = Pending payments, Recoveries = Approved recovery bookings,
 *   Incurred = Outstanding + Completed.
 * The transaction rows are exactly the movements counted in the tiles, oldest
 * first, so the last row's running Total incurred equals the Incurred tile.
 */
export function withDerivedTotals(o: FinancialOverview): FinancialOverview {
  const cur = o.details.currency;
  const own = (r: { currency: string }): boolean => r.currency === cur;
  const reserves = o.reserves.filter(r => own(r) && r.status !== 'Rejected');
  const completed = o.payments.filter(
    p => own(p) && (p.status === 'Done' || p.status === 'Credit')
  );
  const total = <T>(rows: T[], f: (r: T) => number): number => rows.reduce((t, r) => t + f(r), 0);

  const outstandingReserves = total(reserves, r => r.reserveValue);
  const completedPayments = total(completed, p => p.amount);
  const summary: FinancialSummary = {
    outstandingReserves,
    completedPayments,
    pendingPayments: total(
      o.payments.filter(p => own(p) && p.status === 'Pending'),
      p => p.amount
    ),
    recoveries: total(
      o.recoveries.filter(r => own(r) && r.status === 'Approved'),
      r => r.amount
    ),
    incurred: outstandingReserves + completedPayments
  };

  // Same gross / net split the seed writes (no real reinsurance data in the prototype).
  const detail = (label: string, gross: number) => ({
    label,
    gross,
    grossNet: Math.round(gross * 0.9),
    net: Math.round(gross * 0.85)
  });
  const details: FinancialDetails = {
    ...o.details,
    rows: [
      detail('Insured', summary.incurred),
      detail('Reserve', summary.outstandingReserves),
      detail('Payments', summary.completedPayments),
      detail('Recoveries', summary.recoveries)
    ]
  };

  const fx = `${cur}/${cur} × 1.00`;
  const moves = [
    ...completed.map(p => ({
      date: p.paymentDate,
      description: `Payment: ${p.payee}, ${fx}`,
      type: p.sectionType,
      payment: p.amount,
      reserve: 0,
      recovered: 0
    })),
    ...reserves
      .filter(r => r.reserveValue > 0)
      .map(r => ({
        date: (r as { history?: { date: string }[] }).history?.[0]?.date ?? '',
        description: `Reserve: ${r.reserveSubType}, ${fx}`,
        type: r.reserveType,
        payment: 0,
        reserve: r.reserveValue,
        recovered: 0
      })),
    // Money back fills "Total recoveries received" (= the Recoveries tile). Incurred
    // stays gross of recoveries, as the Incurred tile is, so it does not change the run.
    ...o.recoveries
      .filter(r => own(r) && r.status === 'Approved')
      .map(r => ({
        date: r.bookingDate,
        description: `Recovery: ${r.party}, ${fx}`,
        type: '',
        payment: 0,
        reserve: 0,
        recovered: r.amount
      }))
  ].sort((a, b) => sortKey(a.date).localeCompare(sortKey(b.date)));

  let run = 0;
  const transactions: FinancialTransaction[] = moves.map((m, i) => {
    run += m.payment + m.reserve;
    const indemnity = m.type.startsWith('Indemnity');
    return {
      transactionId: `T-${String(i + 1).padStart(3, '0')}`,
      date: m.date,
      description: m.description,
      indemnityPayment: indemnity ? m.payment : 0,
      expensePayment: indemnity ? 0 : m.payment,
      totalPayment: m.payment,
      // Shown as Ind. reserve / Exp. reserve / Total reserve (model names predate the columns).
      indemnityRecovery: indemnity ? m.reserve : 0,
      expenseRecovery: indemnity ? 0 : m.reserve,
      totalRecovery: m.reserve,
      recoveries: m.recovered,
      totalIncurred: run
    };
  });

  return { ...o, summary, details, transactions };
}

/** dd-MM-yyyy (or dd.MM.yyyy) to yyyyMMdd so rows sort oldest first. */
function sortKey(date: string): string {
  const [d, m, y] = date.split(/[-.]/);
  return y && m && d ? `${y}${m}${d}` : date;
}
