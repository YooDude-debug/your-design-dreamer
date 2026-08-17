/**
 * Slang Globe – progressive Geodaten (Level 2/3).
 *
 * Grundsatz: In der Weltansicht wird NICHTS davon geladen. Erst wenn der
 * Nutzer in ein Land hineingeht (Länderfilter oder Zoom), wird genau der
 * dafür nötige Datensatz einmal per dynamischem Import nachgeladen und danach
 * im Modul-Cache wiederverwendet (keine Duplikate, keine erneuten Requests).
 *
 * Datenquelle Bundesländer: deutschlandGeoJSON (Public Domain / ODbL-frei,
 * abgeleitet aus amtlichen Grenzen), vorverarbeitet zu reinen Polylinien mit
 * ~800 m Toleranz (≈100 KB) – bewusst außerhalb des Initial-Bundles.
 */
import type { BorderLines } from "./borders";

/** Länder mit verfügbarer Verwaltungsebene 1 (Bundesländer/Provinzen). */
const LOADERS: Record<string, () => Promise<unknown>> = {
  DE: () => import("@/data/admin1-de.json"),
};

const cache = new Map<string, BorderLines>();
const inflight = new Map<string, Promise<BorderLines | null>>();

/** true, wenn für dieses Land überhaupt eine Detailebene existiert. */
export function hasAdmin1(countryCode: string): boolean {
  return Boolean(LOADERS[countryCode.toUpperCase()]);
}

/** Bereits geladene Daten synchron (ohne neuen Ladevorgang). */
export function admin1Cached(countryCode: string): BorderLines | null {
  return cache.get(countryCode.toUpperCase()) ?? null;
}

/**
 * Verwaltungsgrenzen eines Landes laden. Mehrfache Aufrufe teilen dieselbe
 * Promise; ein Fehlschlag darf den Globe nie beeinträchtigen (→ `null`).
 */
export function loadAdmin1(countryCode: string): Promise<BorderLines | null> {
  const code = countryCode.toUpperCase();
  const hit = cache.get(code);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(code);
  if (pending) return pending;
  const loader = LOADERS[code];
  if (!loader) return Promise.resolve(null);
  const p = loader()
    .then((mod) => {
      const lines = ((mod as { default?: unknown }).default ?? mod) as BorderLines;
      cache.set(code, lines);
      inflight.delete(code);
      return lines;
    })
    .catch(() => {
      inflight.delete(code);
      return null;
    });
  inflight.set(code, p);
  return p;
}
