import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

// Single Supabase client instance for the whole app. Anon/publishable key
// only — RLS policies on each table are the real access boundary, not this
// key. detectSessionInUrl (default true) is what picks up the magic-link
// token when Supabase redirects back into the app.
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
  );
}
