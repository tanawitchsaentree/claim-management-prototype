import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { environment } from '../../../environments/environment';

// trackerEnabled=false (stable build) → redirect to /dashboard, tracker
// never renders.
//
// Sign-in requirement removed on request (2026-08-20) — was previously an
// additional check here (redirect to /tracker/login with no session) plus
// `to authenticated`-only RLS policies. Table/detail-panel now hit Supabase
// as the anon role (RLS updated to `to anon, authenticated` in
// 0001_tracker.sql). Consequence: updated_by/created_by audit fields fall
// back to 'unknown' since there's no signed-in user to attribute edits to.
export const trackerGuard: CanActivateFn = () => {
  const router = inject(Router);

  if (!environment.trackerEnabled) {
    return router.parseUrl('/dashboard');
  }

  return true;
};
