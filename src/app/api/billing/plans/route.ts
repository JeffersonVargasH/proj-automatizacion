import { NextResponse } from 'next/server';
import { plans } from '@/lib/billing';
import { requireServerSession } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function GET() {
  if (!await requireServerSession()) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  return NextResponse.json({ plans });
}
