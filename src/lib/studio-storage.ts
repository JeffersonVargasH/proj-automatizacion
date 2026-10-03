import type { Brand, Design } from './studio';

// IndexedDB keeps product photos out of localStorage's small string quota.
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
let storageScope = 'guest';
function scopedKey(key: string) { return `${storageScope}:${key}`; }
export const storage = {
  setScope: (scope: string) => { storageScope = scope.trim() || 'guest'; },
  get: <T>(key: string) => transaction<T | undefined>('readonly', s => s.get(scopedKey(key))),
  put: (key: string, value: Brand | Design | Design[]) => transaction('readwrite', s => s.put(value, scopedKey(key))),
  remove: (key: string) => transaction('readwrite', s => s.delete(scopedKey(key))),
};

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
