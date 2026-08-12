import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxModalModule, NxDialogService } from '@allianz/ng-aquila/modal';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ClaimOverview, ClaimActivity } from '../../../core/models/claim-overview.model';
import {
  EditClaimConfirmModalComponent,
  EditClaimConfirmModalData,
  EditClaimDiffField,
} from './edit-claim-confirm-modal.component';
import { EditClaimDiscardModalComponent } from './edit-claim-discard-modal.component';

@Component({
  selector: 'app-edit-claim',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    NxButtonModule, NxFormfieldModule, NxInputModule, NxDropdownModule,
    NxMessageModule, NxModalModule, NxSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './edit-claim.component.html',
  styleUrl: './edit-claim.component.scss',
})
export class EditClaimComponent implements OnInit {
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);
  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly lookupSvc   = inject(MockLookupService);
  private readonly dialogSvc   = inject(NxDialogService);
  private readonly toast       = inject(ToastService);

  readonly claimId     = signal<string>('');
  readonly loading     = signal(true);
  readonly saving      = signal(false);
  readonly saveSuccess = signal(false);
  readonly original    = signal<ClaimOverview | null>(null);
  readonly maxDesc      = 500;

  // ── Own FormGroup — general/administrative fields only. Loss information,
  // Financials, Litigation, Risk, Sections, Recovery Potential, Mass Event,
  // File restriction, and Closure/Reopen each have their own dedicated,
  // governed edit flow and are intentionally excluded here.
  readonly form = new FormGroup({
    client:          new FormControl('', [Validators.required]),
    clientContact:   new FormControl(''),
    broker:          new FormControl(''),
    assignedHandler: new FormControl('', [Validators.required]),
    priority:        new FormControl<'high' | 'medium' | 'low' | null>(null, [Validators.required]),
    lineOfBusiness:  new FormControl('', [Validators.required]),
    description:     new FormControl('', [Validators.required, Validators.maxLength(500)]),
  });

  readonly priorityOptions$       = this.lookupSvc.getPriorities();
  readonly lineOfBusinessOptions$ = this.lookupSvc.getLinesOfBusiness();
  readonly priorityOptions        = toSignal(this.priorityOptions$,       { initialValue: [] });
  readonly lineOfBusinessOptions  = toSignal(this.lineOfBusinessOptions$, { initialValue: [] });

  readonly isDirty = toSignal(this.form.valueChanges.pipe(map(() => this.form.dirty)), { initialValue: false });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.claimId.set(id);

    firstValueFrom(this.overviewSvc.getOverview(id)).then(claim => {
      this.loading.set(false);
      if (claim) {
        this.original.set(claim);
        this.prefillForm(claim);
      }
    });
  }

  private prefillForm(claim: ClaimOverview): void {
    this.form.patchValue({
      client:          claim.client          ?? '',
      clientContact:   claim.clientContact   ?? '',
      broker:          claim.broker          ?? '',
      assignedHandler: claim.assignedHandler ?? '',
      priority:        claim.priority        ?? null,
      lineOfBusiness:  claim.lineOfBusiness  ?? '',
      description:     claim.description     ?? '',
    });
    this.form.markAsPristine();
  }

  private computeDiffs(): EditClaimDiffField[] {
    const orig = this.original();
    if (!orig) return [];
    const cur = this.form.getRawValue();
    const diffs: EditClaimDiffField[] = [];

    const addIf = (label: string, o: unknown, n: unknown) => {
      const os = o == null ? '' : String(o);
      const ns = n == null ? '' : String(n);
      if (os !== ns) diffs.push({ label, original: os, updated: ns });
    };

    addIf('Client',                 orig.client,          cur.client);
    addIf('Client contact',         orig.clientContact,   cur.clientContact);
    addIf('Broker',                 orig.broker,          cur.broker);
    addIf('Assigned Claim handler', orig.assignedHandler, cur.assignedHandler);
    addIf('Priority',               orig.priority,        cur.priority);
    addIf('Line of business',       orig.lineOfBusiness,  cur.lineOfBusiness);
    addIf('Description',            orig.description,     cur.description);

    return diffs;
  }

  async onSaveChanges(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const diffs = this.computeDiffs();
    const data: EditClaimConfirmModalData = { claimId: this.claimId(), diffs };
    const ref = this.dialogSvc.open(EditClaimConfirmModalComponent, { data, width: '600px', maxWidth: '92vw' });
    const result = await firstValueFrom(ref.afterClosed());
    if (result !== 'confirmed') return;

    this.saveSuccess.set(false);
    this.saving.set(true);
    const formValue = this.form.getRawValue();
    try {
      await firstValueFrom(this.overviewSvc.updateGeneralInfo(this.claimId(), {
        client:          formValue.client ?? '',
        clientContact:   formValue.clientContact ?? undefined,
        broker:          formValue.broker ?? undefined,
        assignedHandler: formValue.assignedHandler ?? '',
        priority:        formValue.priority ?? 'medium',
        lineOfBusiness:  formValue.lineOfBusiness ?? '',
        description:     formValue.description ?? '',
      }));

      const activities: ClaimActivity[] = diffs.map((d, i) => ({
        id:         `act-edit-claim-${Date.now()}-${i}`,
        claimId:    this.claimId(),
        user:       'Current User',
        timestamp:  new Date().toISOString(),
        objectType: 'Claim',
        attribute:  d.label,
        valueOld:   d.original || null,
        valueNew:   d.updated  || null,
      }));

      if (activities.length) {
        this.overviewSvc.appendActivities(this.claimId(), activities);
      }

      this.form.markAsPristine();
      this.saveSuccess.set(true);
      this.toast.success('Claim updated', `${activities.length} field(s) changed on ${this.claimId()}`);
      this.router.navigate(['/claims', this.claimId(), 'overview']);
    } catch {
      this.toast.error('Failed to save', 'Please try again. Your changes have been kept.');
    } finally {
      this.saving.set(false);
    }
  }

  async onDiscard(): Promise<void> {
    if (!this.form.dirty) {
      this.router.navigate(['/claims', this.claimId(), 'overview']);
      return;
    }
    const ref = this.dialogSvc.open(EditClaimDiscardModalComponent, { width: '440px' });
    const result = await firstValueFrom(ref.afterClosed());
    if (result === 'discard') {
      this.router.navigate(['/claims', this.claimId(), 'overview']);
    }
  }
}
