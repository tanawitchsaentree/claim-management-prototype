import { Injectable, signal } from '@angular/core';

export type AppTheme = 'ndbx' | 'a1';

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
    localStorage.getItem(ThemeService.STORAGE_KEY) === 'a1' ? 'a1' : 'ndbx'
  );

  // Called once from an APP_INITIALIZER so the <link disabled> state
  // matches localStorage before the first paint, and again on every toggle.
  sync(): void {
    const current = this.theme();
    document.documentElement.dataset['theme'] = current;
    this.setLinkDisabled('theme-link-ndbx', current !== 'ndbx');
    this.setLinkDisabled('theme-link-a1', current !== 'a1');
  }

  toggle(): void {
    const next: AppTheme = this.theme() === 'ndbx' ? 'a1' : 'ndbx';
    this.theme.set(next);
    localStorage.setItem(ThemeService.STORAGE_KEY, next);
    this.sync();
  }

  private setLinkDisabled(id: string, disabled: boolean): void {
    const link = document.getElementById(id) as HTMLLinkElement | null;
    if (link) link.disabled = disabled;
  }
}
