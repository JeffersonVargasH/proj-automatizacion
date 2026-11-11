import { NextResponse } from 'next/server';
import { plans } from '@/lib/billing';
import { getPaymentGateway } from '@/lib/payment-provider';
import { requireUser } from '@/lib/supabase/server';

// Contrato de checkout. Con PAYMENT_PROVIDER=test no se cobra nada; una pasarela real deberá añadir
// webhooks firmados, idempotencia y la confirmación del pago antes de activar el plan.
export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => null) as { planId?: unknown } | null;
  const plan = plans.find(item => item.id === body?.planId);
  if (!plan) return NextResponse.json({ error: 'El plan seleccionado no existe.' }, { status: 400 });
  if (plan.id === 'free') return NextResponse.json({ error: 'El plan de prueba no requiere pago.' }, { status: 400 });
  try {
    const checkout = await getPaymentGateway().createCheckoutSession({ userId: guard.caller.user.id, planId: plan.id, amount: plan.monthlyPrice, currency: 'PEN' });
    return NextResponse.json({ checkout, plan });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo iniciar el pago.' }, { status: 503 });
  }
}
