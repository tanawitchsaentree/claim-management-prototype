import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { firstValueFrom } from 'rxjs';
import { MockClaimDocumentsService } from '../../../core/mock/services/mock-claim-documents.service';
import { ClaimDocument } from '../../../core/models/provider-communication.model';
import { NoteAttachment } from '../../../core/models/note.model';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

export interface AttachDocumentModalData {
  claimId: string;
}

type Tab = 'existing' | 'upload';

// BMPCC-14967 — "attach existing document" or "upload new document" to a
// note. No NDBX file-upload component exists yet (checked docs/NDBX_RECIPES.md
// and node_modules — nothing there), so the upload tab uses a plain hidden
// <input type="file"> behind a styled button; this is a gap to revisit once
// NDBX ships a real upload component.
@Component({
  selector: 'app-attach-document-modal',
  standalone: true,
  imports: [CommonModule, NxModalModule, NxButtonModule, NxIconModule, NxCheckboxModule, NxSpinnerModule, EmptyStateComponent],
  templateUrl: './attach-document-modal.component.html',
  styleUrl: './attach-document-modal.component.scss',
})
export class AttachDocumentModalComponent implements OnInit {
  readonly data     = inject<AttachDocumentModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<AttachDocumentModalComponent, NoteAttachment[]>>(NxModalRef);
  private readonly docsSvc = inject(MockClaimDocumentsService);

  readonly tab      = signal<Tab>('existing');
  readonly loading  = signal(true);
  readonly documents = signal<ClaimDocument[]>([]);
  readonly selectedExisting = signal<Set<string>>(new Set());  // keyed by documentId
  readonly uploadedFiles    = signal<File[]>([]);

  async ngOnInit(): Promise<void> {
    this.documents.set(await firstValueFrom(this.docsSvc.getByClaimId(this.data.claimId)));
    this.loading.set(false);
  }

  toggleExisting(documentId: string): void {
    this.selectedExisting.update(set => {
      const next = new Set(set);
      next.has(documentId) ? next.delete(documentId) : next.add(documentId);
      return next;
    });
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.uploadedFiles.update(list => [...list, ...Array.from(input.files!)]);
    }
    input.value = '';
  }

  removeUploaded(file: File): void {
    this.uploadedFiles.update(list => list.filter(f => f !== file));
  }

  confirm(): void {
    const existing: NoteAttachment[] = this.documents()
      .filter(d => this.selectedExisting().has(d.documentId))
      .map(d => ({ fileId: d.documentId, fileName: d.fileName, fileSize: d.fileSize }));
    const uploaded: NoteAttachment[] = this.uploadedFiles()
      .map(f => ({ fileName: f.name, fileSize: f.size }));
    this.modalRef.close([...existing, ...uploaded]);
  }

  cancel(): void {
    this.modalRef.close();
  }
}
