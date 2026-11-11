import { NextResponse } from 'next/server';
import { requireServerSession } from '@/lib/server-auth';
import { importServerUsers } from '@/lib/server-users';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!await requireServerSession('admin')) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  try {
    const body = await request.json() as { csv?: unknown };
    if (typeof body.csv !== 'string' || !body.csv.trim()) return NextResponse.json({ error: 'Pega al menos una fila de usuarios.' }, { status: 400 });
    return NextResponse.json(await importServerUsers(body.csv));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudieron importar los usuarios.' }, { status: 400 });
  }
}
