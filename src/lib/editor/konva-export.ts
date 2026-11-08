// Exportación de escenas a PNG con Konva (solo navegador; se importa de forma dinámica).
// Usa los mismos atributos de dibujo que el lienzo del editor (`draw-attrs.ts`), por lo que la imagen
// exportada coincide con la que se ve. Si algo falla, lanza el error: nunca se cambia en silencio
// al renderizador clásico.
import Konva from 'konva';
import type { CommercialValues } from './bindings';
import { canvasFont, loadImage, waitForFonts } from './canvas-assets';
import { backgroundAttrs, fontsOf, groupAttrs, imageAttrs, imageSourcesOf, shapeAttrs, textAttrs } from './draw-attrs';
import type { SceneRenderer } from './export';
import type { Scene } from './scene';

export class SceneExportError extends Error {
  constructor(message: string, cause?: unknown) { super(message, { cause }); this.name = 'SceneExportError'; }
}

/** Dibuja una escena a su tamaño real (por ejemplo 1080×1920) en un lienzo nuevo. */
export async function renderSceneToCanvas(scene: Scene, values: CommercialValues): Promise<HTMLCanvasElement> {
  await waitForFonts(fontsOf(scene, canvasFont));
  let images: Map<string, HTMLImageElement>;
  try {
    images = new Map(await Promise.all(imageSourcesOf(scene).map(async src => [src, await loadImage(src)] as const)));
  } catch (error) {
    throw new SceneExportError('No se pudo exportar: una imagen del diseño no cargó. Revisa tu conexión e inténtalo de nuevo.', error);
  }
  const container = document.createElement('div');
  const stage = new Konva.Stage({ container, width: scene.width, height: scene.height });
  try {
    const layer = new Konva.Layer({ listening: false });
    stage.add(layer);
    layer.add(new Konva.Rect(backgroundAttrs(scene)));
    for (const item of scene.layers) {
      if (!item.visible) continue;
      const group = new Konva.Group(groupAttrs(item));
      if (item.type === 'text') group.add(new Konva.Text(textAttrs(item, scene.palette, values, canvasFont)));
      else if (item.type === 'shape') {
        const draw = shapeAttrs(item, scene.palette);
        group.add(draw.kind === 'ellipse' ? new Konva.Ellipse(draw.attrs) : draw.kind === 'line' ? new Konva.Line(draw.attrs) : new Konva.Rect(draw.attrs));
      } else {
        const image = images.get(item.src);
        if (!image) throw new SceneExportError('No se pudo exportar: falta una imagen del diseño.');
        group.add(new Konva.Image({ image, ...imageAttrs(item, { width: image.naturalWidth, height: image.naturalHeight }) }));
      }
      layer.add(group);
    }
    layer.draw();
    return stage.toCanvas({ pixelRatio: 1 });
  } catch (error) {
    if (error instanceof SceneExportError) throw error;
    // Un lienzo «contaminado» (imagen sin CORS) o un error de dibujo terminan aquí.
    throw new SceneExportError('No se pudo exportar el diseño editado.', error);
  } finally {
    stage.destroy();
  }
}

export async function renderSceneToBlob(scene: Scene, values: CommercialValues): Promise<Blob> {
  const canvas = await renderSceneToCanvas(scene, values);
  try {
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('empty'))), 'image/png'));
  } catch (error) {
    throw new SceneExportError('No se pudo exportar el diseño editado.', error);
  }
}

/** Renderizador de escenas listo para `createDesignExporter`. */
export const scenePngRenderer: SceneRenderer<Blob> = renderSceneToBlob;
