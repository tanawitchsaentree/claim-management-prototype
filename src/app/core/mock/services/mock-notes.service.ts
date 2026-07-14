import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Note } from '../../models';
import { MockBaseService } from './mock-base.service';
import rawData from '../data/notes.json';

type RawDataMap = Record<string, Note[]>;

@Injectable({ providedIn: 'root' })
export class MockNotesService extends MockBaseService {
  private readonly raw   = rawData as unknown as RawDataMap;
  private readonly cache = new Map<string, Note[]>();

  getByClaim(claimId: string): Observable<Note[]> {
    const cached = this.cache.get(claimId);
    if (cached) return this.respond(structuredClone(cached));
    const source = this.raw[claimId] ?? [];
    const fresh  = structuredClone(source);
    this.cache.set(claimId, fresh);
    return this.respond(structuredClone(fresh));
  }

  addNote(claimId: string, payload: { title: string; section: Note['section']; body: string }): Observable<Note[]> {
    const list = this.cache.get(claimId) ?? structuredClone(this.raw[claimId] ?? []);
    const note: Note = {
      id:        `note-${Date.now()}`,
      claimId,
      author:    { name: 'Current User', initials: 'CU', accent: 'blue' },
      timestamp: new Date().toISOString(),
      title:     payload.title || undefined,
      body:      payload.body,
      section:   payload.section,
      pinned:    false,
    };
    const next = [note, ...list];
    this.cache.set(claimId, next);
    return this.respond(structuredClone(next));
  }

  togglePin(claimId: string, noteId: string): Observable<Note[]> {
    const list = this.cache.get(claimId) ?? [];
    const next = list.map(n => n.id === noteId ? { ...n, pinned: !n.pinned } : n);
    this.cache.set(claimId, next);
    return this.respond(structuredClone(next));
  }

  /** Used by ScenarioOverrides.notesAppend so AC tickets can seed notes. */
  appendNotes(claimId: string, notes: Note[]): void {
    const existing = this.cache.get(claimId) ?? structuredClone(this.raw[claimId] ?? []);
    const ids = new Set(existing.map(n => n.id));
    const fresh = notes.filter(n => !ids.has(n.id));
    this.cache.set(claimId, [...existing, ...fresh]);
  }

  resetState(claimId?: string): void {
    if (claimId) this.cache.delete(claimId);
    else         this.cache.clear();
  }
}
