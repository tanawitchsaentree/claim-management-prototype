export type NoteSection = 'recovery' | 'litigation' | 'general' | null;
export type AvatarAccent = 'yellow' | 'orange' | 'red' | 'purple' | 'teal' | 'aqua' | 'blue' | 'green' | 'gray';

export interface NoteAuthor {
  name:     string;
  initials: string;
  accent:   AvatarAccent;
}

export interface Note {
  id:        string;
  claimId:   string;
  author:    NoteAuthor;
  timestamp: string;        // ISO
  body:      string;
  section:   NoteSection;
  pinned:    boolean;
}
