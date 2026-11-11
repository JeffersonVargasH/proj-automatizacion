type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}

function text(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

export type GenerationRequest = RecordValue & {
  requestId: string;
  product: RecordValue & { name: string; images: string[] };
};

export function validateGenerationRequest(value: unknown): { ok: true; payload: GenerationRequest } | { ok: false; error: string } {
  const payload = record(value);
  const product = payload && record(payload.product);
  const images = product?.images;

  if (!payload || !text(payload.requestId, 120)) return { ok: false, error: 'requestId es obligatorio.' };
  if (!product || !text(product.name, 80)) return { ok: false, error: 'El producto debe tener un nombre válido.' };
  if (!Array.isArray(images) || images.length < 1 || images.length > 3 || images.some(image => !text(image, 12_000_000))) {
    return { ok: false, error: 'El producto debe incluir entre una y tres imágenes válidas.' };
  }

  const content = record(payload.content);
  if (!content || !text(content.format, 30)) return { ok: false, error: 'Faltan los datos de formato de la publicación.' };
  return { ok: true, payload: payload as GenerationRequest };
}

export function validateTicketId(value: string | null): string | null {
  const ticket = value?.trim() || '';
  return ticket && ticket.length <= 160 ? ticket : null;
}
