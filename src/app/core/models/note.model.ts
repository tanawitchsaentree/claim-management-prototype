export type NoteSection = 'recovery' | 'litigation' | 'general' | null;
export type AvatarAccent = 'yellow' | 'orange' | 'red' | 'purple' | 'teal' | 'aqua' | 'blue' | 'green' | 'gray';

export interface NoteAuthor {
  name:     string;
  initials: string;
  accent:   AvatarAccent;
}

export interface Note {
  id:          string;
  claimId:     string;
  author:      NoteAuthor;
  timestamp:   string;        // ISO
  title?:      string;
  body:        string;
  section:     NoteSection;
  pinned:      boolean;
  // Entity/section name this note is scoped to (e.g. "Forklift") — null/undefined
  // for claim-level notes. Only reliably set via the Sections quick-add path today.
  attachedTo?: string | null;
}
