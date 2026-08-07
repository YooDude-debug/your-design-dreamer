/**
 * Slang Globe – Demo-Datenquelle.
 *
 * Rein lokal simuliert (keine Datenbank, kein Feed-Zugriff). Deterministisch,
 * damit SSR und Client identisch rendern und kein Zufall im Modul-Scope läuft.
 */
import type {
  GlobeDataSource,
  GlobeFilters,
  GlobeRange,
  GlobeRegion,
  SlangTagStat,
} from "./types";

type Seed = {
  country: string;
  code: string;
  city: string;
  lat: number;
  lng: number;
  lang: string;
  cat: string;
  tags: string[];
};

const SEEDS: Seed[] = [
  { country: "Deutschland", code: "DE", city: "Berlin", lat: 52.52, lng: 13.4, lang: "Deutsch", cat: "Straße", tags: ["digga", "lauch", "wildern", "sheesh"] },
  { country: "Deutschland", code: "DE", city: "Hamburg", lat: 53.55, lng: 9.99, lang: "Deutsch", cat: "Alltag", tags: ["moinmoin", "schnacken", "büx"] },
  { country: "Deutschland", code: "DE", city: "Köln", lat: 50.94, lng: 6.96, lang: "Deutsch", cat: "Karneval", tags: ["kölle", "jetzt-ävver", "bützen"] },
  { country: "Deutschland", code: "DE", city: "München", lat: 48.14, lng: 11.58, lang: "Deutsch", cat: "Alltag", tags: ["oida", "servus", "brotzeit"] },
  { country: "Deutschland", code: "DE", city: "Leipzig", lat: 51.34, lng: 12.37, lang: "Deutsch", cat: "Musik", tags: ["nu", "gell", "mopped"] },
  { country: "Österreich", code: "AT", city: "Wien", lat: 48.21, lng: 16.37, lang: "Deutsch", cat: "Straße", tags: ["oida", "leiwand", "hawara"] },
  { country: "Schweiz", code: "CH", city: "Zürich", lat: 47.37, lng: 8.54, lang: "Deutsch", cat: "Alltag", tags: ["giggerig", "chuchichäschtli", "hoi"] },
  { country: "Niederlande", code: "NL", city: "Amsterdam", lat: 52.37, lng: 4.9, lang: "Niederländisch", cat: "Musik", tags: ["gezellig", "wollah", "faka"] },
  { country: "Frankreich", code: "FR", city: "Paris", lat: 48.86, lng: 2.35, lang: "Französisch", cat: "Straße", tags: ["wesh", "bg", "ça-caille"] },
  { country: "Frankreich", code: "FR", city: "Marseille", lat: 43.3, lng: 5.37, lang: "Französisch", cat: "Sport", tags: ["degun", "oai", "zbeul"] },
  { country: "Spanien", code: "ES", city: "Madrid", lat: 40.42, lng: -3.7, lang: "Spanisch", cat: "Alltag", tags: ["chaval", "flipo", "guay"] },
  { country: "Spanien", code: "ES", city: "Barcelona", lat: 41.39, lng: 2.17, lang: "Katalanisch", cat: "Musik", tags: ["nen", "quilla", "fiesta"] },
  { country: "Italien", code: "IT", city: "Rom", lat: 41.9, lng: 12.5, lang: "Italienisch", cat: "Alltag", tags: ["daje", "bella", "zio"] },
  { country: "Italien", code: "IT", city: "Mailand", lat: 45.46, lng: 9.19, lang: "Italienisch", cat: "Mode", tags: ["boh", "raga", "figata"] },
  { country: "Portugal", code: "PT", city: "Lissabon", lat: 38.72, lng: -9.14, lang: "Portugiesisch", cat: "Musik", tags: ["pá", "bué", "fixe"] },
  { country: "Vereinigtes Königreich", code: "GB", city: "London", lat: 51.51, lng: -0.13, lang: "Englisch", cat: "Straße", tags: ["peak", "bare", "wagwan", "innit"] },
  { country: "Vereinigtes Königreich", code: "GB", city: "Manchester", lat: 53.48, lng: -2.24, lang: "Englisch", cat: "Sport", tags: ["mint", "sound", "our-kid"] },
  { country: "Irland", code: "IE", city: "Dublin", lat: 53.35, lng: -6.26, lang: "Englisch", cat: "Alltag", tags: ["grand", "craic", "deadly"] },
  { country: "Polen", code: "PL", city: "Warschau", lat: 52.23, lng: 21.01, lang: "Polnisch", cat: "Gaming", tags: ["masakra", "sztos", "elo"] },
  { country: "Schweden", code: "SE", city: "Stockholm", lat: 59.33, lng: 18.07, lang: "Schwedisch", cat: "Musik", tags: ["chill", "shuno", "asg"] },
  { country: "Norwegen", code: "NO", city: "Oslo", lat: 59.91, lng: 10.75, lang: "Norwegisch", cat: "Alltag", tags: ["kult", "keen", "serr"] },
  { country: "Dänemark", code: "DK", city: "Kopenhagen", lat: 55.68, lng: 12.57, lang: "Dänisch", cat: "Alltag", tags: ["hygge", "sgu", "agurk"] },
  { country: "Finnland", code: "FI", city: "Helsinki", lat: 60.17, lng: 24.94, lang: "Finnisch", cat: "Gaming", tags: ["sika", "kiva", "no-huh"] },
  { country: "Tschechien", code: "CZ", city: "Prag", lat: 50.08, lng: 14.44, lang: "Tschechisch", cat: "Alltag", tags: ["boží", "hustý", "čau"] },
  { country: "Ungarn", code: "HU", city: "Budapest", lat: 47.5, lng: 19.04, lang: "Ungarisch", cat: "Musik", tags: ["tesó", "zsír", "csá"] },
  { country: "Griechenland", code: "GR", city: "Athen", lat: 37.98, lng: 23.73, lang: "Griechisch", cat: "Alltag", tags: ["re", "malaka", "tsakise"] },
  { country: "Türkei", code: "TR", city: "Istanbul", lat: 41.01, lng: 28.98, lang: "Türkisch", cat: "Straße", tags: ["abi", "kanka", "helal"] },
  { country: "Ukraine", code: "UA", city: "Kyiv", lat: 50.45, lng: 30.52, lang: "Ukrainisch", cat: "Alltag", tags: ["shara", "kruto", "zbs"] },
  { country: "Marokko", code: "MA", city: "Casablanca", lat: 33.57, lng: -7.59, lang: "Arabisch", cat: "Straße", tags: ["zwin", "wa3ra", "safi"] },
  { country: "Nigeria", code: "NG", city: "Lagos", lat: 6.52, lng: 3.38, lang: "Englisch", cat: "Musik", tags: ["gbedu", "japa", "no-wahala"] },
  { country: "Ghana", code: "GH", city: "Accra", lat: 5.6, lng: -0.19, lang: "Englisch", cat: "Musik", tags: ["chale", "sharp", "azonto"] },
  { country: "Kenia", code: "KE", city: "Nairobi", lat: -1.29, lng: 36.82, lang: "Swahili", cat: "Alltag", tags: ["sheng", "poa", "mambo"] },
  { country: "Südafrika", code: "ZA", city: "Johannesburg", lat: -26.2, lng: 28.05, lang: "Englisch", cat: "Straße", tags: ["eish", "sharp-sharp", "yoh"] },
  { country: "Ägypten", code: "EG", city: "Kairo", lat: 30.04, lng: 31.24, lang: "Arabisch", cat: "Alltag", tags: ["gamed", "khalas", "yalla"] },
  { country: "Vereinigte Arabische Emirate", code: "AE", city: "Dubai", lat: 25.2, lng: 55.27, lang: "Arabisch", cat: "Mode", tags: ["yalla", "habibi", "walla"] },
  { country: "Indien", code: "IN", city: "Mumbai", lat: 19.08, lng: 72.88, lang: "Hindi", cat: "Musik", tags: ["bindaas", "jhakaas", "yaar"] },
  { country: "Indien", code: "IN", city: "Delhi", lat: 28.61, lng: 77.21, lang: "Hindi", cat: "Straße", tags: ["scene", "bhai", "jugaad"] },
  { country: "Pakistan", code: "PK", city: "Karatschi", lat: 24.86, lng: 67.01, lang: "Urdu", cat: "Alltag", tags: ["yaar", "chill-kar", "bakwas"] },
  { country: "Japan", code: "JP", city: "Tokio", lat: 35.68, lng: 139.69, lang: "Japanisch", cat: "Gaming", tags: ["yabai", "sugoi", "maji"] },
  { country: "Japan", code: "JP", city: "Osaka", lat: 34.69, lng: 135.5, lang: "Japanisch", cat: "Comedy", tags: ["nandeyanen", "meccha", "akan"] },
  { country: "Südkorea", code: "KR", city: "Seoul", lat: 37.57, lng: 126.98, lang: "Koreanisch", cat: "Musik", tags: ["daebak", "jinjja", "hul"] },
  { country: "China", code: "CN", city: "Shanghai", lat: 31.23, lng: 121.47, lang: "Chinesisch", cat: "Mode", tags: ["niubi", "yyds", "juejuezi"] },
  { country: "Indonesien", code: "ID", city: "Jakarta", lat: -6.21, lng: 106.85, lang: "Indonesisch", cat: "Alltag", tags: ["anjay", "gokil", "santuy"] },
  { country: "Philippinen", code: "PH", city: "Manila", lat: 14.6, lng: 120.98, lang: "Filipino", cat: "Comedy", tags: ["lodi", "petmalu", "werpa"] },
  { country: "Thailand", code: "TH", city: "Bangkok", lat: 13.76, lng: 100.5, lang: "Thai", cat: "Alltag", tags: ["sabai", "jing-jing", "aroi"] },
  { country: "Vietnam", code: "VN", city: "Hanoi", lat: 21.03, lng: 105.85, lang: "Vietnamesisch", cat: "Gaming", tags: ["troi-oi", "xin", "chill"] },
  { country: "Australien", code: "AU", city: "Sydney", lat: -33.87, lng: 151.21, lang: "Englisch", cat: "Sport", tags: ["arvo", "heaps", "deadset"] },
  { country: "Australien", code: "AU", city: "Melbourne", lat: -37.81, lng: 144.96, lang: "Englisch", cat: "Musik", tags: ["sus", "maccas", "reckon"] },
  { country: "Neuseeland", code: "NZ", city: "Auckland", lat: -36.85, lng: 174.76, lang: "Englisch", cat: "Alltag", tags: ["choice", "sweet-as", "chur"] },
  { country: "USA", code: "US", city: "New York", lat: 40.71, lng: -74.01, lang: "Englisch", cat: "Straße", tags: ["deadass", "brick", "mad"] },
  { country: "USA", code: "US", city: "Los Angeles", lat: 34.05, lng: -118.24, lang: "Englisch", cat: "Musik", tags: ["bet", "hyna", "gassed"] },
  { country: "USA", code: "US", city: "Atlanta", lat: 33.75, lng: -84.39, lang: "Englisch", cat: "Musik", tags: ["slatt", "bussin", "cap"] },
  { country: "USA", code: "US", city: "Chicago", lat: 41.88, lng: -87.63, lang: "Englisch", cat: "Sport", tags: ["opp", "drill", "joe"] },
  { country: "Kanada", code: "CA", city: "Toronto", lat: 43.65, lng: -79.38, lang: "Englisch", cat: "Straße", tags: ["mans", "wasteman", "ahlie"] },
  { country: "Kanada", code: "CA", city: "Montreal", lat: 45.5, lng: -73.57, lang: "Französisch", cat: "Alltag", tags: ["tiguidou", "chum", "malade"] },
  { country: "Mexiko", code: "MX", city: "Mexiko-Stadt", lat: 19.43, lng: -99.13, lang: "Spanisch", cat: "Straße", tags: ["chido", "no-manches", "wey"] },
  { country: "Brasilien", code: "BR", city: "São Paulo", lat: -23.55, lng: -46.63, lang: "Portugiesisch", cat: "Musik", tags: ["mano", "top", "treta"] },
  { country: "Brasilien", code: "BR", city: "Rio de Janeiro", lat: -22.91, lng: -43.17, lang: "Portugiesisch", cat: "Sport", tags: ["caraca", "sinistro", "cria"] },
  { country: "Argentinien", code: "AR", city: "Buenos Aires", lat: -34.6, lng: -58.38, lang: "Spanisch", cat: "Sport", tags: ["boludo", "copado", "posta"] },
  { country: "Chile", code: "CL", city: "Santiago", lat: -33.45, lng: -70.67, lang: "Spanisch", cat: "Alltag", tags: ["bacán", "cachai", "po"] },
  { country: "Kolumbien", code: "CO", city: "Bogotá", lat: 4.71, lng: -74.07, lang: "Spanisch", cat: "Musik", tags: ["parce", "chimba", "bacano"] },
  { country: "Peru", code: "PE", city: "Lima", lat: -12.05, lng: -77.04, lang: "Spanisch", cat: "Alltag", tags: ["causa", "chévere", "pata"] },
];

