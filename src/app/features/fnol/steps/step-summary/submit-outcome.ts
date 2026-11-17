import { PolicyClaimResult } from '../../../../core/models';
import { creationHeadline } from '../../components/claim-creation-result/claim-creation-result.component';

export interface SubmitOutcome {
  tone: 'success' | 'warning' | 'error';
  title: string;
  description: string;
}

/**
 * The toast after Submit says what the result banner says (BMPCC-22665 AC05 /
 * AC05b wording), failures included, plus who got the claim (BMPCC-22666
 * AC01). Same tone as the banner: success, warning when some failed, error
 * when none was created.
 */
export function submitOutcome(
  results: PolicyClaimResult[],
  claimIds: string[],
  handlerLine: string
): SubmitOutcome {
  const rows: PolicyClaimResult[] = results.length
    ? results
    : claimIds.map(claimId => ({
        policyNumber: '',
        lineOfBusiness: '',
        status: 'created',
        claimId
      }));
  const failed = rows.filter(r => r.status === 'failed').map(r => r.policyNumber);
  const created = rows.filter(r => r.claimId).map(r => r.claimId!);
  const parts = [
    created.length ? `${created.join(', ')}.` : '',
    failed.length ? `Not created on ${failed.join(', ')}. Use Retry on its row.` : '',
    handlerLine
  ];
  return {
    tone: !failed.length ? 'success' : created.length ? 'warning' : 'error',
    // A plain FNOL keeps the wording of its own banner ("1 claim opened", BMPCC-22635).
    title: results.length
      ? creationHeadline(rows)
      : `${created.length} ${created.length === 1 ? 'claim' : 'claims'} opened`,
    description: parts.filter(Boolean).join(' ')
  };
}
