// Modelo de escena del editor visual. Es JSON puro, versionado e independiente de la
// librería que lo dibuje (Konva u otra): ninguna función de este archivo toca el DOM.

export const SCENE_VERSION = 1;
export const MAX_LAYERS = 60;
export const MAX_TEXT_LENGTH = 500;

/** Lienzo de cada red. Debe coincidir con `formats` de `lib/studio.ts` (lo verifica una prueba). */
export const sceneFormats = {
  instagram: { width: 1080, height: 1080 },
  facebook: { width: 1200, height: 630 },
  whatsapp: { width: 1080, height: 1920 },
} as const;
export type SceneFormat = keyof typeof sceneFormats;
export const isSceneFormat = (value: unknown): value is SceneFormat => typeof value === 'string' && value in sceneFormats;

/**
 * Colores con nombre. La escena guarda su propia copia (`palette`) tomada de la marca al crearse:
 * si la marca cambia después, las publicaciones anteriores no cambian solas.
 */
// `ink` contrasta con `secondary` (fondo) y `onPrimary` con `primary` (botones, etiquetas).
export const colorTokens = ['primary', 'secondary', 'ink', 'onPrimary', 'paper'] as const;
export type ColorToken = typeof colorTokens[number];
export type Palette = Record<ColorToken, string>;
/** Un color fijo `#rrggbb` o una referencia a la paleta de la escena. */
export type Paint = string | { token: ColorToken };

/** Campos comerciales. Su único valor vive en el diseño; las capas solo los referencian. */
export const commercialFields = ['title', 'body', 'price', 'validity', 'cta', 'contact'] as const;
export type CommercialField = typeof commercialFields[number];

/**
 * Qué es cada imagen. Separarlas evita duplicar el producto real sobre una imagen de IA que ya lo contiene:
 * - `ai-complete`: imagen comercial completa generada con IA (ya incluye el producto).
 * - `ai-background`: fondo de IA preparado para componer; el producto real va encima.
 * - `product`: fotografía real del producto, sin alterar.
 * - `photo`: fotografía adicional.
 * - `logo`: logo de la marca.
 */
export const imageRoles = ['ai-complete', 'ai-background', 'product', 'photo', 'logo'] as const;
export type ImageRole = typeof imageRoles[number];

export const shapeKinds = ['rect', 'ellipse', 'line', 'badge'] as const;
export type ShapeKind = typeof shapeKinds[number];
export const textAligns = ['left', 'center', 'right'] as const;
export type TextAlign = typeof textAligns[number];
export const verticalAligns = ['top', 'middle', 'bottom'] as const;
export type VerticalAlign = typeof verticalAligns[number];

type LayerBase = {
  id: string; name: string;
  /** Posición y tamaño en píxeles del lienzo (no de la pantalla). */
  x: number; y: number; width: number; height: number;
  /** Grados, en sentido horario. */
  rotation: number;
  opacity: number; visible: boolean; locked: boolean;
};
export type ImageLayer = LayerBase & { type: 'image'; role: ImageRole; src: string; fit: 'contain' | 'cover'; cornerRadius: number };
export type TextBinding = { field: CommercialField; prefix: string; suffix: string };
export type TextLayer = LayerBase & {
  type: 'text';
  /** Texto propio de la capa. En una capa vinculada (`bind`) siempre está vacío: el valor sale del diseño. */
  text: string;
  bind: TextBinding | null;
  fontFamily: string; fontSize: number; fontWeight: 400 | 700; italic: boolean;
  align: TextAlign;
  /** Posición vertical del texto dentro de su caja (por ejemplo, centrado en un botón). */
  verticalAlign: VerticalAlign;
  lineHeight: number; fill: Paint;
};
export type ShapeLayer = LayerBase & { type: 'shape'; kind: ShapeKind; fill: Paint | null; stroke: Paint | null; strokeWidth: number; cornerRadius: number };
export type Layer = ImageLayer | TextLayer | ShapeLayer;
export type LayerType = Layer['type'];

export type Scene = {
  version: typeof SCENE_VERSION;
  format: SceneFormat;
  width: number; height: number;
  background: Paint;
  palette: Palette;
  /** El orden es el de apilado: la primera capa queda al fondo. */
  layers: Layer[];
};

