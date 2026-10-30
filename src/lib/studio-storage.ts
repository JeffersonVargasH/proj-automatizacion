import type { SupabaseClient } from '@supabase/supabase-js';
import { collectStrings, dataUrlToBlob, diffRows, extensionOf, isDataImage, isMediaRef, mapStrings, mediaPath, mediaPrefix, refFromSignedUrl, sha256 } from './media';
import { mediaBucket, supabaseUrl } from './supabase/env';
import type { Brand, Design } from './studio';

// El borrador en curso vive en IndexedDB (se guarda cada pocos cientos de ms y funciona sin red).
// El negocio y Mis publicaciones viven en Supabase: tablas `businesses` y `publications`.
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('impulsa-studio', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('records');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('No se pudo abrir el almacenamiento del navegador.'));
    req.onblocked = () => reject(new Error('Cierra otras pestañas de Clic y vuelve a intentar.'));
  });
}
async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', mode);
    const req = run(tx.objectStore('records'));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error('No se pudo guardar. Revisa el espacio disponible o los permisos del navegador.')); };
  });
}

type Scope = { supabase: SupabaseClient; userId: string; businessId: string };
let scope: Scope | null = null;
// Contenido (con referencias) de cada publicación tal como está en la base, para subir solo lo que cambió.
let saved = new Map<string, string>();
// data URL → referencia ya subida, para no volver a subir la misma imagen.
const uploaded = new Map<string, string>();
const signedRef = (text: string) => refFromSignedUrl(text, supabaseUrl, mediaBucket);
// Los guardados se encadenan: dos autosaves seguidos no deben pisarse.
let queue: Promise<unknown> = Promise.resolve();
const SIGNED_SECONDS = 60 * 60 * 24 * 7;

function current(): Scope {
  if (!scope) throw new Error('Inicia sesión para guardar tus publicaciones.');
  return scope;
}
const draftKey = () => `${current().userId}:${current().businessId}:draft`;
const fail = (message: string) => (error: { message?: string } | null) => { if (error) throw new Error(`${message} ${friendly(error.message)}`.trim()); };
function friendly(message = '') {
  if (/row-level security|permission/i.test(message)) return 'No tienes permiso para esta acción.';
  if (/fetch|network/i.test(message)) return 'Revisa tu conexión a internet.';
  return '';
}

async function upload(dataUrl: string): Promise<string> {
  const cached = uploaded.get(dataUrl);
  if (cached) return cached;
  const { supabase, userId, businessId } = current();
  const path = `${userId}/${businessId}/${await sha256(dataUrl)}.${extensionOf(dataUrl)}`;
  const blob = dataUrlToBlob(dataUrl);
  const { error } = await supabase.storage.from(mediaBucket).upload(path, blob, { contentType: blob.type, upsert: true, cacheControl: '31536000' });
  fail('No se pudo subir una imagen.')(error);
  const ref = mediaPrefix + path;
  uploaded.set(dataUrl, ref);
  return ref;
}

/** Convierte imágenes a referencias de Storage (subiendo las nuevas) antes de guardar en la base. */
const toStored = <T>(value: T) => mapStrings(value, text => isDataImage(text) || signedRef(text) !== null, async text => signedRef(text) ?? upload(text));

/** Cambia cada referencia por una URL firmada que el navegador y el lienzo pueden mostrar. */
async function toDisplay<T>(value: T): Promise<T> {
  const refs = collectStrings(value, isMediaRef);
  if (!refs.length) return value;
  const { data, error } = await current().supabase.storage.from(mediaBucket).createSignedUrls(refs.map(mediaPath), SIGNED_SECONDS);
  fail('No se pudieron cargar las imágenes.')(error);
  const urls = new Map<string, string>();
  data?.forEach((item, index) => { if (item.signedUrl) urls.set(refs[index], item.signedUrl); });
  return mapStrings(value, text => urls.has(text), async text => urls.get(text)!);
}

export function statusOf(design: Design): 'draft' | 'processing' | 'generated' | 'published' | 'error' {
  if (Object.values(design.publications || {}).some(item => item?.status === 'sent')) return 'published';
  const status = design.generation?.status;
  return status === 'processing' ? 'processing' : status === 'completed' ? 'generated' : status === 'error' ? 'error' : 'draft';
}

