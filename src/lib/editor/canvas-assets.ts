// Carga de imágenes y fuentes para el lienzo (solo navegador). La usan el editor y la exportación,
// así ambos dibujan con los mismos recursos.

const cache = new Map<string, Promise<HTMLImageElement>>();

/** Carga una imagen una sola vez. Las URLs firmadas de Storage necesitan CORS para poder exportar el lienzo. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = cache.get(src);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => { img.onload = img.onerror = null; resolve(img); };
    img.onerror = () => { img.onload = img.onerror = null; cache.delete(src); reject(new Error('No se pudo cargar una imagen del diseño.')); };
    img.src = src;
  });
  cache.set(src, promise);
  return promise;
}

/**
 * La tipografía de Clic llega con next/font, que la publica con un nombre interno en `--font-geist`.
 * El lienzo no entiende variables CSS: aquí se cambia «Geist» por ese nombre real.
 */
export function canvasFont(family: string): string {
  if (typeof document === 'undefined' || !/^\s*['"]?Geist['"]?\s*(,|$)/.test(family)) return family;
  const real = getComputedStyle(document.documentElement).getPropertyValue('--font-geist').trim();
  return real ? family.replace(/^\s*['"]?Geist['"]?/, real) : family;
}

/**
 * Inicia la descarga de un archivo ya preparado como URL de objeto. Quien llama decide cuándo liberar la URL
 * (el editor la conserva para ofrecer también un enlace manual si el navegador bloquea la descarga).
 */
export function startDownload(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.rel = 'noopener'; link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Espera a que las fuentes estén listas: sin esto, la primera exportación podría salir con otra letra. */
export async function waitForFonts(fonts: string[]) {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(fonts.map(font => document.fonts.load(font).catch(() => [])));
  await document.fonts.ready;
}
