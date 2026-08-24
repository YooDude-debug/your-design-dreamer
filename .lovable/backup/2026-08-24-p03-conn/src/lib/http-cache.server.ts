/**
 * HTTP-Caching für öffentliche, nicht personalisierte Seiten (nur Server).
 *
 * Zweck: Seiten, deren Inhalt für jeden anonymen Besucher identisch ist
 * (Rechtsseiten, Startseite, Login-Seite), müssen nicht bei jedem Aufruf neu
 * serverseitig gerendert werden. Sie erhalten Cache-Kopfzeilen für den
 * CDN-/Browser-Cache und werden zusätzlich kurz in der Instanz gehalten
 * ("SSR-Kurzzeitcache").
 *
 * Sicherheitsregeln (bewusst streng):
 * - Gecacht wird ausschließlich bei GET/HEAD, Status 200 und **ohne** jeden
 *   Cookie und ohne Authorization-Kopfzeile. Sobald eine Anfrage eine Sitzung
 *   mitbringt, wird sie immer frisch gerendert und nie gecacht.
 * - Es werden nur ausdrücklich freigegebene Pfade behandelt. Profile,
 *   Messenger, Feed, Beiträge, API-Routen und alles unter /admin sind
 *   ausgeschlossen.
 * - Die Antwort trägt `Vary: Cookie, Authorization`, damit ein vorgeschalteter
 *   Cache angemeldete und anonyme Besucher niemals vermischt.
 * - Der Cache speichert nie eine Antwort, die `set-cookie` setzt.
 */

/** Öffentliche Seiten ohne personalisierte Inhalte → Pfad ⇒ TTL in Sekunden. */
const PUBLIC_PAGES: Record<string, number> = {
  "/": 60,
  "/auth": 300,
  "/agb": 3600,
  "/datenschutz": 3600,
  "/impressum": 3600,
  "/richtlinien": 3600,
  "/reset-password": 300,
};

/** Obergrenze des SSR-Kurzzeitcaches (kleine HTML-Dokumente). */
const MAX_ENTRIES = 40;

type Entry = { body: ArrayBuffer; headers: [string, string][]; expiresAt: number };

const store = new Map<string, Entry>();

const metrics = { hits: 0, misses: 0, bypass: 0, stored: 0, evictions: 0 };

export type HttpCacheMetrics = typeof metrics & { entries: number; hitRate: number };

export function httpCacheMetrics(): HttpCacheMetrics {
  const total = metrics.hits + metrics.misses;
  return {
    ...metrics,
    entries: store.size,
    hitRate: total === 0 ? 0 : Number((metrics.hits / total).toFixed(4)),
  };
}

export function resetHttpCacheMetrics() {
  metrics.hits = 0;
  metrics.misses = 0;
  metrics.bypass = 0;
  metrics.stored = 0;
  metrics.evictions = 0;
}

/** Verwirft den SSR-Kurzzeitcache (z. B. nach einer Inhaltsänderung). */
export function invalidateHttpCache(path?: string) {
  if (!path) {
    store.clear();
    return;
  }
  store.delete(path);
}

function ttlFor(request: Request): { path: string; ttl: number } | null {
  if (request.method !== "GET") return null;
  let path: string;
  try {
    path = new URL(request.url).pathname;
  } catch {
    return null;
  }
  const ttl = PUBLIC_PAGES[path];
  if (ttl === undefined) return null;
  // Sobald eine Sitzung mitkommt, wird nie gecacht.
  if (request.headers.get("cookie")) return null;
  if (request.headers.get("authorization")) return null;
  return { path, ttl };
}

/** Fertige Antwort aus dem Kurzzeitcache, falls vorhanden. */
export function cachedPublicResponse(request: Request): Response | null {
  const match = ttlFor(request);
  if (!match) {
    metrics.bypass += 1;
    return null;
  }
  const hit = store.get(match.path);
  if (!hit || hit.expiresAt <= Date.now()) {
    metrics.misses += 1;
    return null;
  }
  metrics.hits += 1;
  const headers = new Headers(hit.headers);
  headers.set("x-ydude-cache", "hit");
  return new Response(hit.body.slice(0), { status: 200, headers });
}

/**
 * Ergänzt Cache-Kopfzeilen und legt die Antwort in den Kurzzeitcache.
 * Personalisierte oder fehlerhafte Antworten bleiben unverändert.
 */
export async function withPublicCache(request: Request, response: Response): Promise<Response> {
  const match = ttlFor(request);
  if (!match) return response;
  if (response.status !== 200) return response;
  if (response.headers.has("set-cookie")) return response;

  const headers = new Headers(response.headers);
  if (!headers.has("cache-control")) {
    headers.set(
      "cache-control",
      `public, max-age=0, s-maxage=${match.ttl}, stale-while-revalidate=${match.ttl}`,
    );
  }
  const vary = headers.get("vary");
  headers.set("vary", vary ? `${vary}, Cookie, Authorization` : "Cookie, Authorization");
  headers.set("x-ydude-cache", "miss");

  const body = await response.clone().arrayBuffer();
  store.set(match.path, {
    body,
    headers: [...headers].filter(([key]) => key !== "x-ydude-cache"),
    expiresAt: Date.now() + match.ttl * 1000,
  });
  metrics.stored += 1;
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
    metrics.evictions += 1;
  }

  return new Response(body, { status: 200, headers });
}
