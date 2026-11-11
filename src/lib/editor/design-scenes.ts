// Puente entre el diseño de Clic (`Design`) y las escenas del editor visual.
// Puro: no toca el DOM ni Supabase. Los tipos de `studio.ts` se importan solo como tipos.
import type { Design, Network } from '../studio';
import { commercialValuesOf, type CommercialValues } from './bindings';
import { createSceneFromTemplate, type BaseImage } from './layouts';
import { addLayer, imageLayer } from './operations';
import { normalizeScene, paletteFrom, sceneFormats, type Palette, type Scene, type SceneFormat } from './scene';

// Las redes de Clic y los formatos de escena deben ser los mismos (falla al compilar si se separan).
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const sameKeys: Same<Network, SceneFormat> = true;
void sameKeys;

export const sceneNetworks = Object.keys(sceneFormats) as SceneFormat[];

/** Fuente única de verdad de los textos comerciales: los campos del propio diseño. */
export const designValues = (design: Pick<Design, 'title' | 'body' | 'price' | 'validity' | 'cta' | 'contact'>): CommercialValues => commercialValuesOf(design);

/**
 * Colores de partida de las escenas de un diseño. Salen de los colores guardados en el propio diseño
 * (snapshot tomado al crearlo), nunca de la marca actual: cambiar la marca no altera publicaciones anteriores.
 */
export const designPalette = (design: Pick<Design, 'color' | 'background'>): Palette => paletteFrom({ primary: design.color, secondary: design.background });

export const hasScenes = (design: Pick<Design, 'scenes'>) => !!design.scenes && Object.values(design.scenes).some(Boolean);

export type DesignScenesResult = { design: Design; issues: string[] };

/**
 * Valida las escenas de un diseño recuperado (base de datos o borrador local).
 * - Un diseño sin escenas se devuelve tal cual (misma referencia): los diseños anteriores no cambian.
 * - Una escena inválida se descarta; ese formato vuelve a usar el renderizador clásico.
 * - Una escena guardada con otro formato que su clave se descarta.
 */
export function normalizeDesignScenes(design: Design): DesignScenesResult {
  if (design.scenes === undefined) return { design, issues: [] };
  const issues: string[] = [];
  const raw = design.scenes as unknown;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { design: { ...design, scenes: undefined }, issues: ['Las escenas guardadas no son válidas.'] };
  const scenes: Partial<Record<Network, Scene>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!sceneNetworks.includes(key as SceneFormat)) { issues.push(`Se ignoró una escena de una red desconocida (${key}).`); continue; }
    const result = normalizeScene(value);
    issues.push(...result.issues.map(issue => `${key}: ${issue}`));
    if (!result.scene) continue;
    if (result.scene.format !== key) { issues.push(`${key}: la escena era de otro formato (${result.scene.format}).`); continue; }
    scenes[key as Network] = result.scene;
  }
  return { design: { ...design, scenes: Object.keys(scenes).length ? scenes : undefined }, issues };
}

/** Escena válida de una red, o null si ese formato todavía usa el renderizador clásico. */
export function sceneFor(design: Pick<Design, 'scenes'>, network: Network): Scene | null {
  const value = design.scenes?.[network];
  if (!value) return null;
  const { scene } = normalizeScene(value);
  return scene && scene.format === network ? scene : null;
}

export type SceneSeed = {
  /** Imagen de IA por red y qué contiene. Sin ella, la escena usa la foto real del producto. */
  base?: Partial<Record<Network, BaseImage>>;
};

/** Crea las escenas iniciales de un diseño con las plantillas, a partir de su propio snapshot de marca. */
export function createDesignScenes(design: Design, seed: SceneSeed = {}): Record<Network, Scene> {
  const brand = design.brand || ({} as Design['brand']);
  const product = design.images?.[design.selectedImage] || design.images?.[0];
  const footer = [brand.instagram, brand.facebook, brand.address].filter(Boolean).join('  ·  ');
  const common = { palette: designPalette(design), brandName: brand.name || '', logo: brand.logo || undefined, footer, values: designValues(design), product };
  const result = {} as Record<Network, Scene>;
  for (const network of sceneNetworks) {
    result[network] = createSceneFromTemplate(network, { ...common, base: seed.base?.[network] });
  }
  return result;
}

/** Devuelve el diseño con escenas: conserva las existentes y crea solo las que faltan. */
export function ensureDesignScenes(design: Design, seed: SceneSeed = {}): Design {
  const current = normalizeDesignScenes(design).design.scenes || {};
  const missing = sceneNetworks.filter(network => !current[network]);
  if (!missing.length) return design;
  const created = createDesignScenes(design, seed);
  return { ...design, scenes: { ...current, ...Object.fromEntries(missing.map(network => [network, created[network]])) } };
}

/** Reemplaza la escena de una red (validándola). Si no es válida, el diseño no cambia. */
export function withScene(design: Design, network: Network, scene: Scene): Design {
  const { scene: valid } = normalizeScene(scene);
  if (!valid || valid.format !== network) return design;
  return { ...design, scenes: { ...design.scenes, [network]: valid } };
}

/**
 * Coloca en las escenas los fondos que devolvió la IA (uno por red).
 * - Formato sin escena: se crea con la plantilla (fondo de IA + foto real + logo + textos editables).
 * - Formato con escena: solo se cambia la imagen de fondo; lo que la persona editó se conserva.
 * Las redes sin imagen nueva no cambian.
 */
export function applyGeneratedBackgrounds(design: Design, urls: Partial<Record<Network, string>>, kind: BaseImage['kind'] = 'background'): Design {
  const networks = sceneNetworks.filter(network => typeof urls[network] === 'string' && urls[network]);
  if (!networks.length) return design;
  const current = normalizeDesignScenes(design).design.scenes ?? {};
  const fresh = createDesignScenes(design, { base: Object.fromEntries(networks.map(network => [network, { src: urls[network]!, kind }])) });
  const role = kind === 'complete' ? 'ai-complete' as const : 'ai-background' as const;
  const scenes: Partial<Record<Network, Scene>> = { ...current };
  for (const network of networks) {
    const scene = current[network];
    if (!scene) { scenes[network] = fresh[network]; continue; }
    const base = scene.layers.find(layer => layer.type === 'image' && (layer.role === 'ai-background' || layer.role === 'ai-complete'));
    scenes[network] = base
      // Reemplazo directo (aunque esté bloqueada): es la app la que actualiza el fondo, no una edición manual.
      ? { ...scene, layers: scene.layers.map(layer => layer.id === base.id && layer.type === 'image' ? { ...layer, src: urls[network]!, role } : layer) }
      : addLayer(scene, imageLayer({ x: 0, y: 0, width: scene.width, height: scene.height }, role, urls[network]!, { name: role === 'ai-complete' ? 'Imagen con IA' : 'Fondo con IA', fit: 'cover' }), 0);
  }
  return { ...design, scenes };
}

/** Quita las escenas (volver al diseño clásico). */
export const withoutScenes = (design: Design): Design => design.scenes === undefined ? design : { ...design, scenes: undefined };
