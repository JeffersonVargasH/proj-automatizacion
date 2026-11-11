import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import type { AppUser } from './auth';

type StoredUser = AppUser & { passwordHash: string; passwordSalt: string };
type NewUser = Pick<AppUser, 'name' | 'email' | 'business'> & { password?: string };

const storePath = path.join(process.cwd(), 'data', 'users.json');

function publicUser(user: StoredUser): AppUser {
  return { id: user.id, name: user.name, email: user.email, business: user.business, role: user.role, status: user.status };
}

function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return { passwordSalt: salt, passwordHash: scryptSync(password, salt, 64).toString('hex') };
}

function matchesPassword(user: StoredUser, password: string) {
  const expected = Buffer.from(user.passwordHash, 'hex');
  const actual = Buffer.from(hashPassword(password, user.passwordSalt).passwordHash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function seededUser(input: AppUser, password: string): StoredUser {
  return { ...input, ...hashPassword(password) };
}

const defaultUsers: StoredUser[] = [
  seededUser({ id: 'demo-admin', name: 'Administrador Clic', email: 'admin@clic.local', business: 'Clic', role: 'admin', status: 'active' }, 'demo1234'),
  seededUser({ id: 'demo-entrepreneur', name: 'Empresario demo', email: 'empresario@clic.local', business: 'Mi negocio demo', role: 'entrepreneur', status: 'active' }, 'demo1234'),
];

async function saveUsers(users: StoredUser[]) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(users, null, 2), 'utf8');
}

async function readUsers(): Promise<StoredUser[]> {
  try {
    const parsed = JSON.parse(await readFile(storePath, 'utf8')) as unknown;
    if (Array.isArray(parsed) && parsed.length) return parsed as StoredUser[];
  } catch {
    // The first request creates the local development store.
  }
  await saveUsers(defaultUsers);
  return defaultUsers;
}

export async function listServerUsers(): Promise<AppUser[]> {
  return (await readUsers()).map(publicUser);
}

export async function findServerUser(id: string): Promise<AppUser | null> {
  const user = (await readUsers()).find(item => item.id === id && item.status === 'active');
  return user ? publicUser(user) : null;
}

export async function authenticateServerUser(email: string, password: string): Promise<AppUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = (await readUsers()).find(item => item.email.toLowerCase() === normalizedEmail && item.status === 'active');
  return user && matchesPassword(user, password) ? publicUser(user) : null;
}

export async function createServerUser(input: NewUser): Promise<AppUser> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const business = input.business.trim();
  const password = input.password?.trim() || 'Bienvenido123!';
  if (!name || !email || !business) throw new Error('Completa nombre, correo y negocio.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Ingresa un correo válido.');
  if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');

  const users = await readUsers();
  if (users.some(item => item.email.toLowerCase() === email)) throw new Error('Ese correo ya está registrado.');
  const user: StoredUser = { id: `user-${randomUUID()}`, name, email, business, role: 'entrepreneur', status: 'active', ...hashPassword(password) };
  await saveUsers([...users, user]);
  return publicUser(user);
}

export async function importServerUsers(csv: string): Promise<{ users: AppUser[]; skipped: number }> {
  const rows = csv.split(/\r?\n/).map(row => row.trim()).filter(Boolean);
  if (!rows.length) return { users: [], skipped: 0 };
  const start = rows[0].toLowerCase().includes('correo') || rows[0].toLowerCase().includes('email') ? 1 : 0;
  const users: AppUser[] = [];
  let skipped = 0;
  for (const row of rows.slice(start)) {
    const [name = '', email = '', business = '', password = ''] = row.split(',').map(value => value.trim().replace(/^"|"$/g, ''));
    try { users.push(await createServerUser({ name, email, business, password })); }
    catch { skipped += 1; }
  }
  return { users, skipped };
}
