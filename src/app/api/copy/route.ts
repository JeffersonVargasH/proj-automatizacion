import { NextResponse } from 'next/server';
import { availableProviders, Copy, copyMessages, CopyRequest, copySchema, sanitizeCopy } from '@/lib/copy';

type Provider = ReturnType<typeof availableProviders>[number];
type Attempt = { copy: Copy } | { retry: boolean; timedOut?: boolean };

async function ask(provider: Provider, messages: ReturnType<typeof copyMessages>, brandHashtags: string): Promise<Attempt> {
  try {
    const response = await fetch(provider.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: 0.9,
        max_completion_tokens: 3000,
        response_format: { type: 'json_schema', json_schema: { name: 'publication_copy', schema: copySchema, strict: true } },
        ...provider.extra,
      }),
      signal: AbortSignal.timeout(25_000),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(`${provider.label} rechazó la solicitud de copy:`, response.status, data?.error || data);
      // Un JSON inválido del modelo es ocasional y vale reintentar; un límite o una clave mala, no.
      return { retry: response.status === 400 && /json/i.test(String(data?.error?.code || data?.error?.message || '')) };
    }
    const content = data?.choices?.[0]?.message?.content;
    const copy = sanitizeCopy(typeof content === 'string' ? JSON.parse(content) : content, { brandHashtags });
    if (copy) return { copy };
    console.error(`${provider.label} devolvió un copy incompleto.`);
    return { retry: true };
  } catch (error) {
    console.error(`Error redactando copy con ${provider.label}:`, error);
    return { retry: error instanceof SyntaxError, timedOut: error instanceof Error && error.name === 'TimeoutError' };
  }
}

export async function POST(request: Request) {
  const providers = availableProviders(process.env);
  if (!providers.length) return NextResponse.json({ error: 'La redacción con IA no está configurada.' }, { status: 503 });
  let input: CopyRequest;
  try { input = await request.json(); } catch { return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 }); }
  if (!input?.product?.trim()) return NextResponse.json({ error: 'Escribe el nombre del producto para redactar el texto.' }, { status: 400 });
  const brandHashtags = input.brandHashtags || '';
  const messages = copyMessages({ ...input, brandHashtags, avoid: input.avoid || '' });

  // Si un proveedor falla (límite del plan gratuito, caída), se intenta el siguiente.
  let timedOut = false;
  for (const provider of providers) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await ask(provider, messages, brandHashtags);
      if ('copy' in result) return NextResponse.json({ copy: result.copy, provider: provider.id, model: provider.model });
      timedOut ||= !!result.timedOut;
      if (!result.retry) break;
    }
  }
  return NextResponse.json({ error: timedOut ? 'La IA tardó demasiado en escribir. Inténtalo de nuevo.' : 'La redacción con IA no está disponible en este momento.' }, { status: 502 });
}
