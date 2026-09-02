import { Injectable, computed, signal } from '@angular/core';

// Who is looking at the tracker. There is no user table and no sign-in (see
// core/guards/tracker.guard.ts), so "identity" here is just two states:
//
//   'team'  — the default. Everyone who opens /tracker. Never sees the owner's
//             rows, and the owner's name is absent from the Assignee filter
//             because that dropdown is derived from the rows that loaded.
//   'owner' — unlocked with a personal password. Sees everything, team rows
//             included.
//
// Pattern copied from features/access-gate/access-gate.component.ts: compare a
// SHA-256 hash held as a const, remember the result in localStorage. The hash
// is in the shipped bundle and the password is short, so this stops a colleague
// scrolling past rows, not an attacker — see tracker-visibility.ts for why that
// is the accepted scope.
const VIEWER_KEY = 'tracker:viewer';
const OWNER_PASSWORD_HASH = 'fa88de024364dbfcc278ce32fe7956ac7c2d058535f7ec9e8e017b8e3b77f805';

export type TrackerViewer = 'team' | 'owner';

@Injectable({ providedIn: 'root' })
export class TrackerViewerService {
  // Read once at construction rather than in an ngOnInit somewhere — the guard
  // and TrackerService both ask isOwner() before any component renders, so the
  // remembered value has to be there from the first read. Same reason
  // core/services/auth.ts:36 seeds its persona signal inline.
  readonly viewer = signal<TrackerViewer>(
    localStorage.getItem(VIEWER_KEY) === 'owner' ? 'owner' : 'team',
  );

  readonly isOwner = computed(() => this.viewer() === 'owner');

  /** @returns true when the password matched and the viewer switched to 'owner'. */
  async unlock(password: string): Promise<boolean> {
    const hash = await sha256(password.trim());
    if (hash !== OWNER_PASSWORD_HASH) return false;

    localStorage.setItem(VIEWER_KEY, 'owner');
    this.viewer.set('owner');
    return true;
  }

  lock(): void {
    localStorage.removeItem(VIEWER_KEY);
    this.viewer.set('team');
  }
}

async function sha256(text: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
