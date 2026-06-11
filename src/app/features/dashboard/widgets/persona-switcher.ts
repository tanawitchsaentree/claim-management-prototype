import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { AuthService, PERSONAS } from '../../../core/services/auth';

const ROLE_LABEL: Record<string, string> = {
  'claims-handler': 'All',
  'kcm': 'KCM',
};

@Component({
  selector: 'app-persona-switcher',
  standalone: true,
  imports: [CommonModule, NxButtonModule],
  template: `
    <div class="ps-bar">
      <span class="ps-label">Persona:</span>
      @for (p of personas; track p.id) {
        <button
          type="button"
          class="ps-btn"
          [class.ps-btn--active]="auth.user()?.id === p.id"
          (click)="auth.setActivePersona(p.id)">
          {{ p.name }} <span class="ps-role-tag">{{ roleLabel(p.dashboardRole) }}</span>
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ps-bar {
      display: flex; align-items: center; gap: 6px;
      padding: 0 8px 0 12px;
      border-left: 1px solid var(--ui-04);
    }
    .ps-label { font-size: 12px; color: var(--text-muted); font-weight: 600; white-space: nowrap; }
    .ps-btn {
      font-size: 12px; padding: 3px 10px; border-radius: 12px;
      border: 1px solid var(--ui-04); background: var(--ui-01);
      color: var(--text-01); cursor: pointer; white-space: nowrap;
      transition: background .12s, border-color .12s;
      &:hover { background: var(--ui-02); }
      &--active { background: var(--interactive-primary); color: #fff; border-color: var(--interactive-primary); }
    }
    .ps-role-tag {
      font-size: 10px; opacity: .75; margin-left: 3px;
    }
  `],
})
export class PersonaSwitcherComponent {
  readonly auth = inject(AuthService);
  readonly personas = PERSONAS;
  roleLabel(r: string): string { return ROLE_LABEL[r] ?? r; }
}