/** Kleiner deterministischer Hash → 0…1. */
function hash01(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

const RANGE_FACTOR: Record<GlobeRange, number> = {
  today: 0.22,
  "7d": 0.55,
  "30d": 0.8,
  all: 1,
};

function tagStats(seed: Seed, salt: string, factor: number): SlangTagStat[] {
  return seed.tags.map((name, i) => {
    const r = hash01(`${seed.city}${name}${salt}`);
    return {
      name,
      plays: Math.round((1200 + r * 48000) * factor) + i,
      growth: Math.round((r * 180 - 30) * (0.4 + factor)),
    };
  });
}

function buildRegions(range: GlobeRange): GlobeRegion[] {
  const factor = RANGE_FACTOR[range];
  return SEEDS.map((seed) => {
    const base = hash01(`${seed.city}${seed.code}${range}`);
    const intensity = Math.min(1, Math.max(0.08, base * 0.75 + factor * 0.35));
    const stats = tagStats(seed, range, factor);
    const popular = [...stats].sort((a, b) => b.plays - a.plays);
    const trending = [...stats].sort((a, b) => b.growth - a.growth);
    return {
      id: `${seed.code}-${seed.city}`.toLowerCase().replace(/\s+/g, "-"),
      country: seed.country,
      countryCode: seed.code,
      city: seed.city,
      lat: seed.lat,
      lng: seed.lng,
      language: seed.lang,
      category: seed.cat,
      intensity,
      slangTags: Math.round((80 + base * 5400) * factor) + 3,
      activeUsers: Math.round((240 + base * 74000) * factor) + 11,
      growth: Math.round((base * 140 - 25) * (0.5 + factor)),
      trending: trending.slice(0, 3),
      popular: popular.slice(0, 3),
    };
  });
}

const cache = new Map<GlobeRange, GlobeRegion[]>();

function allRegions(range: GlobeRange): GlobeRegion[] {
  let list = cache.get(range);
  if (!list) {
    list = buildRegions(range);
    cache.set(range, list);
  }
  return list;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "de"));
}

