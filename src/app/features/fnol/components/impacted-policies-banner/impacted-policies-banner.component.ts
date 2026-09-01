import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, Observable, catchError, firstValueFrom, forkJoin, map, of, switchMap } from 'rxjs';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { MockImpactedPoliciesService } from '../../../../core/mock/services/mock-impacted-policies.service';
import { MockEntitiesDamagesService } from '../../../../core/mock/services/mock-entities-damages.service';
import { ImpactedPolicy, AddedPolicyEntities } from '../../../../core/models/impacted-policy.model';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { AddPoliciesModalComponent, AddPoliciesModalData } from '../add-policies-modal/add-policies-modal.component';

/**
 * "Other policies may be impacted" — the banner on Entities & damages.
 *
 * Sits above the entity tree because it explains an absence: the entity the
 * handler is looking for may be insured under a sibling policy, which is why it
 * is not in the list below. Renders nothing at all when there is nothing to
 * offer, so it never becomes furniture the handler learns to ignore.
 */
@Component({
  selector: 'app-impacted-policies-banner',
  standalone: true,
  imports: [CommonModule, NxMessageModule],
  templateUrl: './impacted-policies-banner.component.html',
  styleUrl: './impacted-policies-banner.component.scss',
})
export class ImpactedPoliciesBannerComponent implements OnInit {
  @Input({ required: true }) policyNumber!: string;

  /** Emitted after entities were pulled in — the host must refresh its tree. */
  @Output() policiesAdded = new EventEmitter<AddedPolicyEntities>();

  private readonly impactedSvc = inject(MockImpactedPoliciesService);
  private readonly entitiesSvc = inject(MockEntitiesDamagesService);
  private readonly dialog      = inject(NxDialogService);
  private readonly toast       = inject(ToastService);

  /** Handler dismissed it for this visit — deliberately not persisted. */
  readonly dismissed = signal(false);

  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  policies$!: Observable<ImpactedPolicy[]>;

  ngOnInit(): void {
    this.policies$ = this.refresh$.pipe(
      switchMap(() =>
        this.impactedSvc.getForPolicy(this.policyNumber).pipe(
          catchError(() => of([] as ImpactedPolicy[])),
        ),
      ),
    );
  }

  async openModal(policies: ImpactedPolicy[]): Promise<void> {
    const data: AddPoliciesModalData = { basePolicyNumber: this.policyNumber, policies };
    const ref = this.dialog.open<AddPoliciesModalComponent, AddPoliciesModalData, string[]>(
      AddPoliciesModalComponent,
      { data, width: '900px', maxWidth: '95vw' },
    );
    const chosen = await firstValueFrom(ref.afterClosed());
    if (chosen?.length) await this.addPolicies(chosen);
  }

  private async addPolicies(policyNumbers: string[]): Promise<void> {
    let counts: number[];
    try {
      counts = await firstValueFrom(
        forkJoin(policyNumbers.map(p => this.entitiesSvc.addEntitiesFromPolicy(this.policyNumber, p))),
      );
    } catch {
      this.toast.error('Failed to add policies', 'Please try again.');
      return;
    }
    const entityCount = counts.reduce((a, b) => a + b, 0);

    // Mark added only after the entities actually landed — a failed pull that
    // still hid the policy from the banner would leave the handler with no
    // route back to it.
    this.impactedSvc.markAdded(this.policyNumber, policyNumbers);
    this.refresh$.next();

    const policyLabel = policyNumbers.length === 1 ? 'policy' : 'policies';
    this.toast.success(
      `${policyNumbers.length} ${policyLabel} added`,
      `${entityCount} entities are now available for selection.`,
    );
    this.policiesAdded.emit({ policyNumbers, entityCount });
  }

  policyList(policies: ImpactedPolicy[]): string {
    return policies.map(p => p.policyNumber).join(', ');
  }

  entityTotal(policies: ImpactedPolicy[]): number {
    return policies.reduce((sum, p) => sum + p.availableEntityCount, 0);
  }
}
