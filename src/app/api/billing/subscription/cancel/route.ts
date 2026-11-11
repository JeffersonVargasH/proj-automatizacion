import { NextResponse } from 'next/server';
import { requireServerSession } from '@/lib/server-auth';
import { cancelServerSubscription } from '@/lib/server-billing';

export const runtime = 'nodejs';

export async function POST() {
  const session = await requireServerSession();
  if (!session) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  return NextResponse.json({ subscription: await cancelServerSubscription(session.user.id) });
}
