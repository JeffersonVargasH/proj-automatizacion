import { billingResponse, setCancelAtPeriodEnd } from '@/lib/server-billing';
import { requireUser } from '@/lib/supabase/server';

// Deshace la cancelación pendiente: el plan se renovará al cierre del periodo.
export async function POST() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  return billingResponse(await setCancelAtPeriodEnd(guard.caller.supabase, false));
}
