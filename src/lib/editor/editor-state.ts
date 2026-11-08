// Estado del editor visual, separado de la interfaz: un reductor puro que React usa con `useReducer`.
// El documento editable es JSON del modelo (escenas + campos comerciales); Konva solo lo dibuja.
//
// Historial: cada acción confirmada es un paso. Los cambios continuos (escribir en un campo, mover un
// deslizador, elegir un color) se envían con `transient: true` y se muestran en vivo sin crear pasos;
// la acción `settle` (al soltar o salir del campo) los registra como uno solo.
import { editLayerText, resolveLayerText, type CommercialValues } from './bindings';
import { cancel, commit, createHistory, preview, settle, undo as undoHistory, redo as redoHistory, canUndo, canRedo, type History } from './history';
import { addLayer, arrangeLayer, duplicateLayers, removeLayers, updateLayer, type Arrange } from './operations';
import { normalizeScene, sceneFormats, type Layer, type Scene, type SceneFormat, type TextLayer } from './scene';

export type EditorDocument = { scenes: Partial<Record<SceneFormat, Scene>>; values: CommercialValues };
export type EditorState = { history: History<EditorDocument>; format: SceneFormat; selectedId: string | null };

/** Mide el alto que necesita un texto con su ancho y estilo actuales (lo aporta el lienzo, con Konva). */
export type TextMeasure = (layer: TextLayer, text: string) => number;

export type EditorAction =
  | { type: 'select'; id: string | null }
  | { type: 'format'; format: SceneFormat }
  /** Cambia propiedades de una capa (posición, tamaño, estilo, nombre, visibilidad, bloqueo). */
  | { type: 'commitLayer'; id: string; patch: Partial<Layer>; transient?: boolean; measure?: TextMeasure }
  /**
   * Cambia el contenido de un texto. Si está vinculado a un campo comercial, cambia el campo del diseño
   * (y con él todas las escenas); si es libre, solo esa capa. Con `measure`, las cajas crecen lo
   * necesario para que el texto nuevo no quede cortado.
   */
  | { type: 'setText'; id: string; text: string; transient?: boolean; measure?: TextMeasure }
  | { type: 'addLayer'; layer: Layer }
  | { type: 'removeLayer'; id: string }
  | { type: 'duplicateLayer'; id: string }
  | { type: 'arrangeLayer'; id: string; where: Arrange }
  /** Registra como un solo paso los cambios en vivo pendientes. */
  | { type: 'settle' }
  /** Descarta los cambios en vivo pendientes (Escape). */
  | { type: 'cancel' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'load'; document: EditorDocument; format?: SceneFormat };

const formats = Object.keys(sceneFormats) as SceneFormat[];

/** Valida las escenas que entran al editor; descarta las que no corresponden a su formato. */
export function sanitizeDocument(document: EditorDocument): EditorDocument {
  const scenes: EditorDocument['scenes'] = {};
  for (const format of formats) {
    const { scene } = normalizeScene(document.scenes[format]);
    if (scene && scene.format === format) scenes[format] = scene;
  }
  return { scenes, values: { ...document.values } };
}

export function createEditorState(document: EditorDocument, format?: SceneFormat): EditorState {
  const clean = sanitizeDocument(document);
  const first = format && clean.scenes[format] ? format : formats.find(item => clean.scenes[item]) ?? 'instagram';
  return { history: createHistory(clean), format: first, selectedId: null };
}

export const currentScene = (state: EditorState): Scene | null => state.history.present.scenes[state.format] ?? null;
export const selectedLayer = (state: EditorState): Layer | null => currentScene(state)?.layers.find(layer => layer.id === state.selectedId) ?? null;
export const editorCanUndo = (state: EditorState) => canUndo(state.history);
export const editorCanRedo = (state: EditorState) => canRedo(state.history);

/** La selección se pierde si la capa ya no existe en el formato activo. */
function keepSelection(state: EditorState): EditorState {
  if (!state.selectedId) return state;
  return currentScene(state)?.layers.some(item => item.id === state.selectedId) ? state : { ...state, selectedId: null };
}

/** Aplica un documento nuevo: como vista previa (`transient`) o como paso del historial. */
function apply(state: EditorState, document: EditorDocument, transient = false): EditorState {
  if (document === state.history.present) return state;
  return { ...state, history: transient ? preview(state.history, document) : commit(state.history, document) };
}

