import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { MockUserDirectoryService, UserDirectoryEntry } from '../../../core/mock/services/mock-user-directory.service';

export interface ReassignClaimPreviewRow {
  claimId: string;
  clientName: string;
  currentHandler?: string | null;
}

export interface ReassignClaimModalData {
  claimIds: string[];
  currentHandler?: string; // only meaningful when claimIds.length === 1
  claims?: ReassignClaimPreviewRow[]; // preview rows for the bulk case — omitted falls back to a plain count
}

export interface ReassignClaimModalResult {
  handlerName: string;
  reason?: string;
}

@Component({
  selector: 'app-reassign-claim-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxButtonModule,
    NxFormfieldModule,
    NxInputModule,
    NxIconModule,
  ],
  templateUrl: './reassign-claim-modal.component.html',
  styleUrl: './reassign-claim-modal.component.scss',
})
export class ReassignClaimModalComponent implements OnInit {
  readonly data     = inject<ReassignClaimModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<ReassignClaimModalComponent, ReassignClaimModalResult | null>>(NxModalRef);
  private readonly userDirSvc = inject(MockUserDirectoryService);

  // Default list shown on open; narrows to search results once the handler types 2+ chars.
  readonly defaultHandlers  = signal<UserDirectoryEntry[]>([]);
  readonly searchResults    = signal<UserDirectoryEntry[] | null>(null);
  readonly handlerQuery     = signal('');
  private searchGeneration = 0;

  readonly visibleHandlers = () => this.searchResults() ?? this.defaultHandlers();

  readonly form = new FormGroup({
    handlerName: new FormControl<string | null>(null, { validators: [Validators.required] }),
    reason:      new FormControl<string>('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const q = this.handlerQuery().trim();
      const generation = ++this.searchGeneration;
      if (q.length < 2) {
        this.searchResults.set(null);
        return;
      }
      firstValueFrom(this.userDirSvc.search(q)).then(results => {
        if (generation !== this.searchGeneration) return; // stale — a newer query superseded this one
        this.searchResults.set(results.filter(h => h.name !== this.data.currentHandler));
      });
    });
  }

  async ngOnInit(): Promise<void> {
    const all = await firstValueFrom(this.userDirSvc.getClaimHandlers());
    this.defaultHandlers.set(all.filter(h => h.name !== this.data.currentHandler));
  }

  selectHandler(name: string): void {
    this.form.patchValue({ handlerName: name });
    this.handlerQuery.set('');
    this.searchResults.set(null);
  }

  onCancel(): void { this.modalRef.close(null); }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.modalRef.close({ handlerName: raw.handlerName as string, reason: raw.reason || undefined });
  }
}
