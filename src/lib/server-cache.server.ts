/**
 * Serverseitiger Kurzzeit-Cache (nur Server, pro Worker-Instanz).
 *
 * Zweck: häufig gelesene, nicht personenbezogene Daten (öffentliche Beiträge,
 * Hashtag-Suche und -Trends, Stammdaten, Konfigurationen) müssen nicht bei
 * jedem Aufruf erneut aus der Datenbank geholt werden.
 *
 * Ablauf ("cache first"): Cache prüfen → gültiger Treffer wird sofort
 * zurückgegeben → sonst Datenbank lesen → Ergebnis speichern → ausliefern.
 * Parallele Aufrufe desselben Schlüssels teilen sich eine laufende Abfrage
 * ("in-flight dedupe"), damit ein Ansturm gleicher Anfragen nur eine einzige
 * Datenbankabfrage erzeugt.
 *
 * Grenzen (bewusst):
 * - Es werden ausschließlich Daten zwischengespeichert, die für alle Betrachter
 *   identisch sind. Personenbezogene Zustände (Likes, Merklisten, Rollen,
 *   Nachrichten, Sitzungen) werden nie gecacht.
 * - Der Cache liegt hinter der Berechtigungsprüfung: gecacht wird immer erst
 *   das Ergebnis einer bereits autorisierten Abfrage, nie die Autorisierung.
 * - Fällt der Cache aus, läuft alles unverändert direkt über die Datenbank.
 * - Die Größe ist begrenzt (LRU), damit kein unbegrenztes Wachstum entsteht.
 */

type Entry = { value: unknown; expiresAt: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

/** Standard-Lebensdauer in Sekunden. */
export const SERVER_CACHE_TTL_SECONDS = 60;

/** Obergrenze der Einträge pro Worker-Instanz (LRU verdrängt die ältesten). */
export const SERVER_CACHE_MAX_ENTRIES = 500;

/* ------------------------------------------------------------------ */
/* Kennzahlen                                                          */
/* ------------------------------------------------------------------ */

const metrics = {
  hits: 0,
  misses: 0,
  /** Treffer, die zu einer laufenden Abfrage dazugestoßen sind. */
  coalesced: 0,
  /** Tatsächlich ausgeführte Datenbankabfragen (Cache Miss). */
  dbQueries: 0,
  /** Fehlgeschlagene Ladevorgänge (Cache liefert dann nichts, DB-Fehler greift). */
  errors: 0,
  evictions: 0,
  /** Summe der Ladezeiten in Millisekunden (nur Cache Miss). */
  loadMsTotal: 0,
  /** Summe der Antwortzeiten bei Treffern (praktisch 0, dokumentiert Ersparnis). */
  hitMsTotal: 0,
  startedAt: Date.now(),
};

export type ServerCacheMetrics = {
  hits: number;
  misses: number;
  coalesced: number;
  dbQueries: number;
  savedDbQueries: number;
  errors: number;
  evictions: number;
  entries: number;
  hitRate: number;
  missRate: number;
  avgLoadMs: number;
  avgHitMs: number;
  uptimeSeconds: number;
};

/** Aggregierte Kennzahlen – ausschließlich Zähler, keine Inhalte. */
export function serverCacheMetrics(): ServerCacheMetrics {
  const total = metrics.hits + metrics.misses;
  return {
    hits: metrics.hits,
    misses: metrics.misses,
    coalesced: metrics.coalesced,
    dbQueries: metrics.dbQueries,
    savedDbQueries: metrics.hits + metrics.coalesced,
    errors: metrics.errors,
    evictions: metrics.evictions,
    entries: store.size,
    hitRate: total === 0 ? 0 : Number((metrics.hits / total).toFixed(4)),
    missRate: total === 0 ? 0 : Number((metrics.misses / total).toFixed(4)),
    avgLoadMs: metrics.misses === 0 ? 0 : Number((metrics.loadMsTotal / metrics.misses).toFixed(2)),
    avgHitMs: metrics.hits === 0 ? 0 : Number((metrics.hitMsTotal / metrics.hits).toFixed(3)),
    uptimeSeconds: Math.round((Date.now() - metrics.startedAt) / 1000),
  };
}

/** Setzt die Zähler zurück (nur für Messungen, verwirft keine Daten). */
export function resetServerCacheMetrics() {
  metrics.hits = 0;
  metrics.misses = 0;
  metrics.coalesced = 0;
  metrics.dbQueries = 0;
  metrics.errors = 0;
  metrics.evictions = 0;
  metrics.loadMsTotal = 0;
  metrics.hitMsTotal = 0;
  metrics.startedAt = Date.now();
}

/* ------------------------------------------------------------------ */
/* Lesen                                                               */
/* ------------------------------------------------------------------ */

function touch(key: string, entry: Entry) {
  // LRU: zuletzt genutzter Eintrag wandert nach hinten.
  store.delete(key);
  store.set(key, entry);
}

function put(key: string, value: unknown, ttlSeconds: number) {
  store.set(key, { value, expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000 });
  while (store.size > SERVER_CACHE_MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
    metrics.evictions += 1;
  }
}

/**
 * Liest aus dem Cache oder lädt nach und speichert das Ergebnis.
 * Der Schlüssel muss alle Parameter enthalten, die die Antwort verändern.
 */
export async function cachedRead<T>(
  key: string,
  load: () => Promise<T>,
  ttlSeconds: number = SERVER_CACHE_TTL_SECONDS,
): Promise<T> {
  const startedAt = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    metrics.hits += 1;
    metrics.hitMsTotal += Date.now() - startedAt;
    touch(key, hit);
    return hit.value as T;
  }

  const running = inflight.get(key);
  if (running) {
    metrics.coalesced += 1;
    return running as Promise<T>;
  }

  metrics.misses += 1;
  const run = (async () => {
    try {
      metrics.dbQueries += 1;
      const value = await load();
      put(key, value, ttlSeconds);
      metrics.loadMsTotal += Date.now() - startedAt;
      return value;
    } catch (error) {
      // Cache-Fehler dürfen nichts blockieren: der Fehler kommt aus der
      // Datenbankabfrage und wird unverändert weitergegeben.
      metrics.errors += 1;
      throw error;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, run);
  return run;
}

/**
 * Verwirft Einträge. Ohne Argument wird alles verworfen, mit `prefix` nur der
 * betroffene Bereich (z. B. `public-post:` nach einer Beitragsänderung).
 */
export function invalidateServerCache(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of [...store.keys()]) if (key.startsWith(prefix)) store.delete(key);
}

/** Cache-Kopfzeile für öffentliche, kurz gültige Antworten. */
export function publicCacheHeader(ttlSeconds: number = SERVER_CACHE_TTL_SECONDS) {
  return `public, max-age=0, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds}`;
}
