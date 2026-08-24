/**
 * Slang Globe – Europa-Register (Level 2).
 *
 * Enthält ausschließlich winzige Metadaten (Mittelpunkt + Fokusradius je
 * Land). Damit kann der Globe erkennen, welches europäische Land betrachtet
 * wird, ohne dafür Geometrie zu laden. Die eigentlichen Detaildaten
 * (Verwaltungsgrenzen, Städte) werden erst danach pro Land nachgeladen –
 * genau wie bei der bestehenden Deutschland-Stufe.
 */

export type EuropeCountry = {
  code: string;
  name: string;
  lat: number;
  lng: number;
  /** Winkelradius (Grad), innerhalb dessen das Land als „betrachtet“ gilt. */
  radius: number;
};

export const EUROPE_COUNTRIES: EuropeCountry[] = [
  { code: "DE", name: "Deutschland", lat: 51.1, lng: 10.3, radius: 6 },
  { code: "FR", name: "Frankreich", lat: 46.6, lng: 2.4, radius: 6.5 },
  { code: "ES", name: "Spanien", lat: 40.3, lng: -3.7, radius: 7 },
  { code: "PT", name: "Portugal", lat: 39.6, lng: -8.2, radius: 4 },
  { code: "IT", name: "Italien", lat: 42.8, lng: 12.5, radius: 6.5 },
  { code: "GR", name: "Griechenland", lat: 39.0, lng: 22.5, radius: 5 },
  { code: "PL", name: "Polen", lat: 52.1, lng: 19.4, radius: 5.5 },
  { code: "GB", name: "Vereinigtes Königreich", lat: 54.2, lng: -2.6, radius: 6 },
  { code: "IE", name: "Irland", lat: 53.2, lng: -8.0, radius: 3.5 },
  { code: "NL", name: "Niederlande", lat: 52.2, lng: 5.5, radius: 3 },
  { code: "BE", name: "Belgien", lat: 50.6, lng: 4.6, radius: 2.5 },
  { code: "LU", name: "Luxemburg", lat: 49.8, lng: 6.1, radius: 1.2 },
  { code: "SE", name: "Schweden", lat: 62.2, lng: 15.5, radius: 8 },
  { code: "NO", name: "Norwegen", lat: 63.5, lng: 10.5, radius: 8 },
  { code: "DK", name: "Dänemark", lat: 56.1, lng: 9.7, radius: 3 },
  { code: "FI", name: "Finnland", lat: 63.5, lng: 26.0, radius: 7 },
  { code: "IS", name: "Island", lat: 64.9, lng: -18.6, radius: 4 },
  { code: "AT", name: "Österreich", lat: 47.6, lng: 14.1, radius: 3.5 },
  { code: "CH", name: "Schweiz", lat: 46.8, lng: 8.2, radius: 2.5 },
  { code: "CZ", name: "Tschechien", lat: 49.8, lng: 15.4, radius: 3.5 },
  { code: "SK", name: "Slowakei", lat: 48.7, lng: 19.5, radius: 3 },
  { code: "HU", name: "Ungarn", lat: 47.1, lng: 19.5, radius: 3.5 },
  { code: "RO", name: "Rumänien", lat: 45.9, lng: 25.0, radius: 5 },
  { code: "BG", name: "Bulgarien", lat: 42.7, lng: 25.3, radius: 4 },
  { code: "HR", name: "Kroatien", lat: 45.1, lng: 16.3, radius: 3.5 },
  { code: "SI", name: "Slowenien", lat: 46.1, lng: 14.8, radius: 2 },
  { code: "RS", name: "Serbien", lat: 44.1, lng: 20.8, radius: 3.5 },
  { code: "BA", name: "Bosnien und Herzegowina", lat: 44.0, lng: 17.8, radius: 2.5 },
  { code: "ME", name: "Montenegro", lat: 42.8, lng: 19.3, radius: 1.6 },
  { code: "MK", name: "Nordmazedonien", lat: 41.6, lng: 21.7, radius: 2 },
  { code: "AL", name: "Albanien", lat: 41.1, lng: 20.1, radius: 2 },
  { code: "EE", name: "Estland", lat: 58.7, lng: 25.5, radius: 2.5 },
  { code: "LV", name: "Lettland", lat: 56.9, lng: 24.6, radius: 2.5 },
  { code: "LT", name: "Litauen", lat: 55.2, lng: 23.9, radius: 2.5 },
  { code: "UA", name: "Ukraine", lat: 48.8, lng: 31.2, radius: 7 },
  { code: "MD", name: "Moldau", lat: 47.2, lng: 28.5, radius: 2 },
  { code: "BY", name: "Belarus", lat: 53.7, lng: 28.0, radius: 4.5 },
  { code: "TR", name: "Türkei", lat: 39.0, lng: 35.0, radius: 8 },
];

const BY_CODE = new Map(EUROPE_COUNTRIES.map((c) => [c.code, c]));

/** Grober Europa-Ausschnitt für Level 2 (inkl. Türkei/Island). */
export const EUROPE_BOUNDS = { latMin: 33, latMax: 72, lngMin: -26, lngMax: 46 };

export function isInEurope(lat: number, lng: number): boolean {
  const b = EUROPE_BOUNDS;
  return lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax;
}

export function europeCountry(code: string): EuropeCountry | null {
  return BY_CODE.get(code.toUpperCase()) ?? null;
}

const DEG = Math.PI / 180;

function angleDeg(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const s =
    Math.sin(aLat * DEG) * Math.sin(bLat * DEG) +
    Math.cos(aLat * DEG) * Math.cos(bLat * DEG) * Math.cos((aLng - bLng) * DEG);
  return Math.acos(Math.min(1, Math.max(-1, s))) / DEG;
}

/**
 * Land unter der Bildmitte bestimmen (Level 3). Nur Metadaten, kein Laden.
 * `zoom` (0–1) weitet den Fangradius in der Ferne leicht auf, damit der
 * Übergang Europa → Land nicht ruckelt.
 */
export function europeCountryAt(lat: number, lng: number, zoom: number): EuropeCountry | null {
  if (!isInEurope(lat, lng)) return null;
  const slack = 1 + (1 - Math.min(1, Math.max(0, zoom))) * 1.6;
  let best: EuropeCountry | null = null;
  let bestScore = Infinity;
  for (const c of EUROPE_COUNTRIES) {
    const d = angleDeg(lat, lng, c.lat, c.lng);
    const limit = c.radius * slack;
    if (d > limit) continue;
    const score = d / limit;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}
