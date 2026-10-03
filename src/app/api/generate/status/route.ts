import { NextResponse } from 'next/server';

const STATUS_WEBHOOK_URL = process.env.N8N_STATUS_WEBHOOK_URL || 'http://localhost:5678/webhook/status';

export async function GET(request: Request) {
  const ticketId = new URL(request.url).searchParams.get('ticket_id');
  if (!ticketId) return NextResponse.json({ error: 'Falta ticket_id.' }, { status: 400 });

  try {
    const target = new URL(STATUS_WEBHOOK_URL);
    target.searchParams.set('ticket_id', ticketId);
    const headers: HeadersInit = {};
    if (process.env.N8N_WEBHOOK_TOKEN) headers['x-creamas-token'] = process.env.N8N_WEBHOOK_TOKEN;
    const response = await fetch(target, { headers, signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data.error || 'n8n no pudo consultar el estado.' }, { status: 502 });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error consultando estado en n8n:', error);
    return NextResponse.json({ error: 'No se pudo consultar el estado de la generación.' }, { status: 502 });
  }
}
