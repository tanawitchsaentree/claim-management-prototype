import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import {
  AppNotification,
  MockNotificationService
} from '../../../core/mock/services/mock-notification.service';

// The navbar bell. A booking failure shows up hours after Submit, while the
// handler is on another claim, so the bell carries what needs them (badge) and
// what has since been fixed. Each line goes to the exact row or banner.
@Component({
  selector: 'app-notification-panel',
  standalone: true,
  imports: [NxButtonModule, NxContextMenuModule, NxIconModule],
  templateUrl: './notification-panel.component.html',
  styleUrl: './notification-panel.component.scss'
})
export class NotificationPanelComponent {
  private readonly notifySvc = inject(MockNotificationService);
  private readonly router = inject(Router);

  readonly count = this.notifySvc.actionCount;
  // Things that need the handler first, then good news.
  readonly items = computed(() => {
    const all = this.notifySvc.all();
    return [...all.filter(n => n.tone === 'action'), ...all.filter(n => n.tone === 'done')];
  });

  open(n: AppNotification): void {
    this.router.navigate(n.link, { queryParams: n.queryParams });
    if (n.tone === 'done') this.notifySvc.dismiss(n.id);
  }
}
