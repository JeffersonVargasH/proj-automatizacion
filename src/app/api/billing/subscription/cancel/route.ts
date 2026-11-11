import { billingResponse, setCancelAtPeriodEnd } from '@/lib/server-billing';
import { requireUser } from '@/lib/supabase/server';

// Cancela al cierre del periodo: el plan sigue vigente hasta fin de mes.
export async function POST() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  return billingResponse(await setCancelAtPeriodEnd(guard.caller.supabase, true));
}
