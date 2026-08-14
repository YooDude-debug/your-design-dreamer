/**
 * Clientseitiger Kurzzeit-Cache für Stammdaten (SlangTags, Profil-Zusatzdaten).
 *
 * Zweck: identische Abfragen innerhalb kurzer Zeit werden nur einmal gestellt.
 * Parallele Aufrufe desselben Schlüssels teilen sich eine laufende Anfrage
 * ("in-flight dedupe"), damit keine doppelten Datenbankabfragen entstehen.
 *
 * Es werden ausschliesslich Daten zwischengespeichert, die der angemeldete
 * Nutzer ohnehin lesen darf. Nach Änderungen wird der betroffene Bereich
 * gezielt verworfen (`invalidateClientCache`).
 */

type Entry = { value: unknown; expiresAt: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

/** Standard-Lebensdauer in Sekunden. */
export const CLIENT_CACHE_TTL_SECONDS = 60;

/** Obergrenze der Einträge (LRU) – verhindert unbegrenztes Wachstum. */
export const CLIENT_CACHE_MAX_ENTRIES = 300;

const metrics = { hits: 0, misses: 0, coalesced: 0, errors: 0, evictions: 0, loadMsTotal: 0 };

/** Aggregierte Kennzahlen des Sitzungs-Caches (nur Zähler, keine Inhalte). */
export function clientCacheMetrics() {
  const total = metrics.hits + metrics.misses;
  return {
    ...metrics,
    entries: store.size,
    savedRequests: metrics.hits + metrics.coalesced,
    hitRate: total === 0 ? 0 : Number((metrics.hits / total).toFixed(4)),
    avgLoadMs: metrics.misses === 0 ? 0 : Number((metrics.loadMsTotal / metrics.misses).toFixed(2)),
  };
}

/** Liest aus dem Cache oder lädt nach und speichert das Ergebnis. */
export async function cachedClientRead<T>(
  key: string,
  load: () => Promise<T>,
  ttlSeconds: number = CLIENT_CACHE_TTL_SECONDS,
): Promise<T> {
  const startedAt = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    metrics.hits += 1;
    // LRU: zuletzt genutzter Eintrag wandert nach hinten.
    store.delete(key);
    store.set(key, hit);
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
      const value = await load();
      store.set(key, { value, expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000 });
      while (store.size > CLIENT_CACHE_MAX_ENTRIES) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
        metrics.evictions += 1;
      }
      metrics.loadMsTotal += Date.now() - startedAt;
      return value;
    } catch (error) {
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
 * Liest einen bereits bekannten Wert sofort – auch wenn er abgelaufen ist.
 * `fresh` sagt, ob der Wert noch innerhalb seiner Lebensdauer liegt.
 */
export function peekClientCache<T>(key: string): { value: T; fresh: boolean } | null {
  const hit = store.get(key);
  if (!hit) return null;
  return { value: hit.value as T, fresh: hit.expiresAt > Date.now() };
}

/**
 * Stale-while-revalidate: ein bereits bekannter Wert wird sofort geliefert,
 * eine abgelaufene Kopie zusätzlich im Hintergrund aktualisiert. So entsteht
 * beim Wiederöffnen kein sichtbarer Ladezustand.
 */
export async function cachedClientReadSWR<T>(
  key: string,
  load: () => Promise<T>,
  ttlSeconds: number = CLIENT_CACHE_TTL_SECONDS,
): Promise<T> {
  const hit = peekClientCache<T>(key);
  if (hit) {
    if (!hit.fresh && !inflight.has(key)) void cachedClientRead(key, load, ttlSeconds);
    return hit.value;
  }
  return cachedClientRead(key, load, ttlSeconds);
}



/** Verwirft Einträge – ohne Argument alles, mit `prefix` nur den Bereich. */
export function invalidateClientCache(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of [...store.keys()]) if (key.startsWith(prefix)) store.delete(key);
}

/** Stabiler Schlüsselteil für eine Menge von IDs (Reihenfolge egal). */
export function idsKey(ids: string[]): string {
  return ids.slice().sort().join(",");
}
