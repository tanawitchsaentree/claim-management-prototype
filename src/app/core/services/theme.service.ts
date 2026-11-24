import { Injectable, signal } from '@angular/core';

// 'a1-pure' (2026-11-24, user's ask): the A1 library exactly as it ships,
// allianz-one.css + the ALLIANZ_ONE component switch, with NONE of our A1
// layer (themes/_a1.scss: type-scale pins, text roles, weights, spacing and
// radius mapping, status/tint mapping). <html data-theme="a1-pure"> matches
// neither themes/_a1.scss nor themes/_ndbx.scss, so both stay off.
// 'a1-compact' (2026-11-24): the target the CHAMP A1 work uses (Confluence
// "Claim Handling NOM (CHAMP) - A1 defects" and the NDBX-to-A1 migration
// guide: "A1 Light, Compact M (expert)"). allianz-one-compact.css + our token
// translation, none of our adjustments.
export type AppTheme = 'ndbx' | 'a1' | 'a1-pure' | 'a1-compact';

/** Theme choices as shown in the DEV banner's settings menu. */
export const APP_THEMES: readonly { value: AppTheme; label: string }[] = [
  { value: 'ndbx', label: 'NDBX' },
  { value: 'a1', label: 'A1 (with our adjustments)' },
  { value: 'a1-pure', label: 'A1 pure (library only)' },
  { value: 'a1-compact', label: 'A1 compact (CHAMP target)' }
];

const isTheme = (v: string | null): v is AppTheme => APP_THEMES.some(t => t.value === v);

/** True for every A1 variant: the ALLIANZ_ONE component switch is on. */
export const isA1 = (t: AppTheme): boolean => t !== 'ndbx';

// Dev-only visual A/B toggle between the current NDBX theme and the new
// Allianz One (A1) theme — both CSS files already ship inside
// @allianz/ngx-brand-kit, so this is a stylesheet swap, not a package
// migration (same @allianz/ng-aquila components under both). The two
// <link> tags live in index.html; only one is ever enabled at a time.
// Persisted so a reload (or the dev banner's own Reset button) keeps
// showing whichever theme was last picked.
//
// sync() also stamps <html data-theme="...">: the project's own theme layers
// (src/styles/themes/_ndbx.scss, _a1.scss) are scoped to that attribute, so
// the library stylesheet and our overrides always switch together. See
// .claude/THEMING.md.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private static readonly STORAGE_KEY = 'app:theme';

  readonly theme = signal<AppTheme>(
    isTheme(localStorage.getItem(ThemeService.STORAGE_KEY))
      ? (localStorage.getItem(ThemeService.STORAGE_KEY) as AppTheme)
      : 'ndbx'
  );

  // Called once from an APP_INITIALIZER so the <link disabled> state
  // matches localStorage before the first paint, and again on every toggle.
  sync(): void {
    const current = this.theme();
    document.documentElement.dataset['theme'] = current;
    this.setLinkDisabled('theme-link-ndbx', current !== 'ndbx');
    this.setLinkDisabled('theme-link-a1', current !== 'a1' && current !== 'a1-pure');
    this.setLinkDisabled('theme-link-a1-compact', current !== 'a1-compact');
  }

  set(next: AppTheme): void {
    this.theme.set(next);
    localStorage.setItem(ThemeService.STORAGE_KEY, next);
    this.sync();
  }

  private setLinkDisabled(id: string, disabled: boolean): void {
    const link = document.getElementById(id) as HTMLLinkElement | null;
    if (link) link.disabled = disabled;
  }
}
