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
import { currentSlangYear, slangYearProgress } from "./slang-year";

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

/**
 * Jahresfaktor eines Jahrgangs: abgeschlossene Jahre sind vollständig, das
 * laufende Jahr wächst ab dem 1. Januar von 0 an. So bleiben Jahresstatistiken
 * strikt getrennt und der Globe startet in jedem neuen Jahr bei 0.
 */
function yearFactor(year: number, now: number = Date.now()): number {
  return slangYearProgress(year, now);
}

function tagStats(
  group: DemoRegionGroup,
  tags: GlobeSlangTag[],
  salt: string,
  factor: number,
): SlangTagStat[] {
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

function buildRegion(
  group: DemoRegionGroup,
  tags: GlobeSlangTag[],
  range: GlobeRange,
  year: number,
): GlobeRegion {
  // Jahresstatistik: Zeitraum × Jahrgang. Jeder Jahrgang hat eigene Werte,
  // die sich nie mit anderen Jahren vermischen (Schlüssel: tag+region+year).
  const factor = RANGE_FACTOR[range] * yearFactor(year);
  const base = hash01(`${group.key}${range}${year}`);
  const stats = tagStats(group, tags, `${range}${year}`, factor);
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
    intensity: Math.min(1, Math.max(0.08, base * 0.75 * (0.2 + factor * 0.8) + factor * 0.35)),
    slangTags: tags.length,
    activeUsers: Math.round((240 + base * 74000) * factor) + 11,
    growth: Math.round((base * 140 - 25) * (0.5 + factor)),
    trending: trending.slice(0, 3),
    popular: popular.slice(0, 3),
  };
}

/**
 * Ergebnis-Cache.
 *
 * Zwei Eigenschaften sind entscheidend und waren vorher nicht gegeben:
 * 1. **Stabile Identität** – dieselben Filter liefern exakt dasselbe Array.
 *    Vorher erzeugte jeder Aufruf durch das nachgelagerte `.filter()` ein neues
 *    Array; React-Effekte, GPU-Buffer und die Satellitenauswahl wurden dadurch
 *    bei jedem Render neu aufgebaut.
 * 2. **Begrenzte Größe (LRU)** – der Tages-Bucket des laufenden Jahres erzeugte
 *    sonst mit jedem Kalendertag dauerhaft neue Einträge (Memory-Leak).
 */
const CACHE_MAX = 24;
const cache = new Map<string, GlobeRegion[]>();

function cacheGet(key: string): GlobeRegion[] | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  // LRU: Zugriff nach hinten sortieren.
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cacheSet(key: string, value: GlobeRegion[]): GlobeRegion[] {
  cache.set(key, value);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return value;
}

/** Cache-Bucket: laufendes Jahr wächst (tagesaktuell), Archivjahre sind final. */
function bucketFor(year: number): string {
  return year >= currentSlangYear() ? new Date().toISOString().slice(0, 10) : "final";
}

function regionsFor(range: GlobeRange, category: string, year: number): GlobeRegion[] {
  const key = `base|${range}|${category}|${year}|${bucketFor(year)}`;
  const hit = cacheGet(key);
  if (hit) return hit;
  return cacheSet(
    key,
    GROUPS.flatMap((g) => {
      const tags = category === "all" ? g.tags : g.tags.filter((t) => t.category === category);
      if (tags.length === 0) return [];
      return [buildRegion(g, tags, range, year)];
    }),
  );
}

/**
 * Detailstufe „world“: Städte eines Landes werden zu einem Cluster verdichtet.
 * Das reduziert Heatmap-Punkte und Satellitenkandidaten in der Weltansicht
 * deutlich, ohne die Optik zu ändern (gleiche Farben, gleiche Darstellung).
 */
function clusterByCountry(list: GlobeRegion[]): GlobeRegion[] {
  const byCountry = new Map<string, GlobeRegion[]>();
  for (const r of list) {
    const arr = byCountry.get(r.countryCode);
    if (arr) arr.push(r);
    else byCountry.set(r.countryCode, [r]);
  }
  const out: GlobeRegion[] = [];
  for (const [code, group] of byCountry) {
    if (group.length === 1) {
      out.push(group[0]!);
      continue;
    }
    // Ankerpunkt: die aktivste Stadt des Landes (bleibt geografisch korrekt).
    const lead = group.reduce((a, b) => (b.intensity > a.intensity ? b : a));
    const stats = group.flatMap((r) => r.popular);
    const trend = group.flatMap((r) => r.trending);
    const dedupe = (arr: SlangTagStat[], by: (s: SlangTagStat) => number) => {
      const seen = new Map<string, SlangTagStat>();
      for (const s of arr) {
        const k = s.name.toLowerCase();
        const prev = seen.get(k);
        if (!prev || by(s) > by(prev)) seen.set(k, s);
      }
      return [...seen.values()].sort((a, b) => by(b) - by(a)).slice(0, 3);
    };
    out.push({
      ...lead,
      id: `cluster:${code}`,
      city: undefined,
      intensity: Math.min(1, group.reduce((s, r) => Math.max(s, r.intensity), 0) * 1.05),
      slangTags: group.reduce((s, r) => s + r.slangTags, 0),
      activeUsers: group.reduce((s, r) => s + r.activeUsers, 0),
      growth: Math.round(group.reduce((s, r) => s + r.growth, 0) / group.length),
      popular: dedupe(stats, (s) => s.plays),
      trending: dedupe(trend, (s) => s.growth),
    });
  }
  return out;
}

export const demoDataSource: GlobeDataSource = {
  regions(filters: GlobeFilters, detail = "region") {
    const base = regionsFor(filters.range, filters.category, filters.year);
    // „region“ und „local“ teilen dieselbe Stadtauflösung: beim Zoomwechsel
    // zwischen diesen Stufen wird bewusst nichts neu berechnet.
    const level = detail === "world" ? "world" : "city";
    const key = `view|${filters.range}|${filters.category}|${filters.year}|${bucketFor(
      filters.year,
    )}|${filters.language}|${filters.country}|${level}`;
    const hit = cacheGet(key);
    if (hit) return hit;
    const filtered = base.filter(
      (r) =>
        (filters.language === "all" || r.language === filters.language) &&
        (filters.country === "all" || r.country === filters.country),
    );
    return cacheSet(key, level === "world" ? clusterByCountry(filtered) : filtered);
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
