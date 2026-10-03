import { NextResponse } from 'next/server';

const GENERATE_WEBHOOK_URL = process.env.N8N_GENERATE_WEBHOOK_URL || 'http://localhost:5678/webhook/creamas-generate';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    if (!payload?.requestId || !payload?.product) {
      return NextResponse.json({ error: 'La solicitud de generación está incompleta.' }, { status: 400 });
    }

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
    if (!response.ok) return NextResponse.json({ error: data.error || 'n8n rechazó la solicitud.' }, { status: 502 });

    const ticketId = data.ticket_id || data.ticketId || data.requestId;
    if (!ticketId) return NextResponse.json({ error: 'n8n no devolvió un ticket_id.' }, { status: 502 });
    return NextResponse.json({ ...data, ticket_id: ticketId });
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'n8n tardó demasiado en aceptar la solicitud.'
      : 'No se pudo conectar con n8n. Revisa que Docker esté ejecutándose.';
    console.error('Error iniciando generación en n8n:', error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
