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

/** Liest aus dem Cache oder lädt nach und speichert das Ergebnis. */
export async function cachedClientRead<T>(
  key: string,
  load: () => Promise<T>,
  ttlSeconds: number = CLIENT_CACHE_TTL_SECONDS,
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const run = (async () => {
    try {
      const value = await load();
      store.set(key, { value, expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000 });
      return value;
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
