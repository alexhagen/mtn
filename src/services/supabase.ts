// Supabase client singleton
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let cachedUrl: string = '';
let cachedKey: string = '';

export function getSupabaseClient(): SupabaseClient | null {
  // Read env vars at call time
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  // Return null if not configured (local mode)
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  // Reset singleton if env vars changed
  if (supabaseInstance && (cachedUrl !== supabaseUrl || cachedKey !== supabaseAnonKey)) {
    supabaseInstance = null;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    cachedUrl = supabaseUrl;
    cachedKey = supabaseAnonKey;
  }

  return supabaseInstance;
}

export function isSupabaseConfigured(): boolean {
  // Read env vars at call time
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return !!(supabaseUrl && supabaseAnonKey);
}
