import { Directive, input, HostListener, inject, ElementRef, OnDestroy } from '@angular/core';
import { ClaimPreviewService } from '../services/claim-preview.service';
import { ReferenceViewService } from '../../features/claims/claim-reference-panel/reference-view.service';

const HOVER_DELAY_MS = 400;
const LEAVE_DELAY_MS = 200;
const POPOVER_W      = 300;
const POPOVER_H      = 280;
const MARGIN         = 8;
const NAVBAR_H       = 64;

@Directive({ selector: '[claimPreview]', standalone: true })
export class ClaimPreviewDirective implements OnDestroy {
  readonly claimPreview = input.required<string>();

  private readonly el       = inject(ElementRef<HTMLElement>);
  private readonly preview  = inject(ClaimPreviewService);
  private readonly refSvc   = inject(ReferenceViewService);

  private enterTimer: ReturnType<typeof setTimeout> | null = null;
  private leaveTimer: ReturnType<typeof setTimeout> | null = null;

  @HostListener('mouseenter')
  onEnter(): void {
    if (!this.refSvc.isPopoverMode()) return;
    if (this.leaveTimer) { clearTimeout(this.leaveTimer); this.leaveTimer = null; }
    this.enterTimer = setTimeout(() => {
      const rect = this.el.nativeElement.getBoundingClientRect();
      const { x, y } = this.calcPos(rect);
      this.preview.show(this.claimPreview(), x, y);
    }, HOVER_DELAY_MS);
  }

  @HostListener('mouseleave')
  onLeave(): void {
    if (this.enterTimer) { clearTimeout(this.enterTimer); this.enterTimer = null; }
    this.leaveTimer = setTimeout(() => this.preview.hide(), LEAVE_DELAY_MS);
  }

  private calcPos(rect: DOMRect): { x: number; y: number } {
    const spaceBelow = window.innerHeight - rect.bottom - MARGIN;
    const spaceAbove = rect.top - NAVBAR_H - MARGIN;
    let y = spaceBelow >= POPOVER_H || spaceBelow >= spaceAbove
      ? rect.bottom + MARGIN
      : rect.top - POPOVER_H - MARGIN;
    y = Math.max(NAVBAR_H + MARGIN, y);
    y = Math.min(window.innerHeight - POPOVER_H - MARGIN, y);

    let x = rect.left;
    if (x + POPOVER_W > window.innerWidth - MARGIN) x = window.innerWidth - POPOVER_W - MARGIN;
    if (x < MARGIN) x = MARGIN;
    return { x, y };
  }

  ngOnDestroy(): void {
    if (this.enterTimer) clearTimeout(this.enterTimer);
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    this.preview.hide();
  }
}
