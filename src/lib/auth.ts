import type { SupabaseClient } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'entrepreneur';
export type AccountStatus = 'active' | 'suspended';

export type AppUser = { id: string; name: string; email: string; role: UserRole; status: AccountStatus; createdAt?: string };
export type BusinessSummary = { id: string; name: string };
export type Activity = { id: number; action: string; entity: string; entity_id: string | null; details: Record<string, string>; created_at: string; actor_id: string | null };

export const minPassword = 8;

/** Mensajes de Supabase Auth traducidos a algo que el usuario entienda. */
export function authMessage(message = ''): string {
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(message)) return 'Confirma tu correo antes de ingresar. Revisa tu bandeja de entrada.';
  if (/already registered|already been registered|user already exists/i.test(message)) return 'Ese correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.';
  if (/password should be|weak password|at least/i.test(message)) return `La contraseña debe tener al menos ${minPassword} caracteres, con letras y números.`;
  if (/rate limit|too many/i.test(message)) return 'Demasiados intentos. Espera unos minutos y vuelve a intentar.';
  if (/same.*password|different from the old/i.test(message)) return 'La nueva contraseña debe ser distinta de la anterior.';
  if (/fetch|network/i.test(message)) return 'No hay conexión con el servidor. Revisa tu internet.';
  return 'No se pudo completar la acción. Inténtalo de nuevo.';
}

export function passwordProblem(password: string): string {
  if (password.length < minPassword) return `Usa al menos ${minPassword} caracteres.`;
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return 'Combina letras y números.';
  return '';
}

export async function loadProfile(supabase: SupabaseClient, userId: string): Promise<AppUser | null> {
  const { data } = await supabase.from('profiles').select('id, email, full_name, role, status, created_at').eq('id', userId).single();
  return data ? toUser(data) : null;
}

export function toUser(row: { id: string; email: string; full_name: string; role: UserRole; status: AccountStatus; created_at?: string }): AppUser {
  return { id: row.id, name: row.full_name || row.email.split('@')[0], email: row.email, role: row.role, status: row.status, createdAt: row.created_at };
}

export async function listBusinesses(supabase: SupabaseClient, userId: string): Promise<BusinessSummary[]> {
  const { data, error } = await supabase.from('businesses').select('id, name').eq('owner_id', userId).order('created_at');
  if (error) throw new Error('No se pudieron cargar tus negocios.');
  return data || [];
}

export async function createBusiness(supabase: SupabaseClient, userId: string, name: string): Promise<BusinessSummary> {
  const clean = name.trim().slice(0, 120);
  if (!clean) throw new Error('Escribe el nombre del negocio.');
  const { data, error } = await supabase.from('businesses').insert({ owner_id: userId, name: clean, brand: { name: clean } }).select('id, name').single();
  if (error || !data) throw new Error('No se pudo crear el negocio.');
  return data;
}

export async function deleteBusiness(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('businesses').delete().eq('id', id);
  if (error) throw new Error('No se pudo eliminar el negocio.');
}

const activeKey = (userId: string) => `clic-active-business:${userId}`;
export function rememberBusiness(userId: string, id: string) { try { localStorage.setItem(activeKey(userId), id); } catch { /* opcional */ } }
export function rememberedBusiness(userId: string): string | null { try { return localStorage.getItem(activeKey(userId)); } catch { return null; } }

export async function recentActivity(supabase: SupabaseClient, limit = 20, actorId?: string): Promise<Activity[]> {
  let query = supabase.from('activity_log').select('id, action, entity, entity_id, details, created_at, actor_id').order('created_at', { ascending: false }).limit(limit);
  if (actorId) query = query.eq('actor_id', actorId);
  const { data } = await query;
  return (data || []) as Activity[];
}

const entities: Record<string, string> = { businesses: 'negocio', publications: 'publicación', profiles: 'cuenta', session: 'sesión', generation: 'generación con IA', publish: 'publicación en redes', copy: 'texto con IA', users: 'usuarios' };
const actions: Record<string, string> = { insert: 'Creó', update: 'Actualizó', delete: 'Eliminó', login: 'Inició', started: 'Inició', sent: 'Envió', invited: 'Invitó a', changed: 'Cambió' };

/** Frase corta para mostrar un evento de auditoría. */
export function describeActivity(item: Activity): string {
  const what = entities[item.entity] || item.entity;
  const name = item.details?.title || item.details?.name || item.details?.email || item.details?.network || '';
  const status = item.entity === 'profiles' && item.action === 'update' ? ` (${item.details?.role === 'admin' ? 'admin' : 'emprendedor'}, ${item.details?.status === 'suspended' ? 'suspendida' : 'activa'})` : '';
  return `${actions[item.action] || item.action} ${what}${name ? ` «${name}»` : ''}${status}`;
}
