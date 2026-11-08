// Capas nuevas que agrega la persona desde el editor (texto libre, formas e imágenes locales).
// Puro: calcula tamaños y posiciones a partir del lienzo; no toca el DOM.
import { imageLayer, shapeLayer, textLayer } from './operations';
import { defaultFont, type ImageLayer, type Scene, type ShapeKind, type ShapeLayer, type TextLayer } from './scene';

const shapeNames: Record<ShapeKind, string> = { rect: 'Rectángulo', ellipse: 'Círculo', line: 'Línea', badge: 'Etiqueta' };

/** Texto libre centrado, con un tamaño proporcional al lienzo. */
export function newTextLayer(scene: Scene, text = 'Escribe tu texto'): TextLayer {
  const fontSize = Math.round(Math.min(scene.width, scene.height) * 0.06);
  const width = Math.round(scene.width * 0.6);
  const height = Math.ceil(fontSize * 1.15);
  return textLayer({ x: Math.round((scene.width - width) / 2), y: Math.round((scene.height - height) / 2), width, height }, { name: 'Texto', text, fontFamily: defaultFont, fontSize, fontWeight: 700, align: 'center', fill: { token: 'ink' } });
}

/** Forma sencilla centrada con los colores de la escena. */
export function newShapeLayer(scene: Scene, kind: ShapeKind): ShapeLayer {
  const side = Math.round(Math.min(scene.width, scene.height) * 0.3);
  const size = kind === 'line' ? { width: Math.round(scene.width * 0.5), height: 12 }
    : kind === 'badge' ? { width: side, height: Math.round(side * 0.4) }
      : { width: side, height: side };
  const box = { x: Math.round((scene.width - size.width) / 2), y: Math.round((scene.height - size.height) / 2), ...size };
  if (kind === 'line') return shapeLayer(box, 'line', { name: shapeNames.line, fill: null, stroke: { token: 'ink' }, strokeWidth: 8 });
  return shapeLayer(box, kind, { name: shapeNames[kind], fill: { token: 'primary' }, cornerRadius: kind === 'rect' ? 24 : 0 });
}

/**
 * Imagen local centrada que ocupa como máximo el 60 % del lienzo, sin deformarla.
 * La foto se guarda tal cual (ajuste «completa»): no se recorta.
 */
export function newImageLayer(scene: Scene, src: string, natural: { width: number; height: number }, name = 'Imagen'): ImageLayer {
  const nw = Math.max(1, natural.width), nh = Math.max(1, natural.height);
  const scale = Math.min((scene.width * 0.6) / nw, (scene.height * 0.6) / nh);
  const width = Math.max(1, Math.round(nw * scale)), height = Math.max(1, Math.round(nh * scale));
  return imageLayer({ x: Math.round((scene.width - width) / 2), y: Math.round((scene.height - height) / 2), width, height }, 'photo', src, { name: name.slice(0, 60), fit: 'contain' });
}
