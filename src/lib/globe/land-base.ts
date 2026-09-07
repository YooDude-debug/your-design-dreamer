/**
 * Slang Globe – Basis-Landmassen (50m) als eigener, nachgeladener Datensatz.
 *
 * Warum eigenes Modul: die Polygone (~843 KB Quelltext) waren zuvor per
 * statischem Import Teil des Globe-Programmcodes und damit fest im selben
 * Chunk wie three.js und die Globe-Oberfläche. Dadurch musste beim Öffnen des
 * Globe erst der gesamte Block übertragen und geparst werden, bevor überhaupt
 * etwas passieren konnte.
 *
 * Jetzt liegt der Datensatz in einem eigenen Chunk, wird parallel geladen und
 * modulweit gecacht: gleiche Daten, gleiche Genauigkeit, nur entkoppelt vom
 * Programmcode. Mehrfache Aufrufe teilen dieselbe Promise (keine Duplikate).
 */

/** [lon, lat]-Ringe je Polygon. */
export type LandPolys = [number, number][][][];

let cache: LandPolys | null = null;
let inflight: Promise<LandPolys> | null = null;

/** Bereits geladene Basisdaten synchron (ohne neuen Ladevorgang). */
export function landBaseCached(): LandPolys | null {
  return cache;
}

/** Basis-Landmassen laden (einmalig, danach aus dem Modul-Cache). */
export function loadLandBase(): Promise<LandPolys> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = import("@/data/land-50m.json")
    .then((mod) => {
      const polys = ((mod as { default?: unknown }).default ?? mod) as LandPolys;
      cache = polys;
      inflight = null;
      return polys;
    })
    .catch((err: unknown) => {
      inflight = null;
      throw err;
    });
  return inflight;
}
