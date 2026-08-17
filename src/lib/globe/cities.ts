/**
 * Slang Globe – Städte je Detailstufe (Level 2/3).
 *
 * Statische, sehr kleine Tabelle (kein Netzwerk, keine API-Requests). Die
 * Stufe (`tier`) bestimmt, ab welcher Zoomtiefe eine Stadt eingeblendet wird:
 *
 * - tier 1 → Level 2 (Land ausgewählt): Metropolen / Landeshauptstädte
 * - tier 2 → Level 3 (Region): wichtige Groß- und Regionalstädte
 * - tier 3 → Level 3 nah (Stadt/lokal): weitere Städte
 *
 * Damit gilt: je näher der Zoom, desto mehr Orte – und beim Herauszoomen
 * verschwinden die feinen Stufen wieder vollständig aus dem DOM.
 */

export type GlobeCity = {
  name: string;
  lat: number;
  lng: number;
  tier: 1 | 2 | 3;
  /** Bundesland/Region – nur informativ im Label-Titel. */
  region?: string;
};

const DE: GlobeCity[] = [
  { name: "Berlin", lat: 52.52, lng: 13.405, tier: 1, region: "Berlin" },
  { name: "Hamburg", lat: 53.55, lng: 9.993, tier: 1, region: "Hamburg" },
  { name: "München", lat: 48.137, lng: 11.575, tier: 1, region: "Bayern" },
  { name: "Köln", lat: 50.937, lng: 6.96, tier: 1, region: "Nordrhein-Westfalen" },
  { name: "Frankfurt", lat: 50.11, lng: 8.682, tier: 1, region: "Hessen" },
  { name: "Stuttgart", lat: 48.776, lng: 9.182, tier: 1, region: "Baden-Württemberg" },
  { name: "Leipzig", lat: 51.34, lng: 12.375, tier: 1, region: "Sachsen" },
  { name: "Düsseldorf", lat: 51.226, lng: 6.782, tier: 2, region: "Nordrhein-Westfalen" },
  { name: "Dortmund", lat: 51.514, lng: 7.466, tier: 2, region: "Nordrhein-Westfalen" },
  { name: "Essen", lat: 51.456, lng: 7.012, tier: 2, region: "Nordrhein-Westfalen" },
  { name: "Bremen", lat: 53.079, lng: 8.802, tier: 2, region: "Bremen" },
  { name: "Dresden", lat: 51.05, lng: 13.738, tier: 2, region: "Sachsen" },
  { name: "Hannover", lat: 52.376, lng: 9.735, tier: 2, region: "Niedersachsen" },
  { name: "Nürnberg", lat: 49.452, lng: 11.077, tier: 2, region: "Bayern" },
  { name: "Rostock", lat: 54.092, lng: 12.099, tier: 2, region: "Mecklenburg-Vorpommern" },
  { name: "Mainz", lat: 49.993, lng: 8.247, tier: 2, region: "Rheinland-Pfalz" },
  { name: "Saarbrücken", lat: 49.24, lng: 6.997, tier: 2, region: "Saarland" },
  { name: "Kiel", lat: 54.323, lng: 10.135, tier: 2, region: "Schleswig-Holstein" },
  { name: "Magdeburg", lat: 52.121, lng: 11.627, tier: 2, region: "Sachsen-Anhalt" },
  { name: "Erfurt", lat: 50.978, lng: 11.029, tier: 2, region: "Thüringen" },
  { name: "Potsdam", lat: 52.396, lng: 13.059, tier: 2, region: "Brandenburg" },
  { name: "Chemnitz", lat: 50.828, lng: 12.921, tier: 3, region: "Sachsen" },
  { name: "Augsburg", lat: 48.371, lng: 10.898, tier: 3, region: "Bayern" },
  { name: "Bochum", lat: 51.482, lng: 7.216, tier: 3, region: "Nordrhein-Westfalen" },
  { name: "Wuppertal", lat: 51.256, lng: 7.15, tier: 3, region: "Nordrhein-Westfalen" },
  { name: "Bielefeld", lat: 52.03, lng: 8.532, tier: 3, region: "Nordrhein-Westfalen" },
  { name: "Bonn", lat: 50.735, lng: 7.1, tier: 3, region: "Nordrhein-Westfalen" },
  { name: "Münster", lat: 51.96, lng: 7.626, tier: 3, region: "Nordrhein-Westfalen" },
  { name: "Karlsruhe", lat: 49.007, lng: 8.404, tier: 3, region: "Baden-Württemberg" },
  { name: "Mannheim", lat: 49.488, lng: 8.469, tier: 3, region: "Baden-Württemberg" },
  { name: "Freiburg", lat: 47.999, lng: 7.842, tier: 3, region: "Baden-Württemberg" },
  { name: "Würzburg", lat: 49.792, lng: 9.953, tier: 3, region: "Bayern" },
  { name: "Regensburg", lat: 49.013, lng: 12.101, tier: 3, region: "Bayern" },
  { name: "Braunschweig", lat: 52.269, lng: 10.521, tier: 3, region: "Niedersachsen" },
  { name: "Osnabrück", lat: 52.279, lng: 8.047, tier: 3, region: "Niedersachsen" },
  { name: "Lübeck", lat: 53.866, lng: 10.687, tier: 3, region: "Schleswig-Holstein" },
  { name: "Jena", lat: 50.927, lng: 11.589, tier: 3, region: "Thüringen" },
  { name: "Halle", lat: 51.483, lng: 11.97, tier: 3, region: "Sachsen-Anhalt" },
  { name: "Cottbus", lat: 51.757, lng: 14.329, tier: 3, region: "Brandenburg" },
  { name: "Schwerin", lat: 53.636, lng: 11.401, tier: 3, region: "Mecklenburg-Vorpommern" },
];

