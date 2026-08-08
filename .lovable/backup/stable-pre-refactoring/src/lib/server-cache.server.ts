/**
 * Serverseitiger Kurzzeit-Cache (nur Server, pro Worker-Instanz).
 *
 * Zweck: häufig gelesene, nicht personenbezogene Daten (öffentliche Beiträge,
 * Hashtag-Trends, Stammdaten) müssen nicht bei jedem Aufruf erneut aus der
 * Datenbank geholt werden. Standard-Lebensdauer: 60 Sekunden.
 *
 * Wichtig: hier werden ausschließlich Daten zwischengespeichert, die für alle
 * Betrachter identisch sind. Personenbezogene Zustände (Likes, Merklisten,
 * Rollen) werden nie gecacht. Nach Änderungen wird der betroffene Bereich
 * gezielt verworfen (`invalidateServerCache`), damit keine veralteten Daten
 * ausgeliefert werden.
 */

type Entry = { value: unknown; expiresAt: number };

const store = new Map<string, Entry>();

/** Standard-Lebensdauer in Sekunden. */
export const SERVER_CACHE_TTL_SECONDS = 60;

/** Liest aus dem Cache oder lädt nach und speichert das Ergebnis. */
export async function cachedRead<T>(
  key: string,
  load: () => Promise<T>,
  ttlSeconds: number = SERVER_CACHE_TTL_SECONDS,
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const value = await load();
  store.set(key, { value, expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000 });
  return value;
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
