import { Component, inject, ChangeDetectionStrategy } from '@angular/core';

import { NxButtonModule } from '@allianz/ng-aquila/button';
import { AuthService, PERSONAS } from '../../../core/services/auth';

const ROLE_LABEL: Record<string, string> = {
  'claims-handler': 'All',
  kcm: 'KCM',
  'claims-manager': 'Manager'
};

@Component({
  selector: 'app-persona-switcher',
  standalone: true,
  imports: [NxButtonModule],
  template: `
    <div class="ps-bar">
      <span class="ps-label">Persona:</span>
      @for (p of personas; track p.id) {
        <button
          type="button"
          class="ps-btn"
          [class.ps-btn--active]="auth.user()?.id === p.id"
          (click)="auth.setActivePersona(p.id)"
        >
          {{ p.name }} <span class="ps-role-tag">{{ roleLabel(p.dashboardRole) }}</span>
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './persona-switcher.scss'
})
export class PersonaSwitcherComponent {
  readonly auth = inject(AuthService);
  readonly personas = PERSONAS;
  roleLabel(r: string): string {
    return ROLE_LABEL[r] ?? r;
  }
}
