// Plantillas básicas: crean la primera escena editable de cada formato a partir del contenido del diseño.
// Los textos comerciales siempre se crean como capas vinculadas (nunca se copian dentro de la escena)
// y el producto real nunca se duplica sobre una imagen de IA que ya lo contiene.
import { defaultFont, emptyScene, isSafeImageSrc, sceneFormats, type Layer, type Palette, type Scene, type SceneFormat } from './scene';
import { imageLayer, shapeLayer, textLayer } from './operations';
import type { CommercialValues } from './bindings';

/**
 * Imagen de partida generada con IA:
 * - `complete`: imagen comercial completa; ya muestra el producto, así que no se agrega la foto real encima.
 * - `background`: fondo preparado para componer; la foto real del producto se coloca encima.
 */
export type BaseImage = { src: string; kind: 'complete' | 'background' };

export type TemplateInput = {
  /** Snapshot de los colores de la marca (ver `paletteFrom`). */
  palette: Palette;
  brandName: string;
  logo?: string;
  /** Redes y dirección del negocio, en una línea. */
  footer?: string;
  /** Solo se usan para decidir qué capas opcionales crear (precio, vigencia); el texto no se copia. */
  values: CommercialValues;
  /** Foto real del producto, sin alterar. */
  product?: string;
  base?: BaseImage;
  fontFamily?: string;
};

/** Rectángulo en fracciones del lienzo (0 a 1). */
type Rect = [x: number, y: number, width: number, height: number];
type Slots = {
  /** Zona de la imagen de IA (completa o fondo). */
  base: Rect;
  /** Zona de la foto real cuando no hay IA. */
  product: Rect;
  /** Zona de la foto real sobre un fondo de IA. */
  productOnBase: Rect;
  /** Franja detrás del texto cuando la imagen ocupa todo el lienzo (null: no hace falta). */
  scrim: Rect | null;
  /** Panel liso detrás de la columna de texto (null: no hay). */
  panel: Rect | null;
  logo: { corner: 'left' | 'right'; size: number; inset: number };
  brand: Rect; title: Rect; body: Rect;
  priceBadge: Rect; validity: Rect;
  button: Rect; cta: Rect; contact: Rect;
  footer: Rect;
  sizes: { brand: number; title: number; body: number; price: number; validity: number; cta: number; footer: number };
  align: 'left' | 'center';
};

const templates: Record<SceneFormat, Slots> = {
  instagram: {
    base: [0, 0, 1, 1], product: [0.14, 0.13, 0.72, 0.46], productOnBase: [0.2, 0.12, 0.6, 0.46], scrim: [0, 0.6, 1, 0.4], panel: null,
    logo: { corner: 'right', size: 0.11, inset: 0.035 },
    brand: [0.07, 0.045, 0.62, 0.05], title: [0.07, 0.635, 0.86, 0.1], body: [0.07, 0.745, 0.55, 0.085],
    priceBadge: [0.64, 0.745, 0.29, 0.075], validity: [0.64, 0.825, 0.29, 0.03],
    button: [0.07, 0.86, 0.86, 0.08], cta: [0.1, 0.86, 0.48, 0.08], contact: [0.58, 0.86, 0.32, 0.08],
    footer: [0.07, 0.955, 0.86, 0.03],
    sizes: { brand: 30, title: 64, body: 30, price: 40, validity: 22, cta: 34, footer: 20 }, align: 'left',
  },
  facebook: {
    base: [0, 0, 0.56, 1], product: [0.03, 0.06, 0.5, 0.88], productOnBase: [0.07, 0.12, 0.42, 0.76], scrim: null, panel: [0.56, 0, 0.44, 1],
    logo: { corner: 'left', size: 0.16, inset: 0.03 },
    brand: [0.6, 0.07, 0.36, 0.07], title: [0.6, 0.19, 0.36, 0.22], body: [0.6, 0.43, 0.36, 0.17],
    priceBadge: [0.6, 0.63, 0.18, 0.11], validity: [0.79, 0.645, 0.17, 0.08],
    button: [0.6, 0.79, 0.36, 0.12], cta: [0.62, 0.79, 0.18, 0.12], contact: [0.8, 0.79, 0.14, 0.12],
    footer: [0.6, 0.935, 0.36, 0.04],
    sizes: { brand: 28, title: 50, body: 24, price: 30, validity: 18, cta: 24, footer: 15 }, align: 'left',
  },
  whatsapp: {
    base: [0, 0, 1, 1], product: [0.1, 0.11, 0.8, 0.43], productOnBase: [0.14, 0.12, 0.72, 0.42], scrim: [0, 0.56, 1, 0.44], panel: null,
    logo: { corner: 'right', size: 0.13, inset: 0.04 },
    brand: [0.07, 0.04, 0.62, 0.035], title: [0.07, 0.575, 0.86, 0.095], body: [0.07, 0.675, 0.86, 0.08],
    priceBadge: [0.07, 0.77, 0.42, 0.055], validity: [0.52, 0.782, 0.41, 0.035],
    button: [0.07, 0.86, 0.86, 0.06], cta: [0.1, 0.86, 0.5, 0.06], contact: [0.6, 0.86, 0.3, 0.06],
    footer: [0.07, 0.955, 0.86, 0.025],
    sizes: { brand: 34, title: 76, body: 40, price: 50, validity: 30, cta: 40, footer: 24 }, align: 'left',
  },
};

