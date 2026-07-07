import { Component, computed, inject } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { ClaimNotesPanelComponent } from '../../claims/claim-notes-panel/claim-notes-panel.component';
import { ClaimReferencePanelComponent } from '../../claims/claim-reference-panel/claim-reference-panel.component';
import { ReferenceViewService } from '../../claims/claim-reference-panel/reference-view.service';

interface StripItem {
  icon: string;
  label: string;
  key: string;
}

@Component({
  selector: 'app-claim-right-strip',
  standalone: true,
  imports: [CommonModule, NxIconModule, NxTooltipModule, ClaimNotesPanelComponent, ClaimReferencePanelComponent],
  templateUrl: './claim-right-strip.component.html',
  styleUrl: './claim-right-strip.component.scss',
  animations: [
    trigger('panelSlide', [
      transition(':enter', [
        style({ width: 0, opacity: 0 }),
        animate('220ms cubic-bezier(0.2, 0, 0, 1)',
          style({ width: '384px', opacity: 1 })),
      ]),
      transition(':leave', [
        style({ width: '384px', opacity: 1, overflow: 'hidden' }),
        animate('180ms cubic-bezier(0.4, 0, 1, 1)',
          style({ width: 0, opacity: 0 })),
      ]),
    ]),
    trigger('refPanelSlide', [
      transition(':enter', [
        style({ width: 0, opacity: 0 }),
        animate('220ms cubic-bezier(0.2, 0, 0, 1)',
          style({ width: '360px', opacity: 1 })),
      ]),
      transition(':leave', [
        style({ width: '360px', opacity: 1, overflow: 'hidden' }),
        animate('180ms cubic-bezier(0.4, 0, 1, 1)',
          style({ width: 0, opacity: 0 })),
      ]),
    ]),
  ],
})
export class ClaimRightStripComponent {
  private readonly router = inject(Router);
  readonly refSvc = inject(ReferenceViewService);

  activeKey: string | null = null;
  collapsed = false;

  readonly items: StripItem[] = [
    { icon: 'info-circle-o',   label: 'Claim info',    key: 'info' },
    { icon: 'bolt-o',          label: 'Quick actions', key: 'actions' },
    { icon: 'speech-bubble-o', label: 'Comments',      key: 'comments' },
    { icon: 'clock-o',         label: 'History',       key: 'history' },
    { icon: 'paperclip',       label: 'Attachments',   key: 'attachments' },
  ];

  private readonly url$ = this.router.events.pipe(
    filter(e => e instanceof NavigationEnd),
    map(e => (e as NavigationEnd).urlAfterRedirects),
    startWith(this.router.url),
  );
  private readonly urlSignal = toSignal(this.url$, { initialValue: this.router.url });

  readonly currentClaimId = computed<string | null>(() => {
    const m = this.urlSignal().match(/^\/claims\/([^/]+)/);
    return m && m[1] !== 'new' ? m[1] : null;
  });

  readonly refTabCount = computed(() => this.refSvc.refTabCount());
  readonly refPanelOpen = computed(() => this.refSvc.isPanelMode());

  activate(key: string): void {
    this.activeKey = this.activeKey === key ? null : key;
  }

  toggleRefPanel(): void {
    const id = this.currentClaimId();
    if (!id) return;
    if (this.refSvc.isPanelMode()) {
      this.refSvc.close();
    } else {
      // Close any other open strip panel when opening reference
      this.activeKey = null;
      this.refSvc.setVariant('panel', id);
    }
  }

  closePanel(): void {
    this.activeKey = null;
  }

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    if (this.collapsed) this.activeKey = null;
  }
}
