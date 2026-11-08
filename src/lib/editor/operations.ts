// Operaciones puras sobre las capas de una escena. Nunca modifican la escena recibida:
// devuelven una nueva, o la misma referencia si no hubo cambios (así el historial no registra pasos vacíos).
import { createId, defaultFont, MAX_LAYERS, MAX_TEXT_LENGTH, type Palette, type ImageLayer, type ImageRole, type Layer, type Scene, type ShapeKind, type ShapeLayer, type TextLayer } from './scene';

type Box = { x: number; y: number; width: number; height: number };
type Common = Partial<Pick<Layer, 'name' | 'rotation' | 'opacity' | 'visible' | 'locked'>> & { id?: string };

export function imageLayer(box: Box, role: ImageRole, src: string, extra: Common & Partial<Pick<ImageLayer, 'fit' | 'cornerRadius'>> = {}): ImageLayer {
  return { id: extra.id ?? createId(), name: extra.name ?? '', ...box, rotation: extra.rotation ?? 0, opacity: extra.opacity ?? 1, visible: extra.visible ?? true, locked: extra.locked ?? false, type: 'image', role, src, fit: extra.fit ?? (role === 'ai-complete' || role === 'ai-background' ? 'cover' : 'contain'), cornerRadius: extra.cornerRadius ?? 0 };
}
export function textLayer(box: Box, extra: Common & Partial<Omit<TextLayer, 'type' | keyof Box | 'id'>> = {}): TextLayer {
  return { id: extra.id ?? createId(), name: extra.name ?? '', ...box, rotation: extra.rotation ?? 0, opacity: extra.opacity ?? 1, visible: extra.visible ?? true, locked: extra.locked ?? false, type: 'text', text: extra.bind ? '' : (extra.text ?? '').slice(0, MAX_TEXT_LENGTH), bind: extra.bind ?? null, fontFamily: extra.fontFamily ?? defaultFont, fontSize: extra.fontSize ?? 48, fontWeight: extra.fontWeight ?? 400, italic: extra.italic ?? false, align: extra.align ?? 'left', verticalAlign: extra.verticalAlign ?? 'top', lineHeight: extra.lineHeight ?? 1.15, fill: extra.fill ?? { token: 'ink' } };
}
export function shapeLayer(box: Box, kind: ShapeKind, extra: Common & Partial<Pick<ShapeLayer, 'fill' | 'stroke' | 'strokeWidth' | 'cornerRadius'>> = {}): ShapeLayer {
  return { id: extra.id ?? createId(), name: extra.name ?? '', ...box, rotation: extra.rotation ?? 0, opacity: extra.opacity ?? 1, visible: extra.visible ?? true, locked: extra.locked ?? false, type: 'shape', kind, fill: extra.fill === undefined ? { token: 'primary' } : extra.fill, stroke: extra.stroke ?? null, strokeWidth: extra.strokeWidth ?? 0, cornerRadius: extra.cornerRadius ?? 0 };
}

export const findLayer = (scene: Scene, id: string): Layer | undefined => scene.layers.find(layer => layer.id === id);
const withLayers = (scene: Scene, layers: Layer[]): Scene => ({ ...scene, layers });

/** Agrega una capa arriba de todo (o en `index`). Si se llegó al límite, la escena no cambia. */
export function addLayer(scene: Scene, layer: Layer, index = scene.layers.length): Scene {
  if (scene.layers.length >= MAX_LAYERS) return scene;
  const ids = new Set(scene.layers.map(item => item.id));
  const safe = ids.has(layer.id) ? { ...layer, id: createId() } : layer;
  const at = Math.max(0, Math.min(scene.layers.length, index));
  return withLayers(scene, [...scene.layers.slice(0, at), safe, ...scene.layers.slice(at)]);
}

// Lo que se puede cambiar aunque la capa esté bloqueada.
const unlockedKeys = new Set(['locked', 'visible', 'name']);

/**
 * Cambia propiedades de una capa. Una capa bloqueada solo acepta `locked`, `visible` y `name`.
 * No permite cambiar `id` ni `type`. El texto de una capa vinculada se edita con `editLayerText` (bindings).
 */