/** Las zonas de una plantilla, para pruebas y para la futura acción «Copiar a otros formatos». */
export const templateSlots = (format: SceneFormat): Readonly<Slots> => templates[format];

export function createSceneFromTemplate(format: SceneFormat, input: TemplateInput): Scene {
  const { width: W, height: H } = sceneFormats[format];
  const t = templates[format];
  const box = ([x, y, w, h]: Rect) => ({ x: Math.round(x * W), y: Math.round(y * H), width: Math.round(w * W), height: Math.round(h * H) });
  const font = input.fontFamily || defaultFont;
  const layers: Layer[] = [];
  const base = input.base && isSafeImageSrc(input.base.src) ? input.base : undefined;
  const product = input.product && isSafeImageSrc(input.product) ? input.product : undefined;
  const fullBleed = !!base && t.scrim !== null;

  if (base) layers.push(imageLayer(box(t.base), base.kind === 'complete' ? 'ai-complete' : 'ai-background', base.src, { name: base.kind === 'complete' ? 'Imagen con IA' : 'Fondo con IA', fit: 'cover' }));
  // La foto real solo se agrega si ninguna imagen la contiene ya.
  if (product && base?.kind !== 'complete') layers.push(imageLayer(box(base ? t.productOnBase : t.product), 'product', product, { name: 'Foto del producto', fit: 'contain', cornerRadius: base ? 0 : 22 }));
  if (t.panel) layers.push(shapeLayer(box(t.panel), 'rect', { name: 'Panel', fill: { token: 'secondary' } }));
  if (fullBleed && t.scrim) layers.push(shapeLayer(box(t.scrim), 'rect', { name: 'Franja', fill: { token: 'secondary' }, opacity: 0.9 }));

  if (input.logo && isSafeImageSrc(input.logo)) {
    const size = Math.round(t.logo.size * Math.min(W, H));
    const inset = Math.round(t.logo.inset * Math.min(W, H));
    layers.push(imageLayer({ x: t.logo.corner === 'left' ? inset : W - inset - size, y: inset, width: size, height: size }, 'logo', input.logo, { name: 'Logo', fit: 'contain' }));
  }
  const text = (rect: Rect, name: string, size: number, extra: Parameters<typeof textLayer>[1] = {}) =>
    layers.push(textLayer(box(rect), { name, fontFamily: font, fontSize: size, align: t.align, ...extra }));

  // Sobre una imagen a sangre el nombre va sin fondo propio: se usa el color de botones para que destaque.
  text(t.brand, 'Nombre del negocio', t.sizes.brand, { text: input.brandName.trim() || 'Mi negocio', fontWeight: 700, fill: fullBleed ? { token: 'paper' } : { token: 'primary' } });
  text(t.title, 'Título', t.sizes.title, { bind: { field: 'title', prefix: '', suffix: '' }, fontWeight: 700, lineHeight: 1.05 });
  text(t.body, 'Mensaje', t.sizes.body, { bind: { field: 'body', prefix: '', suffix: '' } });
  if (input.values.price.trim()) {
    layers.push(shapeLayer(box(t.priceBadge), 'badge', { name: 'Etiqueta de precio', fill: { token: 'primary' }, cornerRadius: 999 }));
    text(t.priceBadge, 'Precio', t.sizes.price, { bind: { field: 'price', prefix: '', suffix: '' }, fontWeight: 700, align: 'center', verticalAlign: 'middle', fill: { token: 'onPrimary' } });
  }
  if (input.values.validity.trim()) text(t.validity, 'Vigencia', t.sizes.validity, { bind: { field: 'validity', prefix: '', suffix: '' }, align: format === 'whatsapp' ? 'left' : 'center', verticalAlign: format === 'whatsapp' ? 'middle' : 'top' });
  layers.push(shapeLayer(box(t.button), 'rect', { name: 'Botón', fill: { token: 'primary' }, cornerRadius: 18 }));
  text(t.cta, 'Llamado a la acción', t.sizes.cta, { bind: { field: 'cta', prefix: '', suffix: '' }, fontWeight: 700, verticalAlign: 'middle', fill: { token: 'onPrimary' } });
  text(t.contact, 'Contacto', t.sizes.cta, { bind: { field: 'contact', prefix: '', suffix: '' }, align: 'right', verticalAlign: 'middle', fill: { token: 'onPrimary' } });
  if (input.footer?.trim()) text(t.footer, 'Redes y dirección', t.sizes.footer, { text: input.footer.trim(), align: 'center' });

  return { ...emptyScene(format, input.palette), background: { token: 'secondary' }, layers };
}

/** Crea la escena inicial de las tres redes. */
export function createScenes(input: TemplateInput): Record<SceneFormat, Scene> {
  return Object.fromEntries((Object.keys(sceneFormats) as SceneFormat[]).map(format => [format, createSceneFromTemplate(format, input)])) as Record<SceneFormat, Scene>;
}
