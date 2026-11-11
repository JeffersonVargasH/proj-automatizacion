export type UserRole = 'admin' | 'entrepreneur';

export type AppUser = {
  id: string;
  name: string;
  email: string;
  business: string;
  role: UserRole;
  status: 'active' | 'pending';
};

export type AppSession = { user: AppUser };

const LEGACY_SESSION_KEY = 'clic-local-session-v1';

function browserStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

export function clearSession() {
  browserStorage()?.removeItem(LEGACY_SESSION_KEY);
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud.');
  return data;
}

export async function loginRemote(email: string, password: string): Promise<AppSession | null> {
  try { return await apiJson<AppSession>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); }
  catch { return null; }
}

export async function readRemoteSession(): Promise<AppSession | null> {
  try { return await apiJson<AppSession>('/api/auth/session'); }
  catch { return null; }
}

export async function logoutRemote() {
  await apiJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

export async function listRemoteUsers(): Promise<AppUser[]> {
  const result = await apiJson<{ users: AppUser[] }>('/api/admin/users');
  return result.users;
}

export async function createRemoteUser(input: Pick<AppUser, 'name' | 'email' | 'business'>): Promise<AppUser> {
  const result = await apiJson<{ user: AppUser }>('/api/admin/users', { method: 'POST', body: JSON.stringify(input) });
  return result.user;
}

export async function importRemoteUsers(csv: string): Promise<{ users: AppUser[]; skipped: number }> {
  return apiJson<{ users: AppUser[]; skipped: number }>('/api/admin/users/import', { method: 'POST', body: JSON.stringify({ csv }) });
}
