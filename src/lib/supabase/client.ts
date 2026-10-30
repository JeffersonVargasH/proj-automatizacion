'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseKey, supabaseUrl } from './env';

let client: SupabaseClient | null = null;

/** Un solo cliente por pestaña: guarda la sesión en cookies para que las rutas /api la lean. */
export function supabaseBrowser(): SupabaseClient {
  client ??= createBrowserClient(supabaseUrl, supabaseKey);
  return client;
}