export const defaultFont = 'Geist, Arial, sans-serif';

// ───────────── Utilidades ─────────────

let fallbackId = 0;
export function createId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : `layer-${Date.now().toString(36)}-${(fallbackId++).toString(36)}`;
}

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (value: unknown): value is string => typeof value === 'string' && HEX.test(value);

export function contrastInk(hex: string): string {
  if (!isHex(hex)) return '#142e2c';
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? '#142e2c' : '#ffffff';
}

/** Copia los colores de la marca en una paleta propia de la escena (snapshot). */
export function paletteFrom(colors: { primary?: string; secondary?: string }): Palette {
  const primary = isHex(colors.primary) ? colors.primary.toLowerCase() : '#2f5bff';
  const secondary = isHex(colors.secondary) ? colors.secondary.toLowerCase() : '#f7f9fc';
  return { primary, secondary, ink: contrastInk(secondary), onPrimary: contrastInk(primary), paper: '#ffffff' };
}

export function resolvePaint(paint: Paint | null, palette: Palette): string | null {
  if (paint === null) return null;
  return typeof paint === 'string' ? paint : palette[paint.token];
}

/** Rutas de imagen aceptadas: fotos subidas (data URL), referencias de Storage y URLs https. Nunca SVG ni javascript:. */
export function isSafeImageSrc(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 15_000_000) return false;
  return /^data:image\/(png|jpeg|webp);base64,/.test(value) || value.startsWith('clic-media://') || /^https:\/\/[^\s]+$/.test(value);
}

const SAFE_FONT = /^[\w\s,'"-]{1,80}$/;

// ───────────── Validación y versiones ─────────────

export type SceneResult = { scene: Scene | null; issues: string[] };

/** Migraciones de una versión a la siguiente. `migrations[n]` convierte una escena de versión n a n + 1. */
const migrations: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

const num = (value: unknown, fallback: number, min = -Infinity, max = Infinity) => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
};
const str = (value: unknown, fallback: string, max: number) => (typeof value === 'string' ? value : fallback).slice(0, max);
const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T => (options as readonly unknown[]).includes(value) ? value as T : fallback;
const bool = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

function paint(value: unknown, fallback: Paint): Paint {
  if (isHex(value)) return value.toLowerCase();
  if (isRecord(value) && (colorTokens as readonly unknown[]).includes(value.token)) return { token: value.token as ColorToken };
  return fallback;
}
function optionalPaint(value: unknown): Paint | null {
  if (value === null || value === undefined) return null;
  const result = paint(value, '');
  return result === '' ? null : result;
}

