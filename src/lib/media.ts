// Las imágenes viajan por la app como data URLs o URLs firmadas, pero en la base de datos
// se guardan como referencias estables a Supabase Storage (`clic-media://<ruta>`).
export const mediaPrefix = 'clic-media://';

export const isMediaRef = (value: string) => value.startsWith(mediaPrefix);
export const mediaPath = (ref: string) => ref.slice(mediaPrefix.length);
export const isDataImage = (value: string) => /^data:image\/(png|jpeg|webp);base64,/.test(value);

/** Reconoce una URL firmada de nuestro bucket y devuelve su referencia estable (o null). */
export function refFromSignedUrl(text: string, baseUrl: string, bucket: string): string | null {
  const prefix = `${baseUrl.replace(/\/$/, '')}/storage/v1/object/sign/${bucket}/`;
  if (!baseUrl || !text.startsWith(prefix)) return null;
  return mediaPrefix + decodeURIComponent(text.slice(prefix.length).split('?')[0]);
}

/** Recorre objetos y listas y reemplaza cada texto que cumpla `match`. Devuelve una copia. */
export async function mapStrings<T>(value: T, match: (text: string) => boolean, replace: (text: string) => Promise<string>): Promise<T> {
  const found = new Set<string>();
  collect(value, match, found);
  if (!found.size) return value;
  const entries = await Promise.all([...found].map(async text => [text, await replace(text)] as const));
  const table = new Map(entries);
  return swap(value, table) as T;
}

export function collectStrings(value: unknown, match: (text: string) => boolean): string[] {
  const found = new Set<string>();
  collect(value, match, found);
  return [...found];
}

function collect(value: unknown, match: (text: string) => boolean, found: Set<string>) {
  if (typeof value === 'string') { if (match(value)) found.add(value); return; }
  if (Array.isArray(value)) { value.forEach(item => collect(item, match, found)); return; }
  if (value && typeof value === 'object') Object.values(value).forEach(item => collect(item, match, found));
}

function swap(value: unknown, table: Map<string, string>): unknown {
  if (typeof value === 'string') return table.get(value) ?? value;
  if (Array.isArray(value)) return value.map(item => swap(item, table));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, swap(item, table)]));
  return value;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const type = head.slice(5, head.indexOf(';'));
  const bytes = Uint8Array.from(atob(body), char => char.charCodeAt(0));
  return new Blob([bytes], { type });
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export const extensionOf = (dataUrl: string) => dataUrl.slice(11, dataUrl.indexOf(';')).replace('jpeg', 'jpg');

/** Qué filas cambiaron respecto de lo último guardado. Compara el contenido ya convertido a referencias. */
export function diffRows(saved: Map<string, string>, next: { id: string; json: string }[]) {
  const ids = new Set(next.map(row => row.id));
  return {
    upserts: next.filter(row => saved.get(row.id) !== row.json).map(row => row.id),
    deletes: [...saved.keys()].filter(id => !ids.has(id)),
  };
}
