// Imagen final de una publicación para una red (solo navegador).
// Regla única para vista previa, miniaturas, descargas y publicación:
// - con escena del editor visual → se dibuja con Konva (igual que el editor; si falla, se muestra el error);
// - sin escena (diseños anteriores) → renderizador clásico, como siempre.
import type { Design, Network } from '../studio';
import { pngBlob, renderDesign } from '../studio-renderer';
import { createDesignExporter } from './export';

const exporter = createDesignExporter<Blob>({
  legacy: async design => {
    const generated = design.generation?.status === 'completed' ? design.generation.urls[design.format as Network] : undefined;
    return pngBlob(await renderDesign(design, generated));
  },
  scene: async (scene, values) => {
    const { renderSceneToBlob } = await import('./konva-export');
    return renderSceneToBlob(scene, values);
  },
});

export const designImageBlob = (design: Design, network: Network) => exporter.render(design, network);

/**
 * Copia reducida de la foto del producto para que la IA la mejore (FLUX.2 acepta como máximo 512 px por lado).
 * Acepta data URLs y URLs firmadas de Storage (que permiten CORS, igual que en el editor).
 */
export async function referencePhoto(src: string, maxSide = 512): Promise<string> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = src;
  await image.decode().catch(() => { throw new Error('No se pudo leer la foto del producto para mejorarla.'); });
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no puede procesar imágenes.');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.92);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo preparar la imagen.'));
    reader.readAsDataURL(blob);
  });
}
