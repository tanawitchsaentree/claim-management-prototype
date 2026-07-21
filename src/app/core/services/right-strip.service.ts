import { Injectable, signal } from '@angular/core';

export interface StripRequest {
  panel: string;
  highlightNoteId?: string;
}

@Injectable({ providedIn: 'root' })
export class RightStripService {
  readonly requestedPanel   = signal<string | null>(null);
  readonly highlightNoteId  = signal<string | null>(null);
  readonly quickAddEntity   = signal<string | null>(null);

  open(panel: string, highlightNoteId?: string): void {
    this.highlightNoteId.set(highlightNoteId ?? null);
    this.quickAddEntity.set(null);
    this.requestedPanel.set(panel);
  }

  /** Opens the Comments panel with the inline add-note form pre-shown for `entityName`. */
  openAddNote(entityName: string): void {
    this.highlightNoteId.set(null);
    this.quickAddEntity.set(entityName);
    this.requestedPanel.set('comments');
  }

  consume(): string | null {
    const key = this.requestedPanel();
    this.requestedPanel.set(null);
    return key;
  }

  consumeHighlight(): string | null {
    const id = this.highlightNoteId();
    this.highlightNoteId.set(null);
    return id;
  }

  consumeQuickAdd(): string | null {
    const entity = this.quickAddEntity();
    this.quickAddEntity.set(null);
    return entity;
  }
}
