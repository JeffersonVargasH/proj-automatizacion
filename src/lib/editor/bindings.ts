// Sincronización controlada entre las capas de texto y los campos comerciales del diseño.
// Fuente única de verdad: título, mensaje, precio, vigencia, CTA y contacto viven solo en el diseño
// (los mismos campos que usan el texto para redes, n8n y la publicación). Una capa vinculada guarda
// únicamente *qué* campo muestra; al editarla, cambia el campo, nunca una copia dentro de la capa.
import { commercialFields, MAX_TEXT_LENGTH, type CommercialField, type Scene, type TextLayer } from './scene';
import { updateLayer } from './operations';

export type CommercialValues = Record<CommercialField, string>;

/** Los mismos límites que usa hoy el formulario del editor. */
export const fieldLimits: Record<CommercialField, number> = { title: 80, body: 180, price: 45, validity: 60, cta: 40, contact: 35 };
export const fieldLabels: Record<CommercialField, string> = { title: 'Título', body: 'Mensaje', price: 'Precio', validity: 'Vigencia', cta: 'Llamado a la acción', contact: 'Contacto' };

/** Toma los campos comerciales de un diseño (u objeto parecido), con texto vacío si falta alguno. */
export function commercialValuesOf(source: Partial<Record<CommercialField, unknown>>): CommercialValues {
  return Object.fromEntries(commercialFields.map(field => [field, typeof source[field] === 'string' ? source[field] : ''])) as CommercialValues;
}

/** Texto que muestra una capa. Una capa vinculada a un campo vacío no muestra nada (ni prefijo ni sufijo). */
export function resolveLayerText(layer: TextLayer, values: CommercialValues): string {
  if (!layer.bind) return layer.text;
  const value = values[layer.bind.field]?.trim();
  return value ? `${layer.bind.prefix}${value}${layer.bind.suffix}` : '';
}

export type TextEdit = { scene: Scene; values: CommercialValues; changed: 'scene' | 'values' | null };

/**
 * Edita el texto de una capa. Si la capa está vinculada, cambia el campo del diseño (y con él todas las
 * capas que lo muestran, en cualquier formato); si no, cambia solo la capa. Respeta bloqueo y límites.
 */
export function editLayerText(scene: Scene, values: CommercialValues, layerId: string, text: string): TextEdit {
  const layer = scene.layers.find(item => item.id === layerId);
  if (!layer || layer.type !== 'text' || layer.locked) return { scene, values, changed: null };
  if (layer.bind) {
    const field = layer.bind.field;
    const next = text.slice(0, fieldLimits[field]);
    return next === values[field] ? { scene, values, changed: null } : { scene, values: { ...values, [field]: next }, changed: 'values' };
  }
  const next = updateLayer(scene, layerId, { text: text.slice(0, MAX_TEXT_LENGTH) });
  return { scene: next, values, changed: next === scene ? null : 'scene' };
}

/** Vincula una capa de texto a un campo. Su texto propio se descarta: desde ahora muestra el campo. */
export function bindLayer(scene: Scene, layerId: string, field: CommercialField, prefix = '', suffix = ''): Scene {
  const index = scene.layers.findIndex(item => item.id === layerId);
  const layer = scene.layers[index];
  if (!layer || layer.type !== 'text' || layer.locked) return scene;
  if (layer.bind?.field === field && layer.bind.prefix === prefix && layer.bind.suffix === suffix) return scene;
  const layers = scene.layers.slice();
  layers[index] = { ...layer, text: '', bind: { field, prefix: prefix.slice(0, 40), suffix: suffix.slice(0, 40) } };
  return { ...scene, layers };
}

/**
 * Desvincula una capa (acción explícita de la persona): conserva el texto que mostraba como texto libre.
 * Desde ese momento ya no cambia con el campo ni lo modifica.
 */
export function unbindLayer(scene: Scene, values: CommercialValues, layerId: string): Scene {
  const index = scene.layers.findIndex(item => item.id === layerId);
  const layer = scene.layers[index];
  if (!layer || layer.type !== 'text' || !layer.bind || layer.locked) return scene;
  const layers = scene.layers.slice();
  layers[index] = { ...layer, text: resolveLayerText(layer, values).slice(0, MAX_TEXT_LENGTH), bind: null };
  return { ...scene, layers };
}

export type BindingReport = {
  /** Campos con valor que ninguna capa visible muestra (por ejemplo, hay precio pero no se ve en la imagen). */
  notShown: CommercialField[];
  /** Capas vinculadas cuyo campo está vacío: en la imagen no se verá nada. */
  emptyLayers: string[];
};

/** Diagnóstico para avisar a la persona antes de exportar. No cambia nada. */
export function bindingReport(scene: Scene, values: CommercialValues): BindingReport {
  const shown = new Set<CommercialField>();
  const emptyLayers: string[] = [];
  for (const layer of scene.layers) {
    if (layer.type !== 'text' || !layer.bind) continue;
    if (!values[layer.bind.field]?.trim()) emptyLayers.push(layer.id);
    else if (layer.visible && layer.opacity > 0) shown.add(layer.bind.field);
  }
  const notShown = commercialFields.filter(field => values[field]?.trim() && !shown.has(field));
  return { notShown, emptyLayers };
}
