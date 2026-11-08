// Medición de textos con Konva (solo navegador). La usan el lienzo (redimensionar desde un lateral,
// editar sobre el lienzo) y los paneles (editar el contenido), para que las cajas crezcan igual en ambos.
import Konva from 'konva';
import { canvasFont } from './canvas-assets';
import type { TextLayer } from './scene';

/** Alto que necesita `text` con el ancho, la letra y el interlineado de la capa. */
export function measureTextHeight(layer: Pick<TextLayer, 'fontFamily' | 'fontSize' | 'fontWeight' | 'italic' | 'lineHeight' | 'width'>, text: string): number {
  const fontStyle = [layer.italic ? 'italic' : '', layer.fontWeight === 700 ? 'bold' : ''].filter(Boolean).join(' ') || 'normal';
  const probe = new Konva.Text({ text: text || ' ', fontFamily: canvasFont(layer.fontFamily), fontStyle, fontSize: layer.fontSize, lineHeight: layer.lineHeight, width: layer.width, wrap: 'word' });
  const height = probe.height();
  probe.destroy();
  return height;
}
