import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id:    string;
  tone:  ToastTone;
  title: string;
  description?: string;
  durationMs?: number;
}

const DEFAULT_DURATION_MS = 4000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(input: Omit<Toast, 'id'>): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toast: Toast = { id, durationMs: DEFAULT_DURATION_MS, ...input };
    this._toasts.update(list => [...list, toast]);
    if (toast.durationMs && toast.durationMs > 0) {
      setTimeout(() => this.dismiss(id), toast.durationMs);
    }
    return id;
  }

  success(title: string, description?: string): string {
    return this.show({ tone: 'success', title, description });
  }

  info(title: string, description?: string): string {
    return this.show({ tone: 'info', title, description });
  }

  warning(title: string, description?: string): string {
    return this.show({ tone: 'warning', title, description });
  }

  error(title: string, description?: string): string {
    return this.show({ tone: 'error', title, description, durationMs: 6000 });
  }

  dismiss(id: string): void {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }

  clearAll(): void { this._toasts.set([]); }
}
