import { NextResponse } from 'next/server';
import { billingResponse, changePlanTest, getSubscription } from '@/lib/server-billing';
import { requireUser } from '@/lib/supabase/server';

export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  return billingResponse(await getSubscription(guard.caller.supabase));
}

// Cambio de plan en modo pruebas (no hay cobros). Con una pasarela real lo confirmará su webhook.
export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => null) as { planId?: unknown } | null;
  if (typeof body?.planId !== 'string') return NextResponse.json({ error: 'Falta el plan.' }, { status: 400 });
  return billingResponse(await changePlanTest(guard.caller.supabase, body.planId));
}