function normalizeLayer(raw: unknown, size: { width: number; height: number }, issues: string[], seen: Set<string>): Layer | null {
  if (!isRecord(raw)) { issues.push('Se descartó una capa que no es un objeto.'); return null; }
  let id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.slice(0, 64) : createId();
  if (seen.has(id)) { issues.push(`Se renovó el id repetido «${id}».`); id = createId(); }
  seen.add(id);
  const limit = Math.max(size.width, size.height) * 4;
  const base: LayerBase = {
    id,
    name: str(raw.name, '', 60),
    x: num(raw.x, 0, -limit, limit), y: num(raw.y, 0, -limit, limit),
    width: num(raw.width, 100, 1, limit), height: num(raw.height, 100, 1, limit),
    rotation: ((num(raw.rotation, 0) % 360) + 360) % 360,
    opacity: num(raw.opacity, 1, 0, 1),
    visible: bool(raw.visible, true), locked: bool(raw.locked, false),
  };
  if (raw.type === 'image') {
    if (!isSafeImageSrc(raw.src)) { issues.push(`Se descartó la imagen «${base.name || id}»: su origen no es válido.`); return null; }
    return { ...base, type: 'image', role: oneOf(raw.role, imageRoles, 'photo'), src: raw.src, fit: oneOf(raw.fit, ['contain', 'cover'] as const, 'contain'), cornerRadius: num(raw.cornerRadius, 0, 0, 2000) };
  }
  if (raw.type === 'text') {
    const bindRaw = isRecord(raw.bind) ? raw.bind : null;
    const bind: TextBinding | null = bindRaw && (commercialFields as readonly unknown[]).includes(bindRaw.field)
      ? { field: bindRaw.field as CommercialField, prefix: str(bindRaw.prefix, '', 40), suffix: str(bindRaw.suffix, '', 40) }
      : null;
    if (bindRaw && !bind) issues.push(`Se quitó un vínculo desconocido de la capa «${base.name || id}».`);
    return {
      ...base, type: 'text',
      // Una sola fuente de verdad: una capa vinculada nunca guarda su propio texto.
      text: bind ? '' : str(raw.text, '', MAX_TEXT_LENGTH),
      bind,
      fontFamily: typeof raw.fontFamily === 'string' && SAFE_FONT.test(raw.fontFamily) ? raw.fontFamily : defaultFont,
      fontSize: num(raw.fontSize, 48, 6, 600),
      fontWeight: raw.fontWeight === 700 ? 700 : 400,
      italic: bool(raw.italic, false),
      align: oneOf(raw.align, textAligns, 'left'),
      verticalAlign: oneOf(raw.verticalAlign, verticalAligns, 'top'),
      lineHeight: num(raw.lineHeight, 1.15, 0.6, 3),
      fill: paint(raw.fill, { token: 'ink' }),
    };
  }
  if (raw.type === 'shape') {
    return { ...base, type: 'shape', kind: oneOf(raw.kind, shapeKinds, 'rect'), fill: optionalPaint(raw.fill), stroke: optionalPaint(raw.stroke), strokeWidth: num(raw.strokeWidth, 0, 0, 200), cornerRadius: num(raw.cornerRadius, 0, 0, 2000) };
  }
  issues.push(`Se descartó una capa de tipo desconocido (${String(raw.type)}).`);
  return null;
}

/**
 * Valida una escena que viene de la base, de IndexedDB o de otra versión de la app.
 * Repara lo que puede (números fuera de rango, colores inválidos, ids repetidos), descarta capas
 * inseguras o desconocidas y devuelve `scene: null` si no se puede usar.
 */
export function normalizeScene(input: unknown): SceneResult {
  const issues: string[] = [];
  if (!isRecord(input)) return { scene: null, issues: ['La escena no es un objeto.'] };
  let raw = input;
  let version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return { scene: null, issues: ['La escena no indica una versión válida.'] };
  if (version > SCENE_VERSION) return { scene: null, issues: [`La escena es de una versión más nueva (${version}). Actualiza la app.`] };
  while (version < SCENE_VERSION) {
    const migrate = migrations[version];
    if (!migrate) return { scene: null, issues: [`No hay cómo actualizar la escena desde la versión ${version}.`] };
    raw = migrate(raw); version += 1;
  }
  if (!isSceneFormat(raw.format)) return { scene: null, issues: ['La escena tiene un formato desconocido.'] };
  const { width, height } = sceneFormats[raw.format];
  if (raw.width !== width || raw.height !== height) issues.push('Se corrigió el tamaño del lienzo según el formato.');
  const palette = isRecord(raw.palette) ? raw.palette : {};
  const fallback = paletteFrom({});
  const safePalette = Object.fromEntries(colorTokens.map(token => [token, isHex(palette[token]) ? (palette[token] as string).toLowerCase() : fallback[token]])) as Palette;
  const list = Array.isArray(raw.layers) ? raw.layers : [];
  if (!Array.isArray(raw.layers)) issues.push('La escena no tenía capas.');
  if (list.length > MAX_LAYERS) issues.push(`Se conservaron solo las primeras ${MAX_LAYERS} capas.`);
  const seen = new Set<string>();
  const layers = list.slice(0, MAX_LAYERS).map(layer => normalizeLayer(layer, { width, height }, issues, seen)).filter((layer): layer is Layer => layer !== null);
  return { scene: { version: SCENE_VERSION, format: raw.format, width, height, background: paint(raw.background, { token: 'secondary' }), palette: safePalette, layers }, issues };
}

/** Escena vacía de un formato, con la paleta indicada. */
export function emptyScene(format: SceneFormat, palette: Palette): Scene {
  return { version: SCENE_VERSION, format, ...sceneFormats[format], background: { token: 'secondary' }, palette: { ...palette }, layers: [] };
}
