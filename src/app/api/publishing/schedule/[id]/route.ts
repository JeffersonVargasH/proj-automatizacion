import { NextResponse } from 'next/server';
import { billingSetupMessage, isBillingSchemaMissing } from '@/lib/billing';
import { scheduledPostFromRow, type ScheduledPostRow } from '@/lib/publishing';
import { requireUser } from '@/lib/supabase/server';

// Cancela una publicación programada propia (queda registrada como cancelada).
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Publicación no encontrada.' }, { status: 404 });
  const { data, error } = await guard.caller.supabase.rpc('cancel_scheduled_post', { p_id: id });
  if (error) return isBillingSchemaMissing(error) ? NextResponse.json({ error: billingSetupMessage, setupRequired: true }, { status: 503 }) : NextResponse.json({ error: 'No se pudo cancelar.' }, { status: 400 });
  // La función devuelve una fila vacía si no existe, no es tuya o ya no estaba pendiente.
  const row = data as ScheduledPostRow | null;
  return row?.id ? NextResponse.json({ post: scheduledPostFromRow(row) }) : NextResponse.json({ error: 'Publicación no encontrada.' }, { status: 404 });
}
