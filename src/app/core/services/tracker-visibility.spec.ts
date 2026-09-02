import { HIDE_OWNER_FILTER, isOwnerAssignee } from './tracker-visibility';

describe('tracker visibility', () => {
  describe('isOwnerAssignee', () => {
    it('matches the owner as Jira actually spells the name', () => {
      expect(isOwnerAssignee('Costigan, Ruby Isabelle (Allianz Services GmbH)')).toBe(true);
    });

    it('matches regardless of case', () => {
      expect(isOwnerAssignee('ISABELLE')).toBe(true);
      expect(isOwnerAssignee('isabelle')).toBe(true);
    });

    it('does not match anyone else', () => {
      expect(isOwnerAssignee('Agarwal, Vasudha (Allianz Technology SE)')).toBe(false);
      expect(isOwnerAssignee('Nat')).toBe(false);
    });

    it('treats an unassigned ticket as not the owner', () => {
      expect(isOwnerAssignee(null)).toBe(false);
      expect(isOwnerAssignee(undefined)).toBe(false);
      expect(isOwnerAssignee('')).toBe(false);
    });
  });

  describe('HIDE_OWNER_FILTER', () => {
    // The regression this guards: `NULL ILIKE '%isabelle%'` is NULL and NOT NULL
    // is still NULL, so without the is.null arm PostgREST drops every unassigned
    // ticket too — 57 active rows came back as 45 instead of 51.
    it('keeps unassigned tickets by testing for null explicitly', () => {
      expect(HIDE_OWNER_FILTER).toContain('assignee.is.null');
    });

    it('negates an ilike match on the owner', () => {
      expect(HIDE_OWNER_FILTER).toContain('assignee.not.ilike.*isabelle*');
    });

    // PostgREST reads * as the LIKE wildcard; a literal % would have to survive
    // URL encoding in the or= parameter.
    it('uses * rather than % as the wildcard', () => {
      expect(HIDE_OWNER_FILTER).not.toContain('%');
    });
  });
});
