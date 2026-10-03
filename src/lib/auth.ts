export type UserRole = 'admin' | 'entrepreneur';

export type AppUser = {
  id: string;
  name: string;
  email: string;
  business: string;
  role: UserRole;
  status: 'active' | 'pending';
};

type LocalAccount = AppUser & { password: string };

export type AppSession = { user: AppUser };

const USERS_KEY = 'clic-local-users-v1';
const SESSION_KEY = 'clic-local-session-v1';

const demoAccounts: LocalAccount[] = [
  { id: 'demo-admin', name: 'Administrador Clic', email: 'admin@clic.local', business: 'Clic', role: 'admin', status: 'active', password: 'demo1234' },
  { id: 'demo-entrepreneur', name: 'Empresario demo', email: 'empresario@clic.local', business: 'Mi negocio demo', role: 'entrepreneur', status: 'active', password: 'demo1234' },
];

function browserStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function toPublicUser(account: LocalAccount): AppUser {
  return Object.fromEntries(Object.entries(account).filter(([key]) => key !== 'password')) as AppUser;
}

function readAccounts(): LocalAccount[] {
  const storage = browserStorage();
  if (!storage) return demoAccounts;
  try {
    const raw = storage.getItem(USERS_KEY);
    if (!raw) {
      storage.setItem(USERS_KEY, JSON.stringify(demoAccounts));
      return demoAccounts;
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed as LocalAccount[] : demoAccounts;
  } catch {
    return demoAccounts;
  }
}

function writeAccounts(accounts: LocalAccount[]) {
  browserStorage()?.setItem(USERS_KEY, JSON.stringify(accounts));
}

export function listUsers(): AppUser[] {
  return readAccounts().map(toPublicUser);
}

export function loginLocal(email: string, password: string): AppSession | null {
  const normalizedEmail = email.trim().toLowerCase();
  const account = readAccounts().find(item => item.email.toLowerCase() === normalizedEmail && item.password === password);
  return account ? { user: toPublicUser(account) } : null;
}

export function readSession(): AppSession | null {
  const raw = browserStorage()?.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AppSession;
    return parsed?.user?.id ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(session: AppSession) {
  browserStorage()?.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  browserStorage()?.removeItem(SESSION_KEY);
}

export function createLocalUser(input: Pick<AppUser, 'name' | 'email' | 'business'> & { password?: string }): AppUser {
  const accounts = readAccounts();
  const email = input.email.trim().toLowerCase();
  if (!input.name.trim() || !email || !input.business.trim()) throw new Error('Completa nombre, correo y negocio.');
  if (accounts.some(item => item.email.toLowerCase() === email)) throw new Error('Ese correo ya está registrado.');
  const account: LocalAccount = {
    id: `user-${crypto.randomUUID()}`,
    name: input.name.trim(),
    email,
    business: input.business.trim(),
    role: 'entrepreneur',
    status: 'active',
    password: input.password?.trim() || 'Bienvenido123!',
  };
  writeAccounts([...accounts, account]);
  return toPublicUser(account);
}

export function importLocalUsers(csv: string): { users: AppUser[]; skipped: number } {
  const rows = csv.split(/\r?\n/).map(row => row.trim()).filter(Boolean);
  if (!rows.length) return { users: [], skipped: 0 };
  const start = rows[0].toLowerCase().includes('correo') || rows[0].toLowerCase().includes('email') ? 1 : 0;
  const created: AppUser[] = [];
  let skipped = 0;
  for (const row of rows.slice(start)) {
    const [name = '', email = '', business = '', password = ''] = row.split(',').map(value => value.trim().replace(/^"|"$/g, ''));
    try {
      created.push(createLocalUser({ name, email, business, password }));
    } catch {
      skipped += 1;
    }
  }
  return { users: created, skipped };
}