export function updateLayer(scene: Scene, id: string, patch: Partial<Layer>): Scene {
  const index = scene.layers.findIndex(layer => layer.id === id);
  if (index < 0) return scene;
  const current = scene.layers[index];
  const entries = Object.entries(patch).filter(([key]) => key !== 'id' && key !== 'type' && (!current.locked || unlockedKeys.has(key)));
  if (current.type === 'text' && current.bind) {
    const textIndex = entries.findIndex(([key]) => key === 'text');
    if (textIndex >= 0) entries.splice(textIndex, 1);
  }
  const changed = entries.filter(([key, value]) => (current as Record<string, unknown>)[key] !== value);
  if (!changed.length) return scene;
  const next = { ...current, ...Object.fromEntries(changed) } as Layer;
  if (next.type === 'text') next.text = next.bind ? '' : next.text.slice(0, MAX_TEXT_LENGTH);
  if (next.width < 1) next.width = 1;
  if (next.height < 1) next.height = 1;
  next.rotation = ((next.rotation % 360) + 360) % 360;
  next.opacity = Math.min(1, Math.max(0, next.opacity));
  const layers = scene.layers.slice(); layers[index] = next;
  return withLayers(scene, layers);
}

export const moveLayerBy = (scene: Scene, id: string, dx: number, dy: number): Scene => {
  const layer = findLayer(scene, id);
  return layer ? updateLayer(scene, id, { x: layer.x + dx, y: layer.y + dy }) : scene;
};

/** Elimina capas. Las bloqueadas se conservan. */
export function removeLayers(scene: Scene, ids: string[]): Scene {
  const targets = new Set(ids);
  const layers = scene.layers.filter(layer => !targets.has(layer.id) || layer.locked);
  return layers.length === scene.layers.length ? scene : withLayers(scene, layers);
}

/**
 * Duplica capas justo encima de cada original, desplazadas `offset` píxeles.
 * Una copia de una capa vinculada sigue vinculada al mismo campo: muestra el mismo dato, sin duplicarlo.
 * Devuelve también los ids nuevos para seleccionarlos.
 */
export function duplicateLayers(scene: Scene, ids: string[], offset = 24): { scene: Scene; ids: string[] } {
  const targets = new Set(ids);
  const created: string[] = [];
  const layers: Layer[] = [];
  let room = MAX_LAYERS - scene.layers.length;
  for (const layer of scene.layers) {
    layers.push(layer);
    if (targets.has(layer.id) && room > 0) {
      const copy = { ...layer, id: createId(), x: layer.x + offset, y: layer.y + offset, locked: false, name: layer.name ? `${layer.name} (copia)`.slice(0, 60) : '' } as Layer;
      if (copy.type === 'text' && copy.bind) copy.bind = { ...copy.bind };
      layers.push(copy); created.push(copy.id); room -= 1;
    }
  }
  return created.length ? { scene: withLayers(scene, layers), ids: created } : { scene, ids: [] };
}

export type Arrange = 'forward' | 'backward' | 'front' | 'back';
/** Cambia el orden de apilado de una capa. */
export function arrangeLayer(scene: Scene, id: string, where: Arrange): Scene {
  const from = scene.layers.findIndex(layer => layer.id === id);
  if (from < 0) return scene;
  const last = scene.layers.length - 1;
  const to = where === 'front' ? last : where === 'back' ? 0 : where === 'forward' ? Math.min(last, from + 1) : Math.max(0, from - 1);
  return reorderLayer(scene, id, to);
}
/** Mueve una capa a la posición `to` del apilado (0 = fondo). Útil para arrastrar en el panel de capas. */
export function reorderLayer(scene: Scene, id: string, to: number): Scene {
  const from = scene.layers.findIndex(layer => layer.id === id);
  const target = Math.max(0, Math.min(scene.layers.length - 1, Math.round(to)));
  if (from < 0 || from === target) return scene;
  const layers = scene.layers.slice();
  const [layer] = layers.splice(from, 1);
  layers.splice(target, 0, layer);
  return withLayers(scene, layers);
}

export const setVisible = (scene: Scene, id: string, visible: boolean) => updateLayer(scene, id, { visible });
export const setLocked = (scene: Scene, id: string, locked: boolean) => updateLayer(scene, id, { locked });

/** Cambia el fondo del lienzo. */
export function setBackground(scene: Scene, background: Scene['background']): Scene {
  const same = typeof background === 'string' ? scene.background === background : typeof scene.background === 'object' && scene.background.token === background.token;
  return same ? scene : { ...scene, background };
}

/**
 * Reemplaza la paleta de la escena. Solo se usa cuando la persona elige «Aplicar los colores de mi negocio»:
 * cambiar la marca no toca publicaciones anteriores por sí solo.
 */
export function applyPalette(scene: Scene, palette: Palette): Scene {
  const same = (Object.keys(palette) as (keyof Palette)[]).every(key => scene.palette[key] === palette[key]);
  return same ? scene : { ...scene, palette: { ...palette } };
}

/** ¿Hay alguna imagen que ya contiene el producto real? (imagen comercial completa o foto del producto). */
export const containsProduct = (scene: Scene) => scene.layers.some(layer => layer.type === 'image' && (layer.role === 'ai-complete' || layer.role === 'product'));