export const demoDataSource: GlobeDataSource = {
  regions(filters: GlobeFilters) {
    return allRegions(filters.range).filter(
      (r) =>
        (filters.language === "all" || r.language === filters.language) &&
        (filters.category === "all" || r.category === filters.category) &&
        (filters.country === "all" || r.country === filters.country),
    );
  },
  languages: () => uniqueSorted(SEEDS.map((s) => s.lang)),
  categories: () => uniqueSorted(SEEDS.map((s) => s.cat)),
  countries: () => uniqueSorted(SEEDS.map((s) => s.country)),
};

/** Freitextsuche über Land, Stadt und Slang-Begriffe. */
export function searchRegions(query: string, regions: GlobeRegion[]): GlobeRegion[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const score = (r: GlobeRegion): number => {
    if (r.city?.toLowerCase().startsWith(q)) return 0;
    if (r.country.toLowerCase().startsWith(q)) return 1;
    if (r.city?.toLowerCase().includes(q) || r.country.toLowerCase().includes(q)) return 2;
    if (r.popular.some((t) => t.name.toLowerCase().includes(q))) return 3;
    if (r.trending.some((t) => t.name.toLowerCase().includes(q))) return 4;
    return 99;
  };
  return regions
    .map((r) => ({ r, s: score(r) }))
    .filter((x) => x.s < 99)
    .sort((a, b) => a.s - b.s || b.r.intensity - a.r.intensity)
    .slice(0, 8)
    .map((x) => x.r);
}
