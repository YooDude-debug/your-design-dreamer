/**
 * Serverseitige Missbrauchsbremse pro Client-IP für öffentliche Endpunkte.
 *
 * Bewusst ohne Datenbank: ein reines In-Memory-Sliding-Window im
 * Server-Prozess. Es ist eine Kostenbremse (Best Effort) und arbeitet
 * zusammen mit der verbindlichen Turnstile-Prüfung – nicht als Ersatz.
 */

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();
/** Schutz gegen unbegrenztes Wachstum der Map. */
const MAX_KEYS = 5000;

export type IpRateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export function checkIpRateLimit(options: {
  /** Namensraum, z. B. "public-transcribe". */
  scope: string;
  ip: string | undefined;
  /** Erlaubte Anzahl im Fenster. */
  max: number;
  /** Fenstergrösse in Sekunden. */
  windowSeconds: number;
  now?: number;
}): IpRateLimitResult {
  const now = options.now ?? Date.now();
  const windowMs = options.windowSeconds * 1000;
  // Ohne erkennbare IP wird konservativ ein gemeinsamer Bucket genutzt.
  const key = `${options.scope}:${options.ip ?? "unknown"}`;

  if (buckets.size > MAX_KEYS) buckets.clear();

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= options.max) {
    const oldest = bucket.hits[0] ?? now;
    buckets.set(key, bucket);
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true };
}

/** Nur für Tests: setzt alle Zähler zurück. */
export function resetIpRateLimits(): void {
  buckets.clear();
}
