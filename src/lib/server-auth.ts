import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { AppSession, AppUser } from './auth';
import { findServerUser } from './server-users';

const SESSION_COOKIE = 'clic-session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value && process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET no está configurado.');
  return value || 'dev-only-change-this-secret';
}

function encode(value: string) {
  return Buffer.from(value).toString('base64url');
}

function decode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signature(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

function tokenFor(user: AppUser) {
  const payload = JSON.stringify({ ...user, exp: Date.now() + SESSION_TTL_SECONDS * 1000 });
  const encoded = encode(payload);
  return `${encoded}.${signature(encoded)}`;
}

function parseToken(token: string): AppUser | null {
  const [encoded, provided] = token.split('.');
  if (!encoded || !provided) return null;
  const expected = signature(encoded);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) return null;
  try {
    const payload = JSON.parse(decode(encoded)) as AppUser & { exp?: number };
    if (!payload.id || !payload.exp || payload.exp < Date.now()) return null;
    return { id: payload.id, name: payload.name, email: payload.email, business: payload.business, role: payload.role, status: payload.status };
  } catch {
    return null;
  }
}

export async function getServerSession(): Promise<AppSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const candidate = parseToken(token);
  if (!candidate) return null;
  const currentUser = await findServerUser(candidate.id);
  return currentUser ? { user: currentUser } : null;
}

export async function requireServerSession(role?: AppUser['role']): Promise<AppSession | null> {
  const session = await getServerSession();
  return session && (!role || session.user.role === role) ? session : null;
}

export async function setServerSession(user: AppUser) {
  (await cookies()).set(SESSION_COOKIE, tokenFor(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearServerSession() {
  (await cookies()).set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
}
