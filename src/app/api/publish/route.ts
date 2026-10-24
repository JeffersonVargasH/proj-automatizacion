import { NextResponse } from 'next/server';

const PUBLISH_WEBHOOK_URL = process.env.N8N_PUBLISH_WEBHOOK_URL || 'http://localhost:5678/webhook/creamas-publish';
const NETWORKS = ['instagram', 'facebook', 'whatsapp'];

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    if (!payload?.requestId || !NETWORKS.includes(payload?.network) || !payload?.image || !payload?.account) {
      return NextResponse.json({ error: 'La solicitud de publicación está incompleta.' }, { status: 400 });
    }

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (process.env.N8N_WEBHOOK_TOKEN) headers['x-creamas-token'] = process.env.N8N_WEBHOOK_TOKEN;
    const response = await fetch(PUBLISH_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status === 'error') return NextResponse.json({ error: data.error || 'La red no aceptó la publicación. Revisa la cuenta en Mi negocio.' }, { status: 502 });
    return NextResponse.json({ ...data, status: 'sent' });
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'La publicación tardó demasiado. Inténtalo de nuevo.'
      : 'El servicio de publicación no está disponible en este momento.';
    console.error('Error publicando en n8n:', error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
