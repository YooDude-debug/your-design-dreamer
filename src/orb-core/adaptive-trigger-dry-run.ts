/**
 * ORB Core – Adaptiver Auslöser, NUR Dry-Run (Experiment).
 *
 * Diese Datei verändert KEIN Verhalten. Sie berechnet ausschliesslich, welche
 * Wartezeit ein adaptiver Auslöser anhand bereits vorhandener Werte ergeben
 * WÜRDE, damit echte Fälle später verglichen werden können. Das Ergebnis wird
 * nur protokolliert – es steuert weder den bestehenden 5-Sekunden-Takt noch
 * die 40-Sekunden-/15-Minuten-Regel noch irgendeine Entscheidung.
 *
 * Die Faktoren sind experimentell und ausdrücklich KEINE bewiesene optimale
 * Gewichtung. Werte, die nicht vorliegen, werden als "unknown" geführt und
 * nicht erfunden.
 */

import { clamp01 } from "@/orb-core/core";
import { PROACTIVE_MAX_IDLE_MS, PROACTIVE_MIN_IDLE_MS, curiosityBand } from "@/orb-core/presence";

/** Letzter bekannter Versuch einer eigenen Frage (Server-Ergebnis). */
export type AdaptiveDryRunAttempt = {
  at: string;
  asked: boolean;
  action: string | null;
  reason: string | null;
  topic: string | null;
  kind: string | null;
  score: number | null;
};

export type AdaptiveDryRunInput = {
  /** Aktuelle Leerlaufzeit in Millisekunden. */
  idleMs: number;
  /** Bestehender Zustandswert `curiosity` (0–1) oder null, wenn unbekannt. */
  curiosity: number | null;
  /** Bestehender Zustandswert `energy` (0–1) oder null, wenn unbekannt. */
  energy: number | null;
  /** Letzter Versuch (gestellt oder still verworfen) oder null. */
  lastAttempt: AdaptiveDryRunAttempt | null;
  /** Anzahl stiller Versuche in Folge (0 = keiner). */
  silentStreak: number;
  now: number;
};

export type AdaptiveDryRunResult = {
  /** Experimentell berechnete Wartezeit, begrenzt auf 40 s bis 15 min. */
  calculatedDelayMs: number;
  /** Zeitpunkt, zu dem die nächste Bewertung läge (now + Delay). */
  calculatedNextEvaluation: number;
  /** Nachvollziehbare Einzelfaktoren – "unknown", wenn ein Wert fehlt. */
  factors: {
    base_ms: number;
    curiosity: number | "unknown";
    energy: number | "unknown";
    last_attempt: number | "unknown";
    silent_streak: number;
    recent_activity: number;
  };
};

/** Erkennt den Grund des letzten Versuchs anhand vorhandener Texte. */
function attemptFactor(attempt: AdaptiveDryRunAttempt | null): number | "unknown" {
  if (!attempt) return "unknown";
  if (attempt.asked) return 1; // erfolgreiche Frage: keine Verlängerung
  const text = `${attempt.action ?? ""} ${attempt.reason ?? ""}`.toLowerCase();
  // Wiederholung: deutlich länger (Gate "duplicate" bzw. dessen Begründung).
  if (/duplikat|duplicate|ähnlicher form|schon gestellt/.test(text)) return 2.0;
  if (/lücke|gap/.test(text)) return 1.5; // keine Lücke gefunden
  if (/energie|energy/.test(text)) return 1.5; // Energie zu niedrig
  if (/mehrwert/.test(text)) return 1.5; // Mehrwert zu gering
  return 1.25; // sonstiger stiller Versuch: leicht länger
}

/**
 * Reine Dry-Run-Berechnung. Keine Seiteneffekte, keine Netzwerk- oder
 * Datenbankzugriffe. Das Ergebnis darf niemals in einen echten Takt oder
 * eine echte Entscheidung zurückfliessen.
 */
export function computeAdaptiveDelayDryRun(input: AdaptiveDryRunInput): AdaptiveDryRunResult {
  const factors: AdaptiveDryRunResult["factors"] = {
    base_ms: PROACTIVE_MIN_IDLE_MS,
    curiosity: "unknown",
    energy: "unknown",
    last_attempt: "unknown",
    silent_streak: 1 + Math.min(1, 0.25 * Math.max(0, input.silentStreak)),
    recent_activity: input.idleMs < 120_000 ? 1.25 : 1,
  };

  if (input.curiosity !== null) {
    const band = curiosityBand(clamp01(input.curiosity));
    factors.curiosity = band === "low" ? 1.5 : band === "medium" ? 1.2 : band === "high" ? 1 : 0.8;
  }
  if (input.energy !== null) {
    const e = clamp01(input.energy);
    factors.energy = e < 0.2 ? 1.5 : e < 0.5 ? 1.2 : 1;
  }
  factors.last_attempt = attemptFactor(input.lastAttempt);

  let delay = factors.base_ms;
  for (const f of [factors.curiosity, factors.energy, factors.last_attempt]) {
    if (f !== "unknown") delay *= f;
  }
  delay *= factors.silent_streak * factors.recent_activity;

  const calculatedDelayMs = Math.round(
    Math.min(PROACTIVE_MAX_IDLE_MS, Math.max(PROACTIVE_MIN_IDLE_MS, delay)),
  );
  return {
    calculatedDelayMs,
    calculatedNextEvaluation: input.now + calculatedDelayMs,
    factors,
  };
}
