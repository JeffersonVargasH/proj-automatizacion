// Historial genérico de deshacer/rehacer. Guarda instantáneas inmutables (escena, o escena + campos comerciales).
// Un arrastre o una transformación se muestra en vivo con `preview` y cuenta como un solo paso al llamar a `settle`.

export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  /** Estado previo a una vista previa en curso (arrastre, giro, slider). */
  pending: T | null;
  limit: number;
};

export const DEFAULT_HISTORY_LIMIT = 50;

export function createHistory<T>(present: T, limit = DEFAULT_HISTORY_LIMIT): History<T> {
  return { past: [], present, future: [], pending: null, limit: Math.max(1, Math.floor(limit)) };
}

const trim = <T>(list: T[], limit: number) => list.length > limit ? list.slice(list.length - limit) : list;

/** Registra un cambio como un paso. Si `next` es el mismo estado, no hace nada. */
export function commit<T>(history: History<T>, next: T): History<T> {
  const base = history.pending ?? history.present;
  if (next === base) return history.pending !== null ? { ...history, present: base, pending: null } : history;
  return { ...history, past: trim([...history.past, base], history.limit), present: next, future: [], pending: null };
}

/** Muestra un cambio en curso sin registrarlo todavía. */
export function preview<T>(history: History<T>, next: T): History<T> {
  if (next === history.present) return history;
  return { ...history, pending: history.pending ?? history.present, present: next };
}

/** Termina la vista previa en curso y la registra como un único paso. */
export function settle<T>(history: History<T>): History<T> {
  if (history.pending === null) return history;
  return commit({ ...history, pending: null, present: history.pending }, history.present);
}

/** Descarta la vista previa en curso (por ejemplo, al presionar Escape durante un arrastre). */
export function cancel<T>(history: History<T>): History<T> {
  return history.pending !== null ? { ...history, present: history.pending, pending: null } : history;
}

export function undo<T>(source: History<T>): History<T> {
  const history = settle(source);
  if (!history.past.length) return history;
  const previous = history.past[history.past.length - 1];
  return { ...history, past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redo<T>(source: History<T>): History<T> {
  const history = settle(source);
  if (!history.future.length) return history;
  const [next, ...future] = history.future;
  return { ...history, past: trim([...history.past, history.present], history.limit), present: next, future };
}

export const canUndo = <T>(history: History<T>) => history.past.length > 0 || history.pending !== null;
export const canRedo = <T>(history: History<T>) => history.future.length > 0 && history.pending === null;

/** Reemplaza todo el historial (al abrir otro diseño o cambiar de formato). */
export const resetHistory = <T>(history: History<T>, present: T): History<T> => createHistory(present, history.limit);
