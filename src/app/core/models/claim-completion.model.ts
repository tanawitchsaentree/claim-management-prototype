/** What the toast says after Link policy: which follow-up tasks landed in the handler's queue. */
export function linkedMessage(policyNumber: string, locationTask: boolean): string {
  return locationTask
    ? `Policy ${policyNumber} linked. Follow-up tasks to set up reserves and re-confirm the loss location were added to your task list.`
    : `Policy ${policyNumber} linked. A follow-up task to set up reserves was added to your task list.`;
}
