/** Reverse-Geocoding-Ergebnis: Stadt, Region, Land. */
export type GeoPlace = { city: string; region: string; country: string };

export function formatPlace(p: GeoPlace | null, cityOnly = false) {
  if (!p) return "";
  const parts = cityOnly ? [p.city] : [p.city, p.region, p.country];
  return parts.filter(Boolean).join(", ");
}
