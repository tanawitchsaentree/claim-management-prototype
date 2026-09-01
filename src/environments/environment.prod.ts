// Stable/production build — tracker is OFF. trackerGuard redirects /tracker
// to /dashboard; the rest of the app is unaffected.
//
// devBannerMode was flipped to 'reviewer' (stage 7, 2026-08-20), then to 'off'
// (2026-09-01, user's call): the deployed link is what stakeholders open, and a
// ticket/AC harness sitting above the app is not part of the product being
// shown. 'off' means AppComponent never renders the banner at all, so nothing
// is merely visually hidden. Ticket walkthroughs and AC state-apply are all
// still there in the dev/exploration builds, which is where they get used.
import type { Environment } from './environment.type';

export const environment: Environment = {
  trackerEnabled: false,
  buildTag: 'stable',
  supabaseUrl: '',
  supabaseAnonKey: '',
  devBannerMode: 'off',
};
