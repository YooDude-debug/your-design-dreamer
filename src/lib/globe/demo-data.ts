/**
 * Slang Globe – Datenquelle.
 *
 * Die Inhalte kommen NICHT aus dieser Datei, sondern aus der getrennten
 * SlangTag-Schicht (`slangtag-catalog.ts`). Aktuell sind das ausschließlich
 * Demo-SlangTags (`source: "demo"`, `isDemo: true`). Sobald echte User-SlangTags
 * aus der Slang Arena vorliegen, werden sie in derselben Struktur zugeliefert
 * und ersetzen die Demo-Einträge – der Globe bleibt unverändert.
 *
 * Kennzahlen (Plays, Wachstum, Intensität) sind deterministisch simuliert,
 * damit SSR und Client identisch rendern.
 */
import { DEMO_REGION_GROUPS, type DemoRegionGroup, type GlobeSlangTag } from "./slangtag-catalog";
import type { GlobeDataSource, GlobeFilters, GlobeRange, GlobeRegion, SlangTagStat } from "./types";

/** Aktive Datenbasis des Globe (später: Demo + User zusammengeführt). */
const GROUPS: readonly DemoRegionGroup[] = DEMO_REGION_GROUPS;

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

function tagStats(group: DemoRegionGroup, tags: GlobeSlangTag[], salt: string, factor: number): SlangTagStat[] {
  return tags.map((t, i) => {
    const r = hash01(`${group.key}${t.tag}${salt}`);
    return {
      name: t.tag,
      plays: Math.round((1200 + r * 48000) * factor) + i,
      growth: Math.round((r * 180 - 30) * (0.4 + factor)),
    };
  });
}

/** Hauptkategorie einer Region: erste Kategorie ihrer SlangTags. */
function mainCategory(tags: GlobeSlangTag[]): string {
  return tags[0]?.category ?? "Alltag";
}

function buildRegion(group: DemoRegionGroup, tags: GlobeSlangTag[], range: GlobeRange): GlobeRegion {
  const factor = RANGE_FACTOR[range];
  const base = hash01(`${group.key}${range}`);
  const stats = tagStats(group, tags, range, factor);
  const popular = [...stats].sort((a, b) => b.plays - a.plays);
  const trending = [...stats].sort((a, b) => b.growth - a.growth);
  return {
    id: group.key,
    country: group.country,
    countryCode: group.countryCode,
    city: group.city,
    lat: group.lat,
    lng: group.lng,
    language: group.language,
    category: mainCategory(tags),
    intensity: Math.min(1, Math.max(0.08, base * 0.75 + factor * 0.35)),
    slangTags: tags.length,
    activeUsers: Math.round((240 + base * 74000) * factor) + 11,
    growth: Math.round((base * 140 - 25) * (0.5 + factor)),
    trending: trending.slice(0, 3),
    popular: popular.slice(0, 3),
  };
}

const cache = new Map<string, GlobeRegion[]>();

function regionsFor(range: GlobeRange, category: string): GlobeRegion[] {
  const key = `${range}|${category}`;
  let list = cache.get(key);
  if (!list) {
    list = GROUPS.flatMap((g) => {
      const tags = category === "all" ? g.tags : g.tags.filter((t) => t.category === category);
      if (tags.length === 0) return [];
      return [buildRegion(g, tags, range)];
    });
    cache.set(key, list);
  }
  return list;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "de"));
}

export const demoDataSource: GlobeDataSource = {
  regions(filters: GlobeFilters) {
    return regionsFor(filters.range, filters.category).filter(
      (r) =>
        (filters.language === "all" || r.language === filters.language) &&
        (filters.country === "all" || r.country === filters.country),
    );
  },
  languages: () => uniqueSorted(GROUPS.map((g) => g.language)),
  categories: () => uniqueSorted(GROUPS.flatMap((g) => g.tags.map((t) => t.category))),
  countries: () => uniqueSorted(GROUPS.map((g) => g.country)),
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
