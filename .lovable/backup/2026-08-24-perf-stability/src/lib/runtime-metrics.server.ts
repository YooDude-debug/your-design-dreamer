/**
 * Laufzeit-Kennzahlen der Serverinstanz (nur Server, nur aggregiert).
 *
 * Zweck: messbar machen, wie sich die Instanz unter Last verhält – ohne
 * Inhalte, Nutzerdaten oder Adressen zu erfassen. Gezählt werden ausschließlich
 * anonyme Summen (Anzahl Anfragen, gleichzeitig laufende Anfragen, Fehler,
 * Antwortzeiten) sowie die Verzögerung der Ereniswarteschlange
 * ("Event-Loop-Lag"), also wie stark die Instanz gerade blockiert ist.
 *
 * Keine Verhaltensänderung: Die Zähler laufen neben der Anfrage und können
 * die Antwort nie verändern oder verzögern.
 */

const metrics = {
  requests: 0,
  inFlight: 0,
  maxInFlight: 0,
  errors: 0,
  durationMsTotal: 0,
  maxDurationMs: 0,
  startedAt: Date.now(),
};

/** Anfrage begonnen. Liefert die Abschlussfunktion. */
export function trackRequestStart(): (ok: boolean) => void {
  metrics.requests += 1;
  metrics.inFlight += 1;
  if (metrics.inFlight > metrics.maxInFlight) metrics.maxInFlight = metrics.inFlight;
  const started = Date.now();
  let done = false;
  return (ok: boolean) => {
    if (done) return;
    done = true;
    const ms = Date.now() - started;
    metrics.inFlight = Math.max(0, metrics.inFlight - 1);
    metrics.durationMsTotal += ms;
    if (ms > metrics.maxDurationMs) metrics.maxDurationMs = ms;
    if (!ok) metrics.errors += 1;
  };
}

/**
 * Misst die Verzögerung der Ereniswarteschlange: ein Zeitgeber wird auf 0 ms
 * gesetzt; die tatsächlich verstrichene Zeit ist die Blockierung.
 */
export async function measureEventLoopLagMs(samples = 5): Promise<number> {
  let worst = 0;
  for (let i = 0; i < Math.max(1, samples); i += 1) {
    const started = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 0));
    worst = Math.max(worst, Date.now() - started);
  }
  return worst;
}

export function runtimeMetrics() {
  const uptimeSeconds = Math.round((Date.now() - metrics.startedAt) / 1000);
  return {
    requests: metrics.requests,
    inFlight: metrics.inFlight,
    maxInFlight: metrics.maxInFlight,
    errors: metrics.errors,
    avgDurationMs:
      metrics.requests > 0 ? Math.round(metrics.durationMsTotal / metrics.requests) : 0,
    maxDurationMs: metrics.maxDurationMs,
    uptimeSeconds,
    requestsPerSecond:
      uptimeSeconds > 0 ? Number((metrics.requests / uptimeSeconds).toFixed(2)) : 0,
  };
}
