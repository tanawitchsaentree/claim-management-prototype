// Stable/production build — tracker is OFF. trackerGuard redirects /tracker
// to /dashboard; the rest of the app is unaffected.
//
// devBannerMode stays 'full' until the tour-system audit's parity check
// (stage 6) confirms the reviewer launcher + tour cover every ticket the
// full banner covers — only then does this flip to 'reviewer' (stage 7).
import type { Environment } from './environment.type';

export const environment: Environment = {
  trackerEnabled: false,
  buildTag: 'stable',
  supabaseUrl: '',
  supabaseAnonKey: '',
  devBannerMode: 'full',
};
