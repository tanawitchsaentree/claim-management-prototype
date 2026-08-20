import { Injectable, Signal, WritableSignal, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { Note } from '../../models';
import { MockBaseService } from './mock-base.service';
import rawData from '../data/notes.json';

type RawDataMap = Record<string, Note[]>;

@Injectable({ providedIn: 'root' })
export class MockNotesService extends MockBaseService {
  private readonly raw   = rawData as unknown as RawDataMap;
  // Signal-backed, not a plain Map — Sections' comment-count badges and the
  // right-strip notes panel each held their own snapshot before this, so a
  // note added in one place didn't show up in the other's counts.
  private readonly cache = new Map<string, WritableSignal<Note[]>>();

  private store(claimId: string): WritableSignal<Note[]> {
    let s = this.cache.get(claimId);
    if (!s) {
      s = signal<Note[]>(structuredClone(this.raw[claimId] ?? []));
      this.cache.set(claimId, s);
    }
    return s;
  }

  /** Live signal of a claim's notes — use this over getByClaim() wherever the
   *  caller needs to stay in sync with notes added/pinned elsewhere. */
  notesSignal(claimId: string): Signal<Note[]> {
    return this.store(claimId);
  }

  getByClaim(claimId: string): Observable<Note[]> {
    return this.respond(structuredClone(this.store(claimId)()));
  }

  addNote(claimId: string, payload: { title: string; section: Note['section']; body: string; attachedTo?: string | null }): Observable<Note[]> {
    const note: Note = {
      id:         `note-${Date.now()}`,
      claimId,
      author:     { name: 'Current User', initials: 'CU', accent: 'blue' },
      timestamp:  new Date().toISOString(),
      title:      payload.title || undefined,
      body:       payload.body,
      section:    payload.section,
      pinned:     false,
      attachedTo: payload.attachedTo ?? null,
    };
    const store = this.store(claimId);
    const next = [note, ...store()];
    store.set(next);
    return this.respond(structuredClone(next));
  }

  togglePin(claimId: string, noteId: string): Observable<Note[]> {
    const store = this.store(claimId);
    const next = store().map(n => n.id === noteId ? { ...n, pinned: !n.pinned } : n);
    store.set(next);
    return this.respond(structuredClone(next));
  }

  /** Used by ScenarioOverrides.notesAppend so AC tickets can seed notes. */
  appendNotes(claimId: string, notes: Note[]): void {
    const store = this.store(claimId);
    const ids = new Set(store().map(n => n.id));
    const fresh = notes.filter(n => !ids.has(n.id));
    store.set([...store(), ...fresh]);
  }

  resetState(claimId?: string): void {
    if (claimId) this.cache.delete(claimId);
    else         this.cache.clear();
  }
}
