import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TrackerService } from './tracker.service';

@Injectable({ providedIn: 'root' })
export class TrackerSyncService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly trackerService = inject(TrackerService);

  readonly syncing = signal(false);
  readonly error = signal<string | null>(null);

  async triggerSync(): Promise<void> {
    this.syncing.set(true);
    this.error.set(null);

    const { error } = await this.supabase.functions.invoke('sync-jira');
    if (error) {
      this.error.set(error.message);
    }

    await this.trackerService.getSyncLog();
    this.syncing.set(false);
  }
}
