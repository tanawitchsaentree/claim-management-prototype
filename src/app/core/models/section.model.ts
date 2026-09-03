export type SectionStatus        = 'Open' | 'Closed';
export type InstructionStatus    = 'Pending' | 'Not assigned' | 'In progress' | 'Completed';
export type SectionClosureReason = 'Section Finalised' | 'Section Not Pursued' | 'Section Rejected';
export type SectionReopenReason  = 'New information received' | 'Additional claim activity' | 'Reassessment required' | 'Error correction' | 'Other';
export type CoverageReview       = 'Standard Review' | 'Additional information required' | 'Enhanced review required';

export interface SectionEntity {
  id:                       string;
  name:                     string;
  instructionStatus:        InstructionStatus;
  expandable:               boolean;
  assignedProvider?:        string | null;
  coverageReview?:          CoverageReview;
  coverageReviewNote?:      string;
  coverageReviewOverridden?: boolean;
  // When this entity's loss actually occurred — asked on Add Entity (Marlene
  // feedback, 2026-08-31, replacing instructionStatus there). Entities in the
  // same section can be added at different times / from different events, so
  // this is per-entity, not read from the claim-level dateOfLoss.
  dateOfOccurrence?:       string;
  // Business interruption's indemnity period — only meaningful when the
  // owning section's damageType is 'business-interruption'; every other
  // damage type leaves these unset.
  interruptionStartDate?:  string;
  interruptionEndDate?:    string;
  // CBI (contingent business interruption) — pilot fields for BMPCC-18353's
  // open design question. Only meaningful when isContingentBi is true (which
  // itself only applies when the owning section's damageType is
  // 'business-interruption'). Captures the third party whose own premises/
  // service actually suffered the loss, not the insured's.
  isContingentBi?:         boolean;
  cbiCaseType?:            string;
  thirdPartyName?:         string;
  thirdPartyRelationship?: 'supplier' | 'customer' | 'other';
}

export interface SectionBlockers {
  hasOpenDeductible:  boolean;
  hasActiveLitigation: boolean;
  hasSubrogation:     boolean;
  hasActiveSalvage:   boolean;
  hasOpenReserves:    boolean;
  hasOpenPayments:    boolean;
  hasActiveProvider:  boolean;
}

export interface ClaimSection extends SectionBlockers {
  id:             string;
  claimId:        string;
  name:           string;
  // The coverage type this section represents — one canonical value from
  // lookups.json's typeOfDamage (MockLookupService.getTypeOfDamageSync()),
  // e.g. "material-damage". A section IS an entity x damage-type pairing;
  // this is the damage-type half, shared by every entity underneath it.
  // SectionEntity used to carry its own free-text `damage` — removed as
  // redundant once the section itself owns the type (see CONVERSIONS.md).
  damageType:     string;
  status:         SectionStatus;
  expanded:       boolean;
  entities:       SectionEntity[];
  closureDate?:    string;
  closedBy?:       { userId: string; name: string };
  closureReason?:  SectionClosureReason;
  reopenedDate?:   string;
  reopenedBy?:     { userId: string; name: string };
  reopeningReason?: SectionReopenReason;
}
