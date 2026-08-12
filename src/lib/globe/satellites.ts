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
  /** Geografischer Ursprung – einzige Quelle der Wahrheit. */
  lat: number;
  lng: number;
  /** Anzeigeort (Stadt, Land) in sehr kleiner Schrift. */
  place: string;
  country: string;
  regionId: string;
  /** Relevanz (Wachstum + Plays) für die Vorauswahl. */
  score: number;
  /** Label-Versatz in Bildschirmpixeln (nur Lesbarkeit, nie Geografie). */
  labelAngle: number;
  labelDist: number;
};

/**
 * Kandidaten aus den vorhandenen (gefilterten) Regionen: pro Region die
 * aktuellsten/relevantesten SlangTags. Die Koordinaten kommen unverändert aus
 * den Regionsdaten; Regionen ohne gültige Lat/Lng werden übersprungen.
 */
export function buildCandidates(regions: GlobeRegion[], perRegion = 2): SatelliteCandidate[] {
  const out: SatelliteCandidate[] = [];
  regions.forEach((r, ri) => {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) return;
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
        lat: r.lat,
        lng: r.lng,
        place: r.city ? `${r.city}, ${r.country}` : r.country,
        country: r.country,
        regionId: r.id,
        score: s.growth * 0.6 + Math.log10(Math.max(10, s.plays)) * 10,
        // Deterministischer Versatz im Screen-Raum (Radiant + Pixel).
        labelAngle: (-Math.PI / 2) + (((ri * 5 + i * 3) % 8) / 8) * Math.PI * 2 * 0.42,
        labelDist: 58 + ((ri + i * 2) % 4) * 14,
      });
    }
  });
  return out;
}

