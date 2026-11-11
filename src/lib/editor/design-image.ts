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

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo preparar la imagen.'));
    reader.readAsDataURL(blob);
  });
}
