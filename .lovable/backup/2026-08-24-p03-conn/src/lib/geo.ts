/** Reverse-Geocoding-Ergebnis: Stadt, Region, Land. */
export type GeoPlace = { city: string; region: string; country: string };

export function formatPlace(p: GeoPlace | null, cityOnly = false) {
  if (!p) return "";
  const parts = cityOnly ? [p.city] : [p.city, p.region, p.country];
  return parts.filter(Boolean).join(", ");
}

/** Ergebnis einer Ortssuche inkl. echter Koordinaten (für den Slang Globe). */
export type GeoPoint = {
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
};

/**
 * Reverse-Geocoding (gleicher Dienst wie im bestehenden LocationPicker),
 * liefert zusätzlich die übergebenen Koordinaten zurück.
 */
export async function reverseGeoPoint(lat: number, lon: number, lang: string): Promise<GeoPoint> {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${lang}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("geocode failed");
  const d = (await res.json()) as {
    city?: string;
    locality?: string;
    principalSubdivision?: string;
    countryName?: string;
  };
  return {
    city: d.city || d.locality || "",
    region: d.principalSubdivision ?? "",
    country: d.countryName ?? "",
    latitude: lat,
    longitude: lon,
  };
}

/** Ortssuche nach Name → Vorschläge mit Latitude/Longitude. */
export async function searchGeoPoints(query: string, lang: string): Promise<GeoPoint[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=${lang}&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("geocode search failed");
  const d = (await res.json()) as {
    results?: {
      name?: string;
      admin1?: string;
      country?: string;
      latitude?: number;
      longitude?: number;
    }[];
  };
  return (d.results ?? [])
    .filter((r) => typeof r.latitude === "number" && typeof r.longitude === "number")
    .map((r) => ({
      city: r.name ?? "",
      region: r.admin1 ?? "",
      country: r.country ?? "",
      latitude: r.latitude!,
      longitude: r.longitude!,
    }));
}
