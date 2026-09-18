export type SectionStatus = 'Open' | 'Closed';
export type InstructionStatus = 'Pending' | 'Not assigned' | 'In progress' | 'Completed';
export type SectionClosureReason = 'Section Finalised' | 'Section Not Pursued' | 'Section Rejected';
export type SectionReopenReason =
  | 'New information received'
  | 'Additional claim activity'
  | 'Reassessment required'
  | 'Error correction'
  | 'Other';
export type CoverageReview =
  | 'Standard Review'
  | 'Additional information required'
  | 'Enhanced review required';

// Originating Loss Location — where the CBI-triggering event actually
// happened (the third party's premises), not the insured's own loss
// location. Field set mirrors the legacy ABS precedent (BR CBI Extension
// location): Country/City/ZIP mandatory, the rest optional. Manual capture
// only — no CWB/GIS lookup in baseline (BMPCC-17927).
export interface CbiOriginatingLocation {
  country: string;
  city: string;
  zip: string;
  street?: string;
  houseNumber?: string;
  landRecordNumber?: string;
  state?: string;
}

// A named third party already captured on this claim's Sections (CBI entities
// only, today) — surfaced read-only on Trade Sanctions so the person
// answering "any sanctions exposure?" can see who is already on file instead
// of screening blind. Name only: CbiOriginatingLocation.country is
// deliberately withheld here too, same as entity-detail-panel's
// showCbiLocation — CBI (BMPCC-17927) is still unsigned-off, and country is
// the one field that hold explicitly covers.
export interface NamedThirdParty {
  name: string;
  sectionName: string;
}

export interface SectionEntity {
  id: string;
  name: string;
  instructionStatus: InstructionStatus;
  expandable: boolean;
  assignedProvider?: string | null;
  coverageReview?: CoverageReview;
  coverageReviewNote?: string;
  coverageReviewOverridden?: boolean;
  // When this entity's loss actually occurred — asked on Add Entity (Marlene
  // feedback, 2026-08-31, replacing instructionStatus there). Entities in the
  // same section can be added at different times / from different events, so
  // this is per-entity, not read from the claim-level dateOfLoss.
  dateOfOccurrence?: string;
  // Business interruption's indemnity period — only meaningful when the
  // owning section's damageType is 'business-interruption'; every other
  // damage type leaves these unset.
  interruptionStartDate?: string;
  interruptionEndDate?: string;
  // CBI (contingent business interruption) — BMPCC-18353. Only meaningful
  // when isContingentBi is true (which itself only applies when the owning
  // section's damageType is 'business-interruption'). Captured at FNOL Loss
  // Information (Trigger Flow, functional design BMPCC-17927), not on Add
  // Entity — case type/location/third-party are answered once the handler
  // ticks Business Interruption and confirms the CBI question, before any
  // entity is even chosen.
  isContingentBi?: boolean;
  cbiCaseType?: string;
  thirdPartyName?: string;
  thirdPartyRelationship?: 'supplier' | 'customer' | 'other';
  cbiOriginatingLocation?: CbiOriginatingLocation;
}

export interface SectionBlockers {
  hasOpenDeductible: boolean;
  hasActiveLitigation: boolean;
  hasSubrogation: boolean;
  hasActiveSalvage: boolean;
  hasOpenReserves: boolean;
  hasOpenPayments: boolean;
  hasActiveProvider: boolean;
}

export interface ClaimSection extends SectionBlockers {
  id: string;
  claimId: string;
  name: string;
  // The coverage type this section represents — one canonical value from
  // lookups.json's typeOfDamage (MockLookupService.getTypeOfDamageSync()),
  // e.g. "material-damage". A section IS an entity x damage-type pairing;
  // this is the damage-type half, shared by every entity underneath it.
  // SectionEntity used to carry its own free-text `damage` — removed as
  // redundant once the section itself owns the type (see CONVERSIONS.md).
  damageType: string;
  status: SectionStatus;
  expanded: boolean;
  entities: SectionEntity[];
  closureDate?: string;
  closedBy?: { userId: string; name: string };
  closureReason?: SectionClosureReason;
  reopenedDate?: string;
  reopenedBy?: { userId: string; name: string };
  reopeningReason?: SectionReopenReason;
}
