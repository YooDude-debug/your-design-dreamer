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
  AL: () => import("@/data/admin1-al.json"),
  AT: () => import("@/data/admin1-at.json"),
  BA: () => import("@/data/admin1-ba.json"),
  BE: () => import("@/data/admin1-be.json"),
  BG: () => import("@/data/admin1-bg.json"),
  BY: () => import("@/data/admin1-by.json"),
  CH: () => import("@/data/admin1-ch.json"),
  CZ: () => import("@/data/admin1-cz.json"),
  DE: () => import("@/data/admin1-de.json"),
  DK: () => import("@/data/admin1-dk.json"),
  EE: () => import("@/data/admin1-ee.json"),
  ES: () => import("@/data/admin1-es.json"),
  FI: () => import("@/data/admin1-fi.json"),
  FR: () => import("@/data/admin1-fr.json"),
  GB: () => import("@/data/admin1-gb.json"),
  GR: () => import("@/data/admin1-gr.json"),
  HR: () => import("@/data/admin1-hr.json"),
  HU: () => import("@/data/admin1-hu.json"),
  IE: () => import("@/data/admin1-ie.json"),
  IS: () => import("@/data/admin1-is.json"),
  IT: () => import("@/data/admin1-it.json"),
  LT: () => import("@/data/admin1-lt.json"),
  LU: () => import("@/data/admin1-lu.json"),
  LV: () => import("@/data/admin1-lv.json"),
  MD: () => import("@/data/admin1-md.json"),
  ME: () => import("@/data/admin1-me.json"),
  MK: () => import("@/data/admin1-mk.json"),
  NL: () => import("@/data/admin1-nl.json"),
  NO: () => import("@/data/admin1-no.json"),
  PL: () => import("@/data/admin1-pl.json"),
  PT: () => import("@/data/admin1-pt.json"),
  RO: () => import("@/data/admin1-ro.json"),
  RS: () => import("@/data/admin1-rs.json"),
  SE: () => import("@/data/admin1-se.json"),
  SI: () => import("@/data/admin1-si.json"),
  SK: () => import("@/data/admin1-sk.json"),
  TR: () => import("@/data/admin1-tr.json"),
  UA: () => import("@/data/admin1-ua.json"),
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