async function readHistory(): Promise<Design[]> {
  const { supabase, businessId } = current();
  const { data, error } = await supabase.from('publications').select('id, design').eq('business_id', businessId).order('updated_at', { ascending: false });
  fail('No se pudo cargar Mis publicaciones.')(error);
  saved = new Map((data || []).map(row => [row.id as string, JSON.stringify(row.design)]));
  return toDisplay((data || []).map(row => row.design as Design));
}

async function writeHistory(list: Design[]) {
  const { supabase, userId, businessId } = current();
  const rows = await Promise.all(list.map(async design => { const stored = await toStored(design); return { id: design.id, design: stored, json: JSON.stringify(stored) }; }));
  const { upserts, deletes } = diffRows(saved, rows);
  if (upserts.length) {
    const changed = rows.filter(row => upserts.includes(row.id)).map(row => ({ id: row.id, business_id: businessId, owner_id: userId, title: row.design.title || row.design.product || '', status: statusOf(row.design), design: row.design, created_at: row.design.createdAt }));
    const { error } = await supabase.from('publications').upsert(changed, { onConflict: 'id' });
    fail('No se pudo guardar en Mis publicaciones.')(error);
  }
  if (deletes.length) {
    const { error } = await supabase.from('publications').delete().in('id', deletes);
    fail('No se pudo eliminar la publicación.')(error);
  }
  rows.forEach(row => saved.set(row.id, row.json));
  deletes.forEach(id => saved.delete(id));
}

async function readBrand(): Promise<Brand | undefined> {
  const { supabase, businessId } = current();
  const { data, error } = await supabase.from('businesses').select('name, brand').eq('id', businessId).single();
  fail('No se pudo cargar tu negocio.')(error);
  return data ? toDisplay({ ...(data.brand as Partial<Brand>), name: (data.brand as Partial<Brand>)?.name || data.name } as Brand) : undefined;
}

async function writeBrand(brand: Brand) {
  const { supabase, businessId } = current();
  const stored = await toStored(brand);
  const { error } = await supabase.from('businesses').update({ name: brand.name.trim() || 'Mi negocio', brand: stored }).eq('id', businessId);
  fail('No se pudo guardar el negocio.')(error);
}

function serial<T>(run: () => Promise<T>): Promise<T> {
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

export const storage = {
  /** Apunta el almacenamiento a la cuenta y al negocio activos. */
  configure(next: Scope | null) {
    if (scope?.userId === next?.userId && scope?.businessId === next?.businessId) return;
    scope = next; saved = new Map();
  },
  async get<T>(key: 'brand' | 'draft' | 'history'): Promise<T | undefined> {
    if (key !== 'draft') return serial(() => (key === 'brand' ? readBrand() : readHistory()) as Promise<T>);
    const draft = await transaction<T | undefined>('readonly', s => s.get(draftKey()));
    // El borrador puede guardar URLs firmadas que ya vencieron: se vuelven a firmar al abrirlo.
    const refs = await mapStrings(draft, text => signedRef(text) !== null, async text => signedRef(text)!);
    return toDisplay(refs);
  },
  put(key: 'brand' | 'draft' | 'history', value: Brand | Design | Design[]) {
    if (key === 'draft') return transaction('readwrite', s => s.put(value, draftKey()));
    return serial(() => key === 'brand' ? writeBrand(value as Brand) : writeHistory(value as Design[]));
  },
  removeDraft: () => transaction('readwrite', s => s.delete(draftKey())),
};

/** URL pública temporal de una imagen guardada, para que n8n o Meta puedan descargarla. */
export async function shareableUrl(value: string, seconds = 60 * 60 * 24): Promise<string> {
  const ref = signedRef(value) ?? (isMediaRef(value) ? value : isDataImage(value) ? await upload(value) : null);
  if (!ref) return value;
  const { data, error } = await current().supabase.storage.from(mediaBucket).createSignedUrl(mediaPath(ref), seconds);
  fail('No se pudo preparar la imagen.')(error);
  return data!.signedUrl;
}

export async function readPhoto(file: File, logo = false): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Usa una imagen JPG, PNG o WebP.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Cada imagen debe pesar como máximo 8 MB.');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('No se pudo leer la imagen. Prueba con otra foto.'); });
  try {
    const scale = Math.min(1, (logo ? 400 : 1600) / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('El navegador no puede procesar imágenes.');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(logo || file.type !== 'image/jpeg' ? 'image/png' : 'image/jpeg', 0.86);
  } finally { bitmap.close(); }
}
