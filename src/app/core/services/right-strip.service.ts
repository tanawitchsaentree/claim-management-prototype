import { Injectable, signal } from '@angular/core';

export interface StripRequest {
  panel: string;
  highlightNoteId?: string;
}

export interface NotesScope {
  /** Display label for the panel header, e.g. the section name. */
  label: string;
  /** Note.attachedTo values to match — the section itself plus its entities. */
  names: string[];
}

@Injectable({ providedIn: 'root' })
export class RightStripService {
  readonly requestedPanel   = signal<string | null>(null);
  readonly highlightNoteId  = signal<string | null>(null);
  readonly quickAddEntity   = signal<string | null>(null);
  readonly scope            = signal<NotesScope | null>(null);

  open(panel: string, highlightNoteId?: string): void {
    this.highlightNoteId.set(highlightNoteId ?? null);
    this.quickAddEntity.set(null);
    this.scope.set(null);
    this.requestedPanel.set(panel);
  }

  /** Opens the Comments panel with the inline add-note form pre-shown for `entityName`. */
  openAddNote(entityName: string): void {
    this.highlightNoteId.set(null);
    this.quickAddEntity.set(entityName);
    this.scope.set(null);
    this.requestedPanel.set('comments');
  }

  /** Opens the Comments panel filtered to only notes matching `names` — used by
   *  the Sections "View notes" action, which needs "all notes for this section
   *  and its entities", not a jump to a single one. */
  openScoped(panel: string, label: string, names: string[]): void {
    this.highlightNoteId.set(null);
    this.quickAddEntity.set(null);
    this.scope.set({ label, names });
    this.requestedPanel.set(panel);
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

  consumeScope(): NotesScope | null {
    const scope = this.scope();
    this.scope.set(null);
    return scope;
  }
}
