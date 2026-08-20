import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NoteAttachment } from '../../../core/models/note.model';

// BMPCC-14967 — small chip list shared by the notes compose form (removable,
// pending attachments) and the rendered note card (read-only).
@Component({
  selector: 'app-note-attachment-list',
  standalone: true,
  imports: [CommonModule, NxIconModule, NxButtonModule],
  templateUrl: './note-attachment-list.component.html',
  styleUrl: './note-attachment-list.component.scss',
})
export class NoteAttachmentListComponent {
  @Input({ required: true }) attachments: NoteAttachment[] = [];
  @Input() removable = false;
  @Output() remove = new EventEmitter<NoteAttachment>();

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
