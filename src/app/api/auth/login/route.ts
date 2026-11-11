import { NextResponse } from 'next/server';
import { authenticateServerUser } from '@/lib/server-users';
import { setServerSession } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown; password?: unknown };
    if (typeof body.email !== 'string' || typeof body.password !== 'string') return NextResponse.json({ error: 'Correo y contraseña son obligatorios.' }, { status: 400 });
    const user = await authenticateServerUser(body.email, body.password);
    if (!user) return NextResponse.json({ error: 'Correo o contraseña incorrectos.' }, { status: 401 });
    await setServerSession(user);
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error iniciando sesión:', error);
    return NextResponse.json({ error: 'No se pudo iniciar sesión.' }, { status: 500 });
  }
}
