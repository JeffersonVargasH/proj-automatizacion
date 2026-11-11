import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateTicketId } from '@/lib/studio-contract';
import { requireUser } from '@/lib/supabase/server';

const STATUS_WEBHOOK_URL = process.env.N8N_STATUS_WEBHOOK_URL || 'http://localhost:5678/webhook/status';

/**
 * ¿El trabajo de IA es de quien pregunta? El ticket suele ser el id de su publicación; si n8n devolvió
 * otro, /api/generate lo dejó en su auditoría. Ambas consultas pasan por RLS: solo ven lo propio.
 */
async function ownsTicket(supabase: SupabaseClient, ticketId: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketId);
  if (isUuid) {
    const { data } = await supabase.from('publications').select('id').eq('id', ticketId).maybeSingle();
    if (data) return true;
  }
  const { data } = await supabase.from('activity_log').select('id').eq('entity', 'generation').eq('details->>ticket', ticketId).limit(1);
  return !!data?.length;
}

export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const ticketId = validateTicketId(new URL(request.url).searchParams.get('ticket_id'));
  if (!ticketId) return NextResponse.json({ error: 'Falta un ticket_id válido.' }, { status: 400 });
  if (!await ownsTicket(guard.caller.supabase, ticketId)) return NextResponse.json({ error: 'No tienes acceso a esta generación.' }, { status: 403 });

  try {
    const target = new URL(STATUS_WEBHOOK_URL);
    target.searchParams.set('ticket_id', ticketId);
    const headers: HeadersInit = {};
    if (process.env.N8N_WEBHOOK_TOKEN) headers['x-creamas-token'] = process.env.N8N_WEBHOOK_TOKEN;
    const response = await fetch(target, { headers, signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data.error || 'No se pudo consultar el avance de la generación.' }, { status: 502 });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error consultando estado en n8n:', error);
    return NextResponse.json({ error: 'No se pudo consultar el estado de la generación.' }, { status: 502 });
  }
}
