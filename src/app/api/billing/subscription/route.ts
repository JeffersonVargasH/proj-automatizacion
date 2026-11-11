import { NextResponse } from 'next/server';
import { requireServerSession } from '@/lib/server-auth';
import { changeServerPlan, getServerSubscription } from '@/lib/server-billing';

export const runtime = 'nodejs';

export async function GET() {
  const session = await requireServerSession();
  if (!session) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  return NextResponse.json({ subscription: await getServerSubscription(session.user.id) });
}

export async function POST(request: Request) {
  const session = await requireServerSession();
  if (!session) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  try {
    const body = await request.json() as { planId?: unknown };
    if (typeof body.planId !== 'string') return NextResponse.json({ error: 'Falta planId.' }, { status: 400 });
    return NextResponse.json({ subscription: await changeServerPlan(session.user.id, body.planId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo cambiar el plan.' }, { status: 400 });
  }
}
