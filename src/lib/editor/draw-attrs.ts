// Atributos de dibujo de cada capa, compartidos por el lienzo interactivo y la exportación PNG.
// Que ambos usen exactamente estas funciones es lo que garantiza que la imagen exportada
// coincide con lo que se ve en el editor. Puro: no importa Konva ni toca el DOM.
import { resolveLayerText, type CommercialValues } from './bindings';
import { resolvePaint, type ImageLayer, type Layer, type Palette, type Scene, type ShapeLayer, type TextLayer } from './scene';

const TRANSPARENT = 'rgba(0,0,0,0)';

/** Grupo que contiene cada capa: posición, giro y visibilidad. La rotación es alrededor de la esquina superior izquierda. */
export function groupAttrs(layer: Layer) {
  return { id: layer.id, name: 'layer', x: layer.x, y: layer.y, rotation: layer.rotation, opacity: layer.opacity, visible: layer.visible };
}

/** Rectángulo invisible del tamaño de la capa: da al marco de selección el tamaño real de la caja. */
export function hitAttrs(layer: Layer) {
  return { x: 0, y: 0, width: layer.width, height: layer.height, fill: TRANSPARENT, strokeEnabled: false, name: 'hit' };
}

export function backgroundAttrs(scene: Scene) {
  return { x: 0, y: 0, width: scene.width, height: scene.height, fill: resolvePaint(scene.background, scene.palette) ?? '#ffffff', listening: true, name: 'background' };
}

/** Traduce una familia tipográfica del modelo a la que puede usar el lienzo (por ejemplo, la de next/font). */
export type FontResolver = (family: string) => string;

export function textAttrs(layer: TextLayer, palette: Palette, values: CommercialValues, font: FontResolver = family => family) {
  const style = [layer.italic ? 'italic' : '', layer.fontWeight === 700 ? 'bold' : ''].filter(Boolean).join(' ') || 'normal';
  return {
    x: 0, y: 0, width: layer.width, height: layer.height,
    text: resolveLayerText(layer, values),
    fontFamily: font(layer.fontFamily), fontSize: layer.fontSize, fontStyle: style,
    align: layer.align, verticalAlign: layer.verticalAlign, lineHeight: layer.lineHeight,
    fill: resolvePaint(layer.fill, palette) ?? '#000000',
    // El texto que no cabe en la caja se corta con «…» igual en pantalla y al exportar.
    wrap: 'word', ellipsis: true, listening: false,
  };
}

export type ShapeDraw =
  | { kind: 'rect'; attrs: { x: number; y: number; width: number; height: number; cornerRadius: number; fill: string; stroke: string; strokeWidth: number; listening: false } }
  | { kind: 'ellipse'; attrs: { x: number; y: number; radiusX: number; radiusY: number; fill: string; stroke: string; strokeWidth: number; listening: false } }
  | { kind: 'line'; attrs: { points: number[]; stroke: string; strokeWidth: number; lineCap: 'round'; listening: false } };

export function shapeAttrs(layer: ShapeLayer, palette: Palette): ShapeDraw {
  const fill = resolvePaint(layer.fill, palette) ?? TRANSPARENT;
  const stroke = resolvePaint(layer.stroke, palette) ?? TRANSPARENT;
  const strokeWidth = layer.stroke ? layer.strokeWidth : 0;
  const { width, height } = layer;
  if (layer.kind === 'ellipse') return { kind: 'ellipse', attrs: { x: width / 2, y: height / 2, radiusX: width / 2, radiusY: height / 2, fill, stroke, strokeWidth, listening: false } };
  if (layer.kind === 'line') {
    // Una línea usa su contorno; si no tiene, usa el color de relleno y el alto de la caja como grosor.
    return { kind: 'line', attrs: { points: [0, height / 2, width, height / 2], stroke: layer.stroke ? stroke : fill, strokeWidth: layer.stroke ? Math.max(1, layer.strokeWidth) : Math.max(1, height), lineCap: 'round', listening: false } };
  }
  const radius = layer.kind === 'badge' ? Math.min(width, height) / 2 : Math.min(layer.cornerRadius, width / 2, height / 2);
  return { kind: 'rect', attrs: { x: 0, y: 0, width, height, cornerRadius: radius, fill, stroke, strokeWidth, listening: false } };
}

