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
