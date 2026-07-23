import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { animate, style, transition, trigger } from '@angular/animations';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxLinkModule } from '@allianz/ng-aquila/link';
import { Toast, ToastService, ToastTone } from './toast.service';

// NDBX has no first-class toast/snackbar primitive — only NxMessage (inline
// banner) and NxNotificationPanel (dropdown list). We compose a fixed-position
// stack of <nx-message> instances + custom slide animation.

@Component({
  selector: 'app-toast-stack',
  standalone: true,
  imports: [CommonModule, NxIconModule, NxMessageModule, NxLinkModule],
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="true">
      @for (t of toasts(); track t.id) {
        <div class="toast" role="status" @toastSlide>
          <nx-message [context]="contextFor(t.tone)"
                      [closable]="true"
                      (close)="svc.dismiss(t.id)">
            <strong>{{ t.title }}</strong>
            @if (t.description) {
              <p class="toast__desc">{{ t.description }}</p>
            }
            @if (t.action) {
              <nx-link size="small" class="toast__action">
                <a (click)="onAction(t)">{{ t.action.label }}</a>
              </nx-link>
            }
          </nx-message>
        </div>
      }
    </div>
  `,
  styleUrl: './toast-stack.component.scss',
  animations: [
    trigger('toastSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(24px)' }),
        animate('200ms cubic-bezier(0.2, 0, 0, 1)',
          style({ opacity: 1, transform: 'translateX(0)' })),
      ]),
      transition(':leave', [
        animate('160ms ease-in',
          style({ opacity: 0, transform: 'translateX(24px)' })),
      ]),
    ]),
  ],
})
export class ToastStackComponent {
  readonly svc = inject(ToastService);
  readonly toasts = this.svc.toasts;

  // Map our tone → NxMessage `context` (success | warning | error | info).
  contextFor(tone: ToastTone): 'success' | 'warning' | 'error' | 'info' {
    return tone;
  }

  onAction(t: Toast): void {
    t.action?.onClick();
    this.svc.dismiss(t.id);
  }
}
