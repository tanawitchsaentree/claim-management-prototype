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

    // Refreshing the sync-log timestamp alone left the table showing whatever
    // it had loaded before the sync ran — "Last synced just now" next to a
    // list that hadn't actually picked up the new Jira data until the next
    // unrelated filter change or a manual reload.
    await Promise.all([this.trackerService.getSyncLog(), this.trackerService.getTickets(this.trackerService.filters())]);
    this.syncing.set(false);
  }
}
