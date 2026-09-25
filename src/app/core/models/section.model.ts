import type { LocationItem } from './location-picker.model';

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

// A named third party already captured on this claim's Sections (CBI entities
// only, today) — surfaced read-only on Trade Sanctions so the person
// answering "any sanctions exposure?" can see who is already on file instead
// of screening blind. Name only — location/industry stay off this summary,
// same as entity-detail-panel's showCbiLocation — CBI (BMPCC-17927) is still
// unsigned-off.
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
  // Supplier/customer industry — net-new per the CBI FD's "category-specific
  // fields" table (11 Sep 2026 meeting, Sarah/Marlene/Joerg). Only meaningful
  // for the Supplier/Customer category (thirdPartyRelationship 'supplier' |
  // 'customer'), same gating as thirdPartyName.
  thirdPartyIndustry?: string;
  // Originating loss location — where the CBI-triggering event actually
  // happened (the third party's premises), not the insured's own loss
  // location. `cbiOriginatingLocation` is the display string (kept for
  // every existing string-only reader — entity-detail-panel, claim-overview);
  // `cbiOriginatingLocationDetail` is the structured pick behind it (same
  // LocationItem shape lossLocation itself uses) so re-opening the picker
  // to edit starts from the actual chosen address, not a re-parsed string.
  cbiOriginatingLocation?: string;
  cbiOriginatingLocationDetail?: LocationItem;
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
