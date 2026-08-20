// Stable/production build — tracker is OFF. trackerGuard redirects /tracker
// to /dashboard; the rest of the app is unaffected.
//
// devBannerMode flipped to 'reviewer' (stage 7, 2026-08-20) — TOUR_PARITY.md
// confirmed zero blockers: every ticket's done ACs remain reachable via the
// reviewer launcher, since the split (stage 3) never touched applyAC()/
// onGoTo(), only dev-only widget visibility (Reset, reference-view picker,
// state inspector).
import type { Environment } from './environment.type';

export const environment: Environment = {
  trackerEnabled: false,
  buildTag: 'stable',
  supabaseUrl: '',
  supabaseAnonKey: '',
  devBannerMode: 'reviewer',
};