/**
 * Posición y recorte de una imagen dentro de su caja.
 * - `contain`: la imagen completa, centrada (la foto del producto nunca se recorta).
 * - `cover`: llena la caja recortando lo que sobra, centrado.
 */
export function imageAttrs(layer: ImageLayer, natural: { width: number; height: number }) {
  const { width, height } = layer;
  const nw = Math.max(1, natural.width), nh = Math.max(1, natural.height);
  if (layer.fit === 'cover') {
    const scale = Math.max(width / nw, height / nh);
    const cropWidth = width / scale, cropHeight = height / scale;
    return { x: 0, y: 0, width, height, crop: { x: (nw - cropWidth) / 2, y: (nh - cropHeight) / 2, width: cropWidth, height: cropHeight }, cornerRadius: Math.min(layer.cornerRadius, width / 2, height / 2), listening: false };
  }
  const scale = Math.min(width / nw, height / nh);
  const w = nw * scale, h = nh * scale;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h, crop: undefined, cornerRadius: Math.min(layer.cornerRadius, w / 2, h / 2), listening: false };
}

/** Fuentes que usa una escena, para esperar a que carguen antes de dibujar. */
export function fontsOf(scene: Scene, font: FontResolver = family => family): string[] {
  const set = new Set<string>();
  for (const layer of scene.layers) if (layer.type === 'text' && layer.visible) set.add(`${layer.italic ? 'italic ' : ''}${layer.fontWeight} ${Math.round(layer.fontSize)}px ${font(layer.fontFamily)}`);
  return [...set];
}

/** Rutas de imagen visibles de una escena, para cargarlas antes de exportar. */
export const imageSourcesOf = (scene: Scene) => [...new Set(scene.layers.filter((layer): layer is ImageLayer => layer.type === 'image' && layer.visible).map(layer => layer.src))];

// ───────────── Redimensionar textos ─────────────

/** Límites al redimensionar un texto desde el lienzo. */
export const textLimits = { minFont: 8, maxFont: 600, minWidth: 24, maxWidth: 4000 } as const;

/** Qué control del marco se está usando: esquinas (escala la letra) o laterales (cambia el ancho). */
export function anchorKind(anchor: string | null | undefined): 'corner' | 'side' | 'other' {
  if (anchor && /^(top|bottom)-(left|right)$/.test(anchor)) return 'corner';
  if (anchor === 'middle-left' || anchor === 'middle-right') return 'side';
  return 'other';
}

export type TextBox = { width: number; height: number; fontSize: number };

/**
 * Nuevo tamaño de un texto después de un paso de transformación.
 * - Esquinas: la letra y la caja crecen o se reducen en la misma proporción (sin deformar).
 * - Laterales: cambia solo el ancho, para controlar el ajuste de líneas; el alto se ajusta al contenido
 *   con `measureHeight` (si no se indica, se conserva).
 * El resultado no lleva escala: así no se acumulan escalas que deformen el texto en ediciones siguientes.
 */
export function resizeTextBox(box: TextBox, scale: { scaleX: number; scaleY: number }, kind: 'corner' | 'side' | 'other', measureHeight?: (width: number, fontSize: number) => number): TextBox {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  if (kind === 'corner') {
    const requested = (Math.abs(scale.scaleX) + Math.abs(scale.scaleY)) / 2;
    const fontSize = Math.round(clamp(box.fontSize * requested, textLimits.minFont, textLimits.maxFont) * 10) / 10;
    const factor = fontSize / box.fontSize;
    return { fontSize, width: clamp(box.width * factor, textLimits.minWidth, textLimits.maxWidth), height: Math.max(1, box.height * factor) };
  }
  if (kind === 'side') {
    const width = clamp(box.width * Math.abs(scale.scaleX), textLimits.minWidth, textLimits.maxWidth);
    return { fontSize: box.fontSize, width, height: measureHeight ? Math.max(1, measureHeight(width, box.fontSize)) : box.height };
  }
  return box;
}

/** Convierte el resultado de una transformación (escala del grupo) en tamaño de caja (imágenes y formas). */
export function boxFromTransform(layer: Layer, node: { x: number; y: number; rotation: number; scaleX: number; scaleY: number }): Partial<Layer> {
  return {
    x: node.x, y: node.y, rotation: node.rotation,
    width: Math.max(1, Math.round(layer.width * Math.abs(node.scaleX))),
    height: Math.max(1, Math.round(layer.height * Math.abs(node.scaleY))),
  };
}
