import { NextResponse } from 'next/server';
import { requireServerSession } from '@/lib/server-auth';

const PUBLISH_WEBHOOK_URL = process.env.N8N_PUBLISH_WEBHOOK_URL;

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await requireServerSession();
  if (!session) return NextResponse.json({ error: 'Debes iniciar sesión para publicar.' }, { status: 401 });
  if (!PUBLISH_WEBHOOK_URL) return NextResponse.json({ error: 'La publicación todavía no está conectada a n8n.' }, { status: 503 });

  try {
    const body = await request.json() as { designId?: unknown; channel?: unknown; caption?: unknown; title?: unknown; body?: unknown; cta?: unknown; hashtags?: unknown };
    if (body.channel !== 'Facebook') return NextResponse.json({ error: 'La prueba actual solo está habilitada para Facebook.' }, { status: 400 });
    if (typeof body.caption !== 'string' || !body.caption.trim()) return NextResponse.json({ error: 'El texto de la publicación es obligatorio.' }, { status: 400 });

    const payload = {
      requestId: typeof body.designId === 'string' ? body.designId : undefined,
      ownerId: session.user.id,
      channel: 'Facebook',
      caption: body.caption.slice(0, 1500),
      title: typeof body.title === 'string' ? body.title.slice(0, 80) : undefined,
      body: typeof body.body === 'string' ? body.body.slice(0, 180) : undefined,
      cta: typeof body.cta === 'string' ? body.cta.slice(0, 40) : undefined,
      hashtags: typeof body.hashtags === 'string' ? body.hashtags.slice(0, 250) : undefined,
    };
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (process.env.N8N_WEBHOOK_TOKEN) headers['x-creamas-token'] = process.env.N8N_WEBHOOK_TOKEN;
    const response = await fetch(PUBLISH_WEBHOOK_URL, { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000), cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data.error || 'n8n rechazó la publicación.' }, { status: 502 });
    return NextResponse.json({ ...data, channel: 'Facebook', status: 'sent' });
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError' ? 'n8n tardó demasiado en publicar.' : 'No se pudo conectar con n8n. Revisa que Docker y el workflow estén activos.';
    console.error('Error publicando en Facebook mediante n8n:', error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
