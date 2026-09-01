import { PolicyStatus } from './policy.model';

/**
 * A policy that is NOT on the claim yet, but whose entities may belong on it.
 *
 * The problem this solves: a handler picks one policy in FNOL, and Entities &
 * damages then only offers that policy's entities. When the damaged thing is
 * insured under a *sibling* policy of the same risk, the handler has no way to
 * reach it — the entity simply isn't in the list, with nothing on screen saying
 * why. Surfacing the other policies, and letting the handler pull them in, is
 * what makes those entities selectable.
 */
export interface ImpactedPolicy {
  policyNumber:   string;
  clientName:     string;
  lineOfBusiness: string;
  effectiveDate:  string;
  expiryDate:     string;
  status:         PolicyStatus;
  /**
   * Why this policy surfaced. Authored per base policy in
   * `mock/data/impacted-policies.json`, NOT derived: the entity model carries
   * no site/address fields, so there is nothing in the data to match on. Real
   * matching happens in the policy system upstream of this screen.
   */
  matchReason: string;
  /** Entities on this policy that would become selectable once it is added. */
  availableEntityCount: number;
}

/** Result of pulling one or more impacted policies onto the claim. */
export interface AddedPolicyEntities {
  policyNumbers: string[];
  entityCount:   number;
}
