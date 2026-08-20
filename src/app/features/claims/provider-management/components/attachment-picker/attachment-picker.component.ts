import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { MockClaimDocumentsService } from '../../../../../core/mock/services/mock-claim-documents.service';
import { ClaimDocument } from '../../../../../core/models/provider-communication.model';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];

export interface AttachmentSelection {
  documentIds: string[];
  uploadedFiles: File[];
}

@Component({
  selector: 'app-attachment-picker',
  standalone: true,
  imports: [CommonModule, NxCheckboxModule, NxButtonModule, NxIconModule],
  templateUrl: './attachment-picker.component.html',
  styleUrl: './attachment-picker.component.scss',
})
export class AttachmentPickerComponent implements OnInit {
  @Input({ required: true }) claimId = '';
  @Output() selectionChange = new EventEmitter<AttachmentSelection>();

  private readonly docsSvc = inject(MockClaimDocumentsService);

  readonly documents = signal<ClaimDocument[]>([]);
  readonly selectedDocIds = signal<Set<string>>(new Set());
  readonly uploadedFiles = signal<File[]>([]);
  readonly fileError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const docs = await firstValueFrom(this.docsSvc.getByClaimId(this.claimId));
    this.documents.set(docs);
  }

  isSelected(id: string): boolean {
    return this.selectedDocIds().has(id);
  }

  toggleDoc(id: string): void {
    const s = new Set(this.selectedDocIds());
    s.has(id) ? s.delete(id) : s.add(id);
    this.selectedDocIds.set(s);
    this.emitChange();
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    const tooBig = files.filter(f => f.size > MAX_FILE_SIZE);
    if (tooBig.length) {
      this.fileError.set(`${tooBig.map(f => f.name).join(', ')} exceeds the 10 MB limit.`);
    } else {
      this.fileError.set(null);
    }
    const valid = files.filter(f => f.size <= MAX_FILE_SIZE);
    this.uploadedFiles.set([...this.uploadedFiles(), ...valid]);
    input.value = '';
    this.emitChange();
  }

  removeUploadedFile(file: File): void {
    this.uploadedFiles.set(this.uploadedFiles().filter(f => f !== file));
    this.emitChange();
  }

  formatSize(bytes: number): string {
    return bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(bytes / 1024)} KB`;
  }

  get acceptedTypes(): string {
    return ACCEPTED_TYPES.join(',');
  }

  private emitChange(): void {
    this.selectionChange.emit({
      documentIds: Array.from(this.selectedDocIds()),
      uploadedFiles: this.uploadedFiles(),
    });
  }
}
