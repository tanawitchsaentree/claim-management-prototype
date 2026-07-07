import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ClaimPreviewService {
  readonly claimId = signal<string | null>(null);
  readonly x       = signal(0);
  readonly y       = signal(0);
  readonly visible = signal(false);

  show(claimId: string, x: number, y: number): void {
    this.claimId.set(claimId);
    this.x.set(x);
    this.y.set(y);
    this.visible.set(true);
  }

  hide(): void {
    this.visible.set(false);
  }
}
