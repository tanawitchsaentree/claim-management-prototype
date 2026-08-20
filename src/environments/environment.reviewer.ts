// Local reviewer-mode build — same dev backend/tracker access as
// environment.ts, but devBannerMode is 'reviewer' instead of 'full', so the
// dev-only banner widgets (state inspector, reset, reference-view picker,
// FNOL quick-fill) can be verified as hidden without deploying to prod.
// Run via `npm run start:reviewer`.
import type { Environment } from './environment.type';

export const environment: Environment = {
  trackerEnabled: true,
  buildTag: 'dev',
  supabaseUrl: 'https://ryhnvtzlybdbqlwzcqrw.supabase.co',
  supabaseAnonKey: 'sb_publishable_liEqGoFw_RNdnmpdXQgg-w_UuTrHGP7',
  devBannerMode: 'reviewer',
};
