import { NxDialogService } from '@allianz/ng-aquila/modal';
import { firstValueFrom } from 'rxjs';
import {
  ReasonDialogComponent,
  ReasonDialogData
} from '../../shared/components/reason-dialog/reason-dialog.component';
import { RejectionApproval } from '../../core/models/approval.model';

async function ask(dialogSvc: NxDialogService, data: ReasonDialogData): Promise<string | undefined> {
  const ref = dialogSvc.open(ReasonDialogComponent, { data, width: '560px', maxWidth: '92vw' });
  return (await firstValueFrom(ref.afterClosed())) as string | undefined;
}

/**
 * A request asks to reject a claim. The two answers use the ticket's words
 * (BMPCC-17630): Approve closes the claim as Claim Rejected, Decline leaves it
 * open. Both need the approver's reason. Each resolves with the trimmed text,
 * or undefined when the approver cancels.
 */
export function askApproveReason(dialogSvc: NxDialogService, item: RejectionApproval) {
  return ask(dialogSvc, {
    title: 'Approve rejection',
    message: `Approving closes ${item.claimId} as Claim Rejected.`,
    reasonLabel: 'Reason for approving',
    confirmLabel: 'Approve',
    handlerReason: item.rejectionReason
  });
}

export function askDeclineReason(dialogSvc: NxDialogService, item: RejectionApproval) {
  return ask(dialogSvc, {
    title: 'Decline rejection',
    message: `Declining keeps ${item.claimId} open. The claims handler will see your reason.`,
    reasonLabel: 'Reason for declining',
    confirmLabel: 'Decline',
    handlerReason: item.rejectionReason
  });
}
