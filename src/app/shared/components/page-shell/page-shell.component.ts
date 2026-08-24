import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { NxBreadcrumbModule } from '@allianz/ng-aquila/breadcrumb';
import { NxGridModule } from '@allianz/ng-aquila/grid';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { Navbar } from '../../../features/layout/navbar/navbar';

export interface BreadcrumbItem {
  label: string;
  route?: string;       // omit on the last (current) item
}

/**
 * Standard page shell for any feature page that needs:
 *   navbar  ← top chrome
 *   toolbar with breadcrumb (optional, only when [breadcrumb] is non-empty)
 *   page-wrap with optional toast + content slot
 *
 * Layout / spacing / a11y are handled here once. Feature pages only project
 * their content via <ng-content>.
 */
@Component({
  selector: 'app-page-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    Navbar,
    NxBreadcrumbModule,
    NxGridModule,
    NxMessageModule,
  ],
  templateUrl: './page-shell.component.html',
  styleUrl: './page-shell.component.scss',
})
export class PageShellComponent implements OnChanges {
  private readonly live = inject(LiveAnnouncer);

  @Input() breadcrumb: BreadcrumbItem[] = [];
  @Input() toast: string | null = null;

  /**
   * 'grid' (default) — content wrapped in nxLayout="grid maxwidth" + nxRow/nxCol;
   *   inner edge sits at ~64px (32 grid + 32 col gutter). Use for forms/tables.
   * 'navbar' — content padded 32px to align with the navbar menu items.
   *   Use for landing pages / card grids that should sit flush with top chrome.
   */
  @Input() align: 'grid' | 'navbar' = 'grid';

  @Output() toastClose = new EventEmitter<void>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['toast'] && this.toast) {
      this.live.announce(this.toast, 'polite');
    }
  }
}
