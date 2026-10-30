import { NextResponse } from 'next/server';
import { allow, limits } from '@/lib/rate-limit';
import { audit, requireUser } from '@/lib/supabase/server';

const PUBLISH_WEBHOOK_URL = process.env.N8N_PUBLISH_WEBHOOK_URL || 'http://localhost:5678/webhook/creamas-publish';
const NETWORKS = ['instagram', 'facebook', 'whatsapp'];

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { caller } = guard;
  if (!allow(`publish:${caller.user.id}`, limits.publish.max, limits.publish.windowMs)) return NextResponse.json({ error: 'Hiciste muchas publicaciones seguidas. Espera unos minutos.' }, { status: 429 });
  try {
    const payload = await request.json();
    if (!payload?.requestId || !NETWORKS.includes(payload?.network) || !payload?.image || !payload?.account) {
      return NextResponse.json({ error: 'La solicitud de publicación está incompleta.' }, { status: 400 });
    }
    // Solo se publica lo que es del usuario: RLS devuelve la fila únicamente a su dueño.
    const { data: owned } = await caller.supabase.from('publications').select('id, business_id').eq('id', payload.requestId).maybeSingle();
    if (!owned) return NextResponse.json({ error: 'Esa publicación no existe o no es tuya.' }, { status: 404 });

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (process.env.N8N_WEBHOOK_TOKEN) headers['x-creamas-token'] = process.env.N8N_WEBHOOK_TOKEN;
    const response = await fetch(PUBLISH_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...payload, owner: { userId: caller.user.id, businessId: owned.business_id } }),
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status === 'error') return NextResponse.json({ error: data.error || 'La red no aceptó la publicación. Revisa la cuenta en Mi negocio.' }, { status: 502 });
    await audit(caller, 'sent', 'publish', payload.requestId, { network: payload.network });
    return NextResponse.json({ ...data, status: 'sent' });
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'La publicación tardó demasiado. Inténtalo de nuevo.'
      : 'El servicio de publicación no está disponible en este momento.';
    console.error('Error publicando en n8n:', error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
