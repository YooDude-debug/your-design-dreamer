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

/**
 * Öffentliche Beitrags-Share-Seiten (`/post/<uuid>`), TTL in Sekunden.
 * Die SSR-Antwort dieser Route ist für jeden Besucher identisch: Der
 * zugehörige Loader (`getPublicPost`) liefert ausschließlich Beiträge mit
 * `visibility = 'public'` und `hidden_at IS NULL`; private, Connections-,
 * Following-, Entwurfs- oder moderierte Beiträge erzeugen die neutrale
 * „nicht verfügbar"-Seite. Die Weiterleitung angemeldeter Nutzer erfolgt
 * erst clientseitig nach der Hydration, verändert das HTML also nicht.
 * Gecacht wird zusätzlich nur, wenn die Antwort das Marker-Kopfzeilenpaar
 * `x-ydude-public-post: 1` trägt (siehe `getPublicPost`).
 */
const PUBLIC_POST_TTL = 60;
const PUBLIC_POST_PATH =
  /^\/post\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Kopfzeile, mit der der Beitrags-Loader eine wirklich öffentliche Seite markiert. */
const PUBLIC_POST_MARKER = "x-ydude-public-post";

/** Obergrenze des SSR-Kurzzeitcaches (kleine HTML-Dokumente). */
const MAX_ENTRIES = 200;

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

function ttlFor(request: Request): { path: string; ttl: number; requiresMarker: boolean } | null {
  if (request.method !== "GET") return null;
  let path: string;
  try {
    path = new URL(request.url).pathname;
  } catch {
    return null;
  }
  let ttl = PUBLIC_PAGES[path];
  let requiresMarker = false;
  if (ttl === undefined) {
    if (!PUBLIC_POST_PATH.test(path)) return null;
    ttl = PUBLIC_POST_TTL;
    requiresMarker = true;
  }
  // Sobald eine Sitzung mitkommt, wird nie gecacht.
  if (request.headers.get("cookie")) return null;
  if (request.headers.get("authorization")) return null;
  return { path, ttl, requiresMarker };
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
  const stripMarker = (res: Response): Response => {
    // Der interne Marker darf niemals ausgeliefert werden – auch nicht bei
    // personalisierten Anfragen (Cookie/Authorization) oder Fehlerantworten.
    if (!res.headers.has(PUBLIC_POST_MARKER)) return res;
    const headers = new Headers(res.headers);
    headers.delete(PUBLIC_POST_MARKER);
    return new Response(res.body, { status: res.status, headers });
  };
  if (!match) return stripMarker(response);
  if (response.status !== 200) return stripMarker(response);
  if (response.headers.has("set-cookie")) return stripMarker(response);

  const headers = new Headers(response.headers);

  if (match.requiresMarker) {
    // Bei Unsicherheit wird nie gecacht: Nur Antworten, die der Loader
    // ausdrücklich als wirklich öffentlichen Beitrag markiert hat.
    const isPublicPost = headers.get(PUBLIC_POST_MARKER) === "1";
    headers.delete(PUBLIC_POST_MARKER);
    if (!isPublicPost) return new Response(response.body, { status: response.status, headers });
  }

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
