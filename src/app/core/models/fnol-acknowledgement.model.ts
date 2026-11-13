// FNOL Acknowledgement (BMPCC-22635, epic BMPCC-22600). After an FNOL is
// registered the handler triggers the letter confirming receipt of the claim;
// AOMS (via Appshell) generates it. Never generated automatically.
//
// DESIGN DECISION FNOL-ACK-1:
// - Placement: the same panel on the FNOL confirmation screen (right under
//   "claim opened") and on Claim Overview (right under General information),
//   so the handler meets one control in one shape in both places.
// - Confirm before generating: the letter takes the claim and policy details
//   as they are at that moment, and "generate" could be read as "send". The
//   confirm says both. Acknowledge after: the panel changes, a toast, and a
//   bell line (generation can finish after the handler has moved on).
// - Not available (button disabled, reason shown as text next to it, not only
//   in a tooltip a keyboard or touch user never sees): an orphan claim waiting
//   for its policy (the letter needs the policy), an abandoned or closed claim.
// - Regenerating is allowed ("Generate again") with its own confirm: details
//   may have been corrected after FNOL. The earlier letter stays on the claim;
//   the panel shows the latest, with when and by whom.

export type FnolAckStatus = 'generating' | 'generated' | 'failed';

/** Claim and policy data the letter was populated with (epic AC2). */
export interface FnolAckLetter {
  claimId: string;
  insured: string;
  policyNumber: string;
  dateOfLoss: string;
  dateReported: string;
  handler: string;
}

export interface FnolAcknowledgement {
  status: FnolAckStatus;
  // How many letters were generated so far (the latest is shown).
  version: number;
  documentName?: string;
  generatedAt?: string;
  generatedBy?: string;
  letter?: FnolAckLetter;
  // A regeneration that is running or failed keeps the last good letter.
  previous?: { documentName: string; generatedAt: string; generatedBy: string; letter?: FnolAckLetter };
  error?: string;
  startedBy?: string;
}

export interface FnolAckAvailability {
  available: boolean;
  reason?: string;
}
