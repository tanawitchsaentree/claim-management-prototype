// Dev environment — replaced at build time by environment.exploration.ts or
// environment.prod.ts via angular.json fileReplacements.
import type { Environment } from './environment.type';

export const environment: Environment = {
  trackerEnabled: true,
  buildTag: 'dev',
  supabaseUrl: 'https://ryhnvtzlybdbqlwzcqrw.supabase.co',
  // Publishable key fetched directly from the project's API-keys endpoint —
  // note this is 1 char shorter than what was originally pasted in chat
  // (no trailing "k"). Safe client-side; RLS is the real access boundary.
  supabaseAnonKey: 'sb_publishable_liEqGoFw_RNdnmpdXQgg-w_UuTrHGP7',
  devBannerMode: 'full',
};
