import { NextResponse } from 'next/server';
import { validateGenerationRequest } from '@/lib/studio-contract';
import { requireServerSession } from '@/lib/server-auth';
import { registerGenerationJob } from '@/lib/server-jobs';
import { releaseGeneration, reserveGeneration } from '@/lib/server-billing';

const GENERATE_WEBHOOK_URL = process.env.N8N_GENERATE_WEBHOOK_URL || 'http://localhost:5678/webhook/creamas-generate';

export async function POST(request: Request) {
  let reserved = false;
  let accepted = false;
  let ownerId = '';
  try {
    const session = await requireServerSession();
    if (!session) return NextResponse.json({ error: 'Debes iniciar sesión para generar una publicación.' }, { status: 401 });
    ownerId = session.user.id;
    const validation = validateGenerationRequest(await request.json());
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
    const payload = { ...validation.payload, ownerId: session.user.id };
    const reservation = await reserveGeneration(session.user.id);
    if (!reservation.ok) return NextResponse.json({ error: `Alcanzaste el límite mensual de ${reservation.limit} generaciones del plan actual.`, usage: reservation.subscription.generationsUsed, limit: reservation.limit }, { status: 429 });
    reserved = true;

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (process.env.N8N_WEBHOOK_TOKEN) headers['x-creamas-token'] = process.env.N8N_WEBHOOK_TOKEN;
    const response = await fetch(GENERATE_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      await releaseGeneration(session.user.id);
      reserved = false;
      return NextResponse.json({ error: data.error || 'n8n rechazó la solicitud.' }, { status: 502 });
    }

    const ticketId = data.ticket_id || data.ticketId || data.requestId;
    if (!ticketId) {
      await releaseGeneration(session.user.id);
      reserved = false;
      return NextResponse.json({ error: 'n8n no devolvió un ticket_id.' }, { status: 502 });
    }
    await registerGenerationJob(String(ticketId), session.user.id);
    accepted = true;
    return NextResponse.json({ ...data, ticket_id: ticketId });
  } catch (error) {
    if (reserved && !accepted) {
      try { await releaseGeneration(ownerId); } catch { /* Preserve the original error response. */ }
    }
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'n8n tardó demasiado en aceptar la solicitud.'
      : 'No se pudo conectar con n8n. Revisa que Docker esté ejecutándose.';
    console.error('Error iniciando generación en n8n:', error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
