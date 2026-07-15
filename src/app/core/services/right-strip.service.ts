import { Injectable, signal } from '@angular/core';

export interface StripRequest {
  panel: string;
  highlightNoteId?: string;
}

@Injectable({ providedIn: 'root' })
export class RightStripService {
  readonly requestedPanel   = signal<string | null>(null);
  readonly highlightNoteId  = signal<string | null>(null);

  open(panel: string, highlightNoteId?: string): void {
    this.highlightNoteId.set(highlightNoteId ?? null);
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
}
