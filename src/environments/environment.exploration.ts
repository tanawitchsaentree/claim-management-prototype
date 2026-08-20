// Exploration build — trackerEnabled true, shows the persistent "EXPLORATION
// BUILD" banner (see AppComponent). Deployed separately from the stable build.
import type { Environment } from './environment.type';

export const environment: Environment = {
  trackerEnabled: true,
  buildTag: 'exploration',
  supabaseUrl: 'https://ryhnvtzlybdbqlwzcqrw.supabase.co',
  supabaseAnonKey: 'sb_publishable_liEqGoFw_RNdnmpdXQgg-w_UuTrHGP7',
  devBannerMode: 'full',
};
