// Renamed from NoteSection/Note.section 2026-08-21 — the old name collided
// with ClaimSection (an unrelated concept: coverage/entity grouping) across
// both the code and the UI ("Attach to: SECTION" meant a ClaimSection;
// "Notes category" internally typed as NoteSection meant Recovery/
// Litigation/General). A saved note always has a real category — 'general'
// is the default, not an absence — so no null in the persisted type.
export type NoteCategory = 'recovery' | 'litigation' | 'general';
export type AvatarAccent =
  | 'yellow'
  | 'orange'
  | 'red'
  | 'purple'
  | 'teal'
  | 'aqua'
  | 'blue'
  | 'green'
  | 'gray';

export interface NoteAuthor {
  name: string;
  initials: string;
  accent: AvatarAccent;
}

export interface Note {
  id: string;
  claimId: string;
  author: NoteAuthor;
  timestamp: string; // ISO
  body: string;
  category: NoteCategory;
  pinned: boolean;
  // Entity/section name this note is scoped to (e.g. "Forklift") — null/undefined
  // for claim-level notes. Only reliably set via the Sections quick-add path today.
  attachedTo?: string | null;
}