const GR: GlobeCity[] = [
  { name: "Athen", lat: 37.984, lng: 23.728, tier: 1, region: "Attika" },
  { name: "Thessaloniki", lat: 40.64, lng: 22.944, tier: 1, region: "Zentralmakedonien" },
  { name: "Patras", lat: 38.246, lng: 21.735, tier: 2 },
  { name: "Heraklion", lat: 35.339, lng: 25.133, tier: 2, region: "Kreta" },
  { name: "Larisa", lat: 39.639, lng: 22.419, tier: 3 },
  { name: "Rhodos", lat: 36.434, lng: 28.218, tier: 3 },
];

const BR: GlobeCity[] = [
  { name: "Rio de Janeiro", lat: -22.907, lng: -43.173, tier: 1 },
  { name: "São Paulo", lat: -23.551, lng: -46.633, tier: 1 },
  { name: "Brasília", lat: -15.794, lng: -47.882, tier: 1 },
  { name: "Salvador", lat: -12.977, lng: -38.501, tier: 2 },
  { name: "Belo Horizonte", lat: -19.917, lng: -43.934, tier: 2 },
  { name: "Recife", lat: -8.048, lng: -34.877, tier: 3 },
  { name: "Porto Alegre", lat: -30.033, lng: -51.23, tier: 3 },
];

const JP: GlobeCity[] = [
  { name: "Tokio", lat: 35.682, lng: 139.759, tier: 1 },
  { name: "Osaka", lat: 34.694, lng: 135.502, tier: 1 },
  { name: "Kyoto", lat: 35.011, lng: 135.768, tier: 2 },
  { name: "Sapporo", lat: 43.062, lng: 141.354, tier: 2 },
  { name: "Fukuoka", lat: 33.59, lng: 130.402, tier: 3 },
  { name: "Nagoya", lat: 35.181, lng: 136.906, tier: 3 },
];

const BY_COUNTRY: Record<string, GlobeCity[]> = { DE, GR, BR, JP };

/** Städte eines Landes bis zur angegebenen Stufe (leer, wenn unbekannt). */
export function citiesForCountry(countryCode: string, maxTier: 1 | 2 | 3): GlobeCity[] {
  const list = BY_COUNTRY[countryCode.toUpperCase()];
  if (!list) return [];
  return list.filter((c) => c.tier <= maxTier);
}

export function hasCities(countryCode: string): boolean {
  return Boolean(BY_COUNTRY[countryCode.toUpperCase()]);
}
