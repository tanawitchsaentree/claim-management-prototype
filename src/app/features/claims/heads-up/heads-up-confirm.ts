import { ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

// Wording of the Heads-Up confirm steps (every save is confirmed first, then
// acknowledged with a toast). Submit says plainly that it locks the form
// (DESIGN DECISION HU-1 Q3), so "Submit" can't be read as "save for later".

export function confirmSave(mode: 'draft' | 'submit', claimId: string): ConfirmDialogData {
  if (mode === 'draft') {
    return {
      title: 'Save this Heads-Up as a draft?',
      message: `It stays a draft on ${claimId} and is not sent to Key Case Management until you submit it.`,
      confirmLabel: 'Save draft',
      hideIcon: true
    };
  }
  return {
    title: 'Submit this Heads-Up to Key Case Management?',
    message:
      "Key Case Management gets it straight away. After you submit, it can't be changed here: send any later news to Key Case Management.",
    confirmLabel: 'Submit Heads-Up',
    cancelLabel: 'Keep editing'
  };
}

export function confirmLeave(): ConfirmDialogData {
  return {
    title: 'Leave without saving?',
    message: 'Changes since you last saved this Heads-Up will be lost.',
    confirmLabel: 'Leave without saving',
    cancelLabel: 'Keep editing',
    confirmDanger: true
  };
}
