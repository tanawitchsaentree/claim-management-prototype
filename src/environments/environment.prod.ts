// Stable/production build — this is the link stakeholders open.
//
// trackerEnabled flipped to true (2026-09-02, user's call): /tracker on the
// deployed URL used to redirect to /dashboard, which meant the only way to
// reach the tracker was a local dev server or a second deployed build that had
// never actually been deployed. Nothing in the product UI links to /tracker
// (grepped: no navbar entry, no dashboard card, no route link anywhere), so
// turning it on puts it in front of nobody who isn't typing the URL on purpose
// — the reason it was off no longer holds. The Supabase creds are the same
// publishable/anon pair as the dev and exploration builds; RLS on every tracker
// table is `to anon, authenticated using (true)`, so this key grants exactly
// what the tracker already grants to anyone running the app locally, and it is
// already in this repo's environment.exploration.ts on a public remote.
//
// devBannerMode stays 'off' — deliberately NOT changed with the above. It was
// flipped to 'reviewer' (stage 7, 2026-08-20), then to 'off' (2026-09-01,
// user's call): a ticket/AC harness sitting above the app is not part of the
// product being shown. The tracker is a separate page you navigate to; the
// banner is an overlay on every claim page. 'off' means AppComponent never
// renders the banner at all, so nothing is merely visually hidden.
import type { Environment } from './environment.type';

export const environment: Environment = {
  trackerEnabled: true,
  buildTag: 'stable',
  supabaseUrl: 'https://ryhnvtzlybdbqlwzcqrw.supabase.co',
  supabaseAnonKey: 'sb_publishable_liEqGoFw_RNdnmpdXQgg-w_UuTrHGP7',
  devBannerMode: 'off',
};
