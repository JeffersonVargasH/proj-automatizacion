// Límite simple por usuario y acción, en memoria del proceso. Suficiente para un solo servidor;
// con varias instancias habría que moverlo a la base o a Redis.
const hits = new Map<string, number[]>();

export function allow(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) || []).filter(at => now - at < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export const limits = {
  copy: { max: 30, windowMs: 10 * 60_000 },
  generate: { max: 10, windowMs: 10 * 60_000 },
  publish: { max: 30, windowMs: 10 * 60_000 },
  invite: { max: 200, windowMs: 60 * 60_000 },
} as const;
