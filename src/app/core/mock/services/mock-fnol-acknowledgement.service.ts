import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MockStateService } from '../state/mock-state.service';
import { MockClaimOverviewService } from './mock-claim-overview.service';
import { MockNotificationService } from './mock-notification.service';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { ClaimOverview } from '../../models/claim-overview.model';
import {
  FnolAckAvailability,
  FnolAckLetter,
  FnolAcknowledgement
} from '../../models/fnol-acknowledgement.model';

// BMPCC-22635: mock of "Appshell asks AOMS to generate the FNOL
// Acknowledgement". The answer comes back after AOMS_MS; the outcome is preset
// by the DEV banner (ClaimOverview.fnolAckDemoOutcome: 'fails' fails once).
// State lives on the claim's overview record, so it survives a reload and the
// Claim Overview reload, and the FNOL screen and Claim Overview show the same.
// See DESIGN DECISION FNOL-ACK-1 in fnol-acknowledgement.model.ts.

const AOMS_MS = 3000;

@Injectable({ providedIn: 'root' })
export class MockFnolAcknowledgementService {
  private readonly stateSvc = inject(MockStateService);
  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly notifySvc = inject(MockNotificationService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  // Claims whose AOMS answer is already scheduled in this session.
  private readonly running = new Set<string>();

  /**
   * A claim shows "generating" but nothing here is waiting for the answer
   * (page reloaded mid-way, or the DEV banner set the state): schedule it.
   */
  ensureRunning(claimId: string): void {
    if (this.stateSvc.state().overviews[claimId]?.fnolAck?.status === 'generating') this.schedule(claimId);
  }

  availability(claim: ClaimOverview | undefined): FnolAckAvailability {
    if (!claim) return { available: true };
    if (claim.skeletonState === 'awaiting-policy') {
      return { available: false, reason: 'Link a policy first: the letter needs the policy details.' };
    }
    if (claim.skeletonState === 'abandoned') return { available: false, reason: 'This claim was abandoned.' };
    if (claim.status === 'Closed') return { available: false, reason: 'The claim is closed.' };
    return { available: true };
  }

  async generate(claimId: string): Promise<void> {
    // A claim just registered in FNOL may not have its overview record yet.
    await firstValueFrom(this.overviewSvc.getOverview(claimId));
    const claim = this.stateSvc.state().overviews[claimId];
    if (!claim || claim.fnolAck?.status === 'generating') return;
    const cur = claim.fnolAck;
    const previous =
      cur?.status === 'generated' && cur.documentName && cur.generatedAt && cur.generatedBy
        ? { documentName: cur.documentName, generatedAt: cur.generatedAt, generatedBy: cur.generatedBy, letter: cur.letter }
        : cur?.previous;
    const next: FnolAcknowledgement = {
      status: 'generating',
      version: cur?.status === 'generated' ? cur.version + 1 : (cur?.version ?? 1),
      previous,
      startedBy: this.auth.user().name
    };
    this.stateSvc.patchOverview(claimId, { fnolAck: next });
    this.schedule(claimId);
  }

  private schedule(claimId: string): void {
    if (this.running.has(claimId)) return;
    this.running.add(claimId);
    setTimeout(() => {
      this.running.delete(claimId);
      this.resolve(claimId);
    }, AOMS_MS);
  }

  private resolve(claimId: string): void {
    const claim = this.stateSvc.state().overviews[claimId];
    const cur = claim?.fnolAck;
    if (!claim || cur?.status !== 'generating') return;
    if (claim.fnolAckDemoOutcome === 'fails') {
      this.stateSvc.patchOverview(claimId, {
        // Fails once, so Try again then works.
        fnolAckDemoOutcome: undefined,
        fnolAck: { ...cur, status: 'failed', error: "The document service didn't answer in time. No letter was made." }
      });
      this.toast.error("FNOL acknowledgement couldn't be generated", `${claimId}: you can try again.`);
      return;
    }
    const documentName = `FNOL acknowledgement ${claimId}${cur.version > 1 ? ' v' + cur.version : ''}.pdf`;
    this.stateSvc.patchOverview(claimId, {
      fnolAck: {
        ...cur,
        status: 'generated',
        documentName,
        generatedAt: new Date().toISOString(),
        generatedBy: cur.startedBy ?? this.auth.user().name,
        letter: this.letterFor(claim),
        error: undefined
      }
    });
    this.toast.success('FNOL acknowledgement is ready', `${claimId}: the letter is ready to open.`);
    this.notifySvc.push({
      id: `fnol-ack-${claimId}`,
      claimId,
      tone: 'done',
      title: `${claimId}: the FNOL acknowledgement is ready to open`,
      link: ['/claims', claimId, 'overview']
    });
  }

  private letterFor(c: ClaimOverview): FnolAckLetter {
    return {
      claimId: c.claimId,
      insured: c.policyHolder || c.client,
      policyNumber: c.policyNumber,
      dateOfLoss: c.dateOfLoss,
      dateReported: c.dateReported ?? c.dateCreated,
      handler: c.assignedHandler
    };
  }
}
