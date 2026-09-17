import { MassEventLinkStatus } from './claim.model';

export interface AccessListEntry {
  userId: string;
  name: string;
  role: string;
  email?: string;
  addedAt: string;
}

export interface FileRestriction {
  isRestricted: boolean;
  reason?: string;
  restrictedBy?: { userId: string; name: string };
  restrictedAt?: string;
  accessList: AccessListEntry[];
}

export const RESTRICTION_REASONS = [
  'VIP client',
  'Legal hold',
  'Sensitive data',
  'Regulatory investigation',
  'Other'
] as const;

export type RestrictionReason = (typeof RESTRICTION_REASONS)[number];

// Trade Sanctions Check — BMPCC-18822/BMPCC-17242. Capture-and-audit only:
// records that a screening was determined/performed and its outcome:
// determination itself happens externally via ESRA, this claim never calls
// it. Claim-level, not per-party (functional design BMPCC-17242).
export interface TradeSanctionsCheck {
  exposure: 'yes' | 'no';
  // Only meaningful when exposure = 'yes'.
  referralApplicable?: boolean;
  esraCompletionDate?: string | null;
  // Open Point #5 (functional design): stays editable even when
  // referralApplicable = No in the reviewed Figma draft — this build
  // disables it instead, since an approval on a referral that was never
  // applicable is a contradiction the form shouldn't allow.
  referralApproved?: boolean;
  esraId?: string;
  comments?: string;
  updatedBy?: { userId: string; name: string };
  updatedAt?: string;
}

export interface ClaimFinancialSummary {
  currency: string;
  totalReserve: number;
  totalPayments: number;
  totalRecoveries: number;
  outstanding: number;
}

export interface ClaimLocation {
  street: string;
  city: string;
  country: string;
}

export interface ClaimOverview {
  claimId: string;
  client: string;
  assignedHandler: string;
  lossEventId?: string;
  status: string;
  // Single "headline" cause for compact summaries (Overview grid, preview
  // popover) — legitimately singular, matches insurance usage of "proximate
  // cause." Full multi-cause detail lives in causeOfLoss below; this is a
  // deliberate summary field, not a truncation of it.
  proximateLossCause: string;
  // Every cause captured at FNOL (LossInformation.causeOfLoss is an array).
  // Optional — older/hand-seeded overviews only have proximateLossCause.
  causeOfLoss?: string[];
  // BMPCC-18160 — the incident circumstance key (not the label), one per claim,
  // filtered by the confirmed peril at FNOL. Read-only everywhere outside the
  // FNOL field and the Edit claim screen; resolve with circumstanceLabel().
  //
  // ASSUMPTION [CIRC-4]: claim-level, not section-level. KR1.2 says "select
  // ONE" and FNOL asks once, but BMPCC-18157 publishes circumstance on
  // claimSectionCreated/Updated, which hints the real model may hang it off the
  // section. Sections display the claim's value rather than storing their own,
  // so moving to per-section later is an additive change, not a migration.
  incidentCircumstance?: string;
  riskScore: number;
  riskScoreMax: number;
  riskStatus: string;
  policyNumber: string;
  // BMPCC-15828 — which version of the policy this claim is linked to, and
  // (when the claim's own policy is itself a later version) the original/
  // base policy it was renewed or endorsed from. Optional — most seed claims
  // predate this and only carry policyNumber with no version concept.
  policyVersion?: number;
  basedOnPolicyNumber?: string;
  policyHolder: string;
  broker?: string;
  clientContact?: string;
  handler: string;
  supervisor: string;
  priority: 'high' | 'medium' | 'low';
  lineOfBusiness: string;
  dateOfLoss: string;
  dateReported?: string;
  dateCreated: string;
  description: string;
  location: ClaimLocation;
  financialSummary: ClaimFinancialSummary;

  // Closure metadata
  closureDate?: string;
  closedBy?: { userId: string; name: string };
  closureReason?: 'Claim Finalised' | 'Claim Not Pursued' | 'Claim Rejected';
  retentionDate?: string;
  retentionType?: 'default' | 'custom' | 'indefinite';

  // Reopen metadata
  reopenedDate?: string;
  reopenedBy?: { userId: string; name: string };
  reopeningReason?: string;

  // Mass Event link
  massEventId?: string;
  massEventLinkStatus?: MassEventLinkStatus;
  massEventLinkedBy?: { userId: string; name: string; at: string };
  massEventOverriddenBy?: { userId: string; name: string; at: string };

  // Historical fact that this claim originated as an orphan/skeleton claim —
  // kept even after it's converted (status moves off 'Awaiting policy') so
  // Overview can show the "needs setup" banner. Never cleared.
  claimType?: 'skeleton';

  // File restriction (BMPCC-10994) — informational only, no enforcement
  restriction?: FileRestriction;

  // Trade Sanctions Check (BMPCC-18822/BMPCC-17242) — editable post-creation,
  // same lifecycle shape as recoveryPotential above.
  tradeSanctions?: TradeSanctionsCheck | null;

  // Recovery Potential flag — captured during FNOL, editable post-creation
  recoveryPotential?: 'yes' | 'no' | null;
  recoveryPotentialNote?: string; // required rationale when recoveryPotential is 'no'

  // Closure blockers (BMPCC-11360 AC2). Mock flags driven by dev-banner ACs.
  hasOpenPayments?: boolean;
  hasOpenReserves?: boolean;
  /** A recovery case exists in the recovery domain, resolved or not (BMPCC-17779 phase B). */
  hasRecoveryCase?: boolean;
  /** At least one recovery case is still Draft/In progress. Derived by MockRecoveryService. */
  hasActiveRecovery?: boolean;
  hasOpenDeductible?: boolean;
  hasActiveLitigation?: boolean;
  hasActiveProvider?: boolean;
  hasUnpaidBills?: boolean;
  hasIncompleteReports?: boolean;
}

export interface ClaimActivity {
  id: string;
  claimId: string;
  user: string;
  timestamp: string;
  objectType: string;
  attribute: string;
  valueOld: string | null;
  valueNew: string | null;
}

export interface ClaimOverviewViewModel {
  claim: ClaimOverview;
  activities: ClaimActivity[];
  activitiesExpanded: boolean;
}
