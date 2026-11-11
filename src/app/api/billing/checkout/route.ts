import { NextResponse } from 'next/server';
import { getPlan } from '@/lib/billing';
import { requireServerSession } from '@/lib/server-auth';
import { getPaymentGateway } from '@/lib/payment-provider';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await requireServerSession();
  if (!session) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  try {
    const body = await request.json() as { planId?: unknown };
    if (typeof body.planId !== 'string') return NextResponse.json({ error: 'Falta planId.' }, { status: 400 });
    const plan = getPlan(body.planId as Parameters<typeof getPlan>[0]);
    if (plan.id === 'free') return NextResponse.json({ error: 'El plan de prueba no requiere checkout.' }, { status: 400 });
    const checkout = await getPaymentGateway().createCheckoutSession({ userId: session.user.id, planId: plan.id, amount: plan.monthlyPrice, currency: 'PEN' });
    return NextResponse.json({ checkout, plan });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo iniciar el checkout.' }, { status: 503 });
  }
}
