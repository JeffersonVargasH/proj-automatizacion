import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseConfigured, supabaseKey, supabaseUrl } from './env';

export async function supabaseServer(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: items => {
        // En rutas /api sí se pueden escribir; si no, el proxy ya renovó la sesión.
        try { items.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* sin efecto */ }
      },
    },
  });
}

/** Cliente con service role: salta RLS. Úsalo solo en el servidor y después de comprobar permisos. */
export function supabaseAdmin(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.');
  return createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type Caller = { supabase: SupabaseClient; user: User; role: 'admin' | 'entrepreneur' };
type Guard = { ok: true; caller: Caller } | { ok: false; response: NextResponse };

/** Exige una sesión válida y una cuenta activa. Con `admin` exige además el rol de administrador. */
export async function requireUser({ admin = false } = {}): Promise<Guard> {
  const deny = (error: string, status: number) => ({ ok: false as const, response: NextResponse.json({ error }, { status }) });
  if (!supabaseConfigured) return deny('El servidor no tiene configurado Supabase.', 503);
  const supabase = await supabaseServer();
  // getUser valida el token con Supabase; getSession solo leería la cookie.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return deny('Tu sesión expiró. Vuelve a iniciar sesión.', 401);
  const { data: profile } = await supabase.from('profiles').select('role, status').eq('id', user.id).single();
  if (!profile || profile.status !== 'active') return deny('Tu cuenta está suspendida. Escribe al administrador.', 403);
  if (admin && profile.role !== 'admin') return deny('Solo un administrador puede hacer esto.', 403);
  return { ok: true, caller: { supabase, user, role: profile.role } };
}

/** Registra un evento de la app en la auditoría sin bloquear la respuesta si falla. */
export async function audit(caller: Caller, action: string, entity: string, entityId?: string, details: Record<string, unknown> = {}) {
  const { error } = await caller.supabase.rpc('log_activity', { p_action: action, p_entity: entity, p_entity_id: entityId ?? null, p_details: details });
  if (error) console.error('No se pudo registrar la auditoría:', error.message);
}
