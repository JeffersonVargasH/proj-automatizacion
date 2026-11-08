// Interfaz de exportación desacoplada. Todavía no está conectada a la app: la vista previa, las miniaturas,
// las descargas y la publicación siguen usando `renderDesign` de `lib/studio-renderer.ts`.
// El renderizador de escenas (Konva, `konva-export.ts`) se inyecta aquí sin cambiar a quien exporta.
//
// Regla: el renderizador clásico solo se usa cuando la red no tiene una escena editable válida.
// Si hay escena y falla su dibujo (o no hay renderizador de escenas), se lanza el error: nunca se
// exporta en silencio una imagen distinta de la que la persona editó.
import type { Design, Network } from '../studio';
import type { CommercialValues } from './bindings';
import { designValues, sceneFor } from './design-scenes';
import type { Scene } from './scene';

/** Lo que necesita cualquier renderizador de escenas. Los textos vinculados se leen de `values`. */
export type SceneRenderer<Output> = (scene: Scene, values: CommercialValues) => Promise<Output>;
/** El renderizador clásico actual (`renderDesign`). */
export type LegacyRenderer<Output> = (design: Design) => Promise<Output>;

/** Nombre del PNG descargado, por ejemplo `clic-instagram-2026-11-07-1530.png` (hora local). */
export function exportFilename(format: Network, date: Date): string {
  const two = (value: number) => String(value).padStart(2, '0');
  return `clic-${format}-${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}-${two(date.getHours())}${two(date.getMinutes())}.png`;
}

export class SceneRendererMissingError extends Error {
  constructor() { super('Este diseño tiene cambios en el editor visual y todavía no se puede exportar desde aquí.'); this.name = 'SceneRendererMissingError'; }
}

export type DesignExporter<Output> = {
  /** Dibuja la versión de una red: con su escena si existe; si no hay escena, con el clásico. */
  render(design: Design, network: Network): Promise<Output>;
  /** Qué camino se usaría, sin dibujar (útil para avisos y pruebas). */
  source(design: Design, network: Network): 'scene' | 'legacy';
};

export function createDesignExporter<Output>({ legacy, scene }: { legacy: LegacyRenderer<Output>; scene?: SceneRenderer<Output> | null }): DesignExporter<Output> {
  return {
    source: (design, network) => (sceneFor(design, network) ? 'scene' : 'legacy'),
    async render(design, network) {
      const found = sceneFor(design, network);
      if (!found) return legacy({ ...design, format: network });
      if (!scene) throw new SceneRendererMissingError();
      return scene(found, designValues(design));
    },
  };
}
