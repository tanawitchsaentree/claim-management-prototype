import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RightStripService {
  readonly requestedPanel = signal<string | null>(null);

  open(key: string): void {
    this.requestedPanel.set(key);
  }

  consume(): string | null {
    const key = this.requestedPanel();
    this.requestedPanel.set(null);
    return key;
  }
}
