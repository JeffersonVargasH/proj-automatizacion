import { NextResponse } from 'next/server';
import { requireServerSession } from '@/lib/server-auth';
import { createServerUser, listServerUsers } from '@/lib/server-users';

export const runtime = 'nodejs';

export async function GET() {
  if (!await requireServerSession('admin')) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  return NextResponse.json({ users: await listServerUsers() });
}

export async function POST(request: Request) {
  if (!await requireServerSession('admin')) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  try {
    const body = await request.json() as { name?: unknown; email?: unknown; business?: unknown; password?: unknown };
    if (typeof body.name !== 'string' || typeof body.email !== 'string' || typeof body.business !== 'string') return NextResponse.json({ error: 'Completa nombre, correo y negocio.' }, { status: 400 });
    const user = await createServerUser({ name: body.name, email: body.email, business: body.business, password: typeof body.password === 'string' ? body.password : undefined });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo crear el usuario.' }, { status: 400 });
  }
}
