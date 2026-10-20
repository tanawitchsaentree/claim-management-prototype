// GG booking ticket (gg-booking-states.json) mutation entities. Kept out of
// mock-state.service.ts, which is already over the 300-line limit.
// Mirrored in scripts/audit-ac-logic.mjs simulateState().

import { Task } from '../../models/task.model';
import {
  FinancialOverview,
  FinancialPayment,
  FinancialRecovery,
  FinancialReserve
} from '../../models/financial-overview.model';

export interface FinancialPatchOverride {
  claimId: string;
  // Partial merge into existing rows, keyed by paymentId / reserveId / recoveryId.
  payments?: Record<string, Partial<FinancialPayment>>;
  reserves?: Record<string, Partial<FinancialReserve>>;
  recoveries?: Record<string, Partial<FinancialRecovery>>;
  // Extra rows so one list can show every status at once (dedupe by id).
  paymentsAppend?: FinancialPayment[];
}

function mergeById<T>(rows: T[], key: keyof T, patch?: Record<string, Partial<T>>): T[] {
  if (!patch) return rows;
  return rows.map(r => {
    const p = patch[String(r[key])];
    return p ? { ...r, ...p } : r;
  });
}

export function applyFinancialPatch(
  overviews: Record<string, FinancialOverview>,
  fp: FinancialPatchOverride
): Record<string, FinancialOverview> {
  const existing = overviews[fp.claimId];
  if (!existing) return overviews;
  const known = new Set(existing.payments.map(p => p.paymentId));
  const appended = (fp.paymentsAppend ?? []).filter(p => !known.has(p.paymentId));
  return {
    ...overviews,
    [fp.claimId]: {
      ...existing,
      payments: [...mergeById(existing.payments, 'paymentId', fp.payments), ...appended],
      reserves: mergeById(existing.reserves, 'reserveId', fp.reserves),
      recoveries: mergeById(existing.recoveries, 'recoveryId', fp.recoveries)
    }
  };
}

export function appendTasks(tasks: Task[], incoming?: Task[]): Task[] {
  if (!incoming?.length) return tasks;
  const known = new Set(tasks.map(t => t.taskId));
  return [...tasks, ...incoming.filter(t => !known.has(t.taskId))];
}
