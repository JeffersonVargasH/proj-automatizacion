import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getServerSession();
  return session ? NextResponse.json(session) : NextResponse.json({ error: 'No hay una sesión activa.' }, { status: 401 });
}
