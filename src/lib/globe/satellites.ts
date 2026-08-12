/**
 * Slang Globe – SlangTag-Satelliten.
 *
 * Reine Auswahl-/Datenlogik: aus den vorhandenen Globe-Regionen (jede Region
 * trägt Lat/Lng) werden Kandidaten gebildet. Die Sichtbarkeit entscheidet
 * ausschließlich die aktuelle Rotation (Vorderseite der Kugel) – berechnet in
 * der bestehenden Engine über `project()`.
 */
import type { GlobeRegion, SlangTagStat } from "./types";

/** Maximal gleichzeitig sichtbare Satelliten. */
export const MAX_SATELLITES = 8;
/** Ab diesem `facing`-Wert darf ein Satellit neu erscheinen. */
export const FACE_IN = 0.5;
/** Unter diesem `facing`-Wert wird er wieder entfernt. */
export const FACE_OUT = 0.22;

export type SatelliteCandidate = {
  id: string;
  /** Originalbegriff des SlangTags (bleibt immer erhalten). */
  tag: string;
  /** Geografischer Ursprung. */
  lat: number;
  lng: number;
  /** Anzeigeort (Stadt, Land) in sehr kleiner Schrift. */
  place: string;
  country: string;
  regionId: string;
  /** Relevanz (Wachstum + Plays) für die Vorauswahl. */
  score: number;
  /** Höhe der Umlaufbahn in Kugelradien. */
  orbit: number;
  /** Individueller Phasenversatz der Satellitenbewegung. */
  phase: number;
};

/**
 * Kandidaten aus den vorhandenen (gefilterten) Regionen: pro Region die
 * aktuellsten/relevantesten SlangTags. Kommen später Live-Daten mit eigener
 * Lat/Lng, ändert sich nur diese Funktion.
 */
export function buildCandidates(regions: GlobeRegion[], perRegion = 2): SatelliteCandidate[] {
  const out: SatelliteCandidate[] = [];
  regions.forEach((r, ri) => {
    const stats: SlangTagStat[] = [...(r.trending ?? []), ...(r.popular ?? [])];
    const seen = new Set<string>();
    let taken = 0;
    for (const s of stats) {
      if (taken >= perRegion) break;
      const key = s.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const i = taken;
      taken += 1;
      out.push({
        id: `${r.id}:${key}`,
        tag: s.name,
        // Leichter Versatz, damit mehrere Tags einer Region nicht überlappen.
        lat: clampLat(r.lat + (i === 0 ? 0 : i % 2 === 0 ? 5.5 : -5.5)),
        lng: r.lng + (i === 0 ? 0 : i % 2 === 0 ? 6 : -6),
        place: r.city ? `${r.city}, ${r.country}` : r.country,
        country: r.country,
        regionId: r.id,
        score: s.growth * 0.6 + Math.log10(Math.max(10, s.plays)) * 10,
        orbit: 1.3 + ((ri + i) % 4) * 0.055,
        phase: ((ri * 7 + i * 3) % 20) * 0.31,
      });
    }
  });
  return out;
}

function clampLat(v: number): number {
  return Math.min(78, Math.max(-78, v));
}
