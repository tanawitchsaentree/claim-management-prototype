// Shared shape for environment.ts / environment.exploration.ts / environment.prod.ts.
// Not itself swapped by fileReplacements — only the three environment.*.ts
// files are. Typing buildTag as the full union (not narrowed per-file via
// `as const`) keeps comparisons like `buildTag === 'exploration'` type-safe
// no matter which file a given build configuration swaps in.
// Dev banner surface, split per the tour-system audit (2026-08-20):
// 'full'     — everything, including dev-only widgets (state inspector,
//              reset, reference-view picker, FNOL quick-fill)
// 'reviewer' — ticket picker, AC apply/go-to, verify/unverify only
// 'off'      — banner hidden entirely
export type DevBannerMode = 'full' | 'reviewer' | 'off';

export interface Environment {
  trackerEnabled: boolean;
  buildTag: 'dev' | 'exploration' | 'stable';
  supabaseUrl: string;
  supabaseAnonKey: string;
  devBannerMode: DevBannerMode;
}
