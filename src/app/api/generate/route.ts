import { NextResponse } from 'next/server';
import { allow, limits } from '@/lib/rate-limit';
import { audit, requireUser } from '@/lib/supabase/server';

const GENERATE_WEBHOOK_URL = process.env.N8N_GENERATE_WEBHOOK_URL || 'http://localhost:5678/webhook/creamas-generate';

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { caller } = guard;
  if (!allow(`generate:${caller.user.id}`, limits.generate.max, limits.generate.windowMs)) return NextResponse.json({ error: 'Llegaste al límite de generaciones por ahora. Espera unos minutos.' }, { status: 429 });
  try {
    const payload = await request.json();
    if (!payload?.requestId || !payload?.product) {
      return NextResponse.json({ error: 'La solicitud de generación está incompleta.' }, { status: 400 });
    }
    // La publicación debe existir y ser del usuario; así n8n sabe a qué negocio pertenece.
    const { data: owned } = await caller.supabase.from('publications').select('id, business_id').eq('id', payload.requestId).maybeSingle();
    if (!owned) return NextResponse.json({ error: 'Guarda la publicación antes de generarla.' }, { status: 404 });

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (process.env.N8N_WEBHOOK_TOKEN) headers['x-creamas-token'] = process.env.N8N_WEBHOOK_TOKEN;
    const response = await fetch(GENERATE_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...payload, owner: { userId: caller.user.id, businessId: owned.business_id } }),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data.error || 'El generador con IA no aceptó la solicitud. Inténtalo de nuevo.' }, { status: 502 });

    const ticketId = data.ticket_id || data.ticketId || data.requestId;
    if (!ticketId) return NextResponse.json({ error: 'El generador con IA respondió de forma inesperada. Inténtalo de nuevo.' }, { status: 502 });
    await audit(caller, 'started', 'generation', payload.requestId, { ticket: String(ticketId) });
    return NextResponse.json({ ...data, ticket_id: ticketId });
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'El generador con IA tardó demasiado en responder. Inténtalo de nuevo.'
      : 'El generador con IA no está disponible en este momento.';
    console.error('Error iniciando generación en n8n:', error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
