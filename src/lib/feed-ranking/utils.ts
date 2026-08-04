/**
 * Kleine, geteilte Hilfsfunktionen der Ranking-Module.
 * Rein funktional, ohne Seiteneffekte.
 */

export function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Normalisiert Freitext für Vergleiche (Region, Interessen, Hashtags). */
export function norm(value: string | undefined | null) {
  return (value ?? "").trim().toLowerCase();
}

/** Zerlegt "Hamburg, Deutschland" in normalisierte Bestandteile. */
export function locationParts(value: string | undefined | null) {
  return norm(value)
    .split(/[,/|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Sanft sättigende Kurve: 0 → 0, wächst schnell, nähert sich 1. */
export function saturate(value: number, halfPoint: number) {
  if (value <= 0 || halfPoint <= 0) return 0;
  return value / (value + halfPoint);
}

/** Deterministischer Pseudo-Zufall aus einer Zeichenkette (0..1). */
export function hashUnit(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100_000) / 100_000;
}
