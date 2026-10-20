import { Bookable, needsHandler } from '../../core/models/gg-booking.model';

/**
 * Does this row wait for the handler? needsHandler (failed booking they can fix,
 * approver send-back) plus Rejected, which the handler has to close (tell the
 * payee or challenge the approver). One rule for the row marker, the "Needs you"
 * chip, the Financial Overview line and the Recoveries page.
 */
export function needsYou(approvalStatus: string, item: Bookable): boolean {
  return approvalStatus === 'Rejected' || needsHandler(approvalStatus, item);
}