const withScene = (document: EditorDocument, format: SceneFormat, scene: Scene): EditorDocument =>
  document.scenes[format] === scene ? document : { ...document, scenes: { ...document.scenes, [format]: scene } };

/** Hace crecer las cajas de texto afectadas para que su contenido no quede cortado (nunca las encoge). */
function growTextBoxes(document: EditorDocument, affected: (layer: TextLayer, format: SceneFormat) => boolean, measure: TextMeasure): EditorDocument {
  let next = document;
  for (const format of formats) {
    const scene = next.scenes[format];
    if (!scene) continue;
    let updated = scene;
    for (const layer of scene.layers) {
      if (layer.type !== 'text' || !affected(layer, format)) continue;
      const needed = Math.ceil(measure(layer, resolveLayerText(layer, next.values)));
      if (Number.isFinite(needed) && needed > layer.height) updated = updateLayer(updated, layer.id, { height: needed });
    }
    next = withScene(next, format, updated);
  }
  return next;
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const document = state.history.present;
  const scene = currentScene(state);
  switch (action.type) {
    case 'select': {
      if (action.id === state.selectedId) return state;
      if (action.id === null) return { ...state, selectedId: null };
      // También se pueden elegir capas ocultas (desde el panel de capas), para mostrarlas o editarlas.
      return scene?.layers.some(item => item.id === action.id) ? { ...state, selectedId: action.id } : state;
    }
    case 'format':
      if (action.format === state.format || !document.scenes[action.format]) return state;
      return { ...state, history: settle(state.history), format: action.format, selectedId: null };
    case 'commitLayer': {
      if (!scene) return state;
      let next = withScene(document, state.format, updateLayer(scene, action.id, action.patch));
      // Si cambia la letra o el ancho de un texto (desde el panel), su caja crece para no cortar el contenido.
      // No se aplica cuando el cambio ya trae su alto (por ejemplo, al soltar una transformación en el lienzo).
      const textChange = ['fontSize', 'fontFamily', 'fontWeight', 'italic', 'lineHeight', 'width'].some(key => key in action.patch);
      if (action.measure && textChange && !('height' in action.patch)) next = growTextBoxes(next, (item, format) => format === state.format && item.id === action.id, action.measure);
      return apply(state, next, action.transient);
    }
    case 'setText': {
      if (!scene) return state;
      const layer = scene.layers.find(item => item.id === action.id);
      if (!layer || layer.type !== 'text') return state;
      const edit = editLayerText(scene, document.values, action.id, action.text);
      if (!edit.changed) return state;
      let next: EditorDocument = { scenes: { ...document.scenes, [state.format]: edit.scene }, values: edit.values };
      if (action.measure) {
        const field = layer.bind?.field;
        next = growTextBoxes(next, (item, format) => field ? item.bind?.field === field : format === state.format && item.id === layer.id, action.measure);
      }
      return apply(state, next, action.transient);
    }
    case 'addLayer': {
      if (!scene) return state;
      const next = addLayer(scene, action.layer);
      if (next === scene) return state;
      return { ...apply(state, withScene(document, state.format, next)), selectedId: next.layers[next.layers.length - 1].id };
    }
    case 'removeLayer': {
      if (!scene) return state;
      const next = removeLayers(scene, [action.id]);
      if (next === scene) return state;
      return keepSelection(apply(state, withScene(document, state.format, next)));
    }
    case 'duplicateLayer': {
      if (!scene) return state;
      const { scene: next, ids } = duplicateLayers(scene, [action.id]);
      if (!ids.length) return state;
      return { ...apply(state, withScene(document, state.format, next)), selectedId: ids[0] };
    }
    case 'arrangeLayer': {
      if (!scene) return state;
      return apply(state, withScene(document, state.format, arrangeLayer(scene, action.id, action.where)));
    }
    case 'settle': return { ...state, history: settle(state.history) };
    case 'cancel': return keepSelection({ ...state, history: cancel(state.history) });
    case 'undo': return keepSelection({ ...state, history: undoHistory(state.history) });
    case 'redo': return keepSelection({ ...state, history: redoHistory(state.history) });
    case 'load': return createEditorState(action.document, action.format ?? state.format);
  }
}
