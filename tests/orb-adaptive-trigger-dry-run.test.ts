import { describe, expect, it } from "vitest";

import {
  computeAdaptiveDelayDryRun,
  type AdaptiveDryRunAttempt,
} from "@/orb-core/adaptive-trigger-dry-run";
import { PROACTIVE_MAX_IDLE_MS, PROACTIVE_MIN_IDLE_MS } from "@/orb-core/presence";

const NOW = 1_800_000_000_000;

function attempt(over: Partial<AdaptiveDryRunAttempt> = {}): AdaptiveDryRunAttempt {
  return {
    at: new Date(NOW - 60_000).toISOString(),
    asked: false,
    action: "ASK",
    reason: "ok",
    topic: "kochen",
    kind: null,
    score: 0.4,
    ...over,
  };
}

describe("adaptive-trigger dry-run (nur Experiment, kein Verhalten)", () => {
  it("Basis ohne Sonderfaktoren bleibt bei 40 s", () => {
    const r = computeAdaptiveDelayDryRun({
      idleMs: 200_000,
      curiosity: 0.8,
      energy: 0.9,
      lastAttempt: attempt({ asked: true }),
      silentStreak: 0,
      now: NOW,
    });
    // very_high Neugier (0.8) senkt auf 32 s, Klammerung hebt auf 40 s.
    expect(r.calculatedDelayMs).toBe(PROACTIVE_MIN_IDLE_MS);
    expect(r.calculatedNextEvaluation).toBe(NOW + r.calculatedDelayMs);
  });

  it("niedrige Neugier verlängert, hohe Neugier kürzt", () => {
    const base = { idleMs: 200_000, energy: 0.9, lastAttempt: null, silentStreak: 0, now: NOW };
    const low = computeAdaptiveDelayDryRun({ ...base, curiosity: 0.1 });
    const high = computeAdaptiveDelayDryRun({ ...base, curiosity: 0.9 });
    expect(low.calculatedDelayMs).toBeGreaterThan(high.calculatedDelayMs);
    expect(low.factors.curiosity).toBe(1.5);
    expect(high.factors.curiosity).toBe(0.8);
  });

  it("niedrige Energie verlängert die Wartezeit", () => {
    const base = { idleMs: 200_000, curiosity: 0.6, lastAttempt: null, silentStreak: 0, now: NOW };
    const tired = computeAdaptiveDelayDryRun({ ...base, energy: 0.1 });
    const fit = computeAdaptiveDelayDryRun({ ...base, energy: 0.9 });
    expect(tired.calculatedDelayMs).toBeGreaterThan(fit.calculatedDelayMs);
    expect(tired.factors.energy).toBe(1.5);
  });

  it("duplicate-Versuch verlängert deutlich", () => {
    const base = { idleMs: 200_000, curiosity: 0.6, energy: 0.9, silentStreak: 1, now: NOW };
    const dup = computeAdaptiveDelayDryRun({
      ...base,
      lastAttempt: attempt({ reason: "Diese Frage hat ORB in ähnlicher Form schon gestellt." }),
    });
    const ok = computeAdaptiveDelayDryRun({ ...base, lastAttempt: attempt({ asked: true }) });
    expect(dup.factors.last_attempt).toBe(2.0);
    expect(dup.calculatedDelayMs).toBeGreaterThan(ok.calculatedDelayMs);
  });

  it("no gap / energy / mehrwert verlängern moderat", () => {
    const base = { idleMs: 200_000, curiosity: 0.6, energy: 0.9, silentStreak: 0, now: NOW };
    for (const reason of ["Keine passende Lücke gefunden.", "Energie zu niedrig.", "Mehrwert zu gering."]) {
      const r = computeAdaptiveDelayDryRun({ ...base, lastAttempt: attempt({ reason }) });
      expect(r.factors.last_attempt).toBe(1.5);
    }
  });

  it("wiederholte stille Versuche verlängern schrittweise", () => {
    const base = { idleMs: 200_000, curiosity: 0.6, energy: 0.9, lastAttempt: null, now: NOW };
    const s0 = computeAdaptiveDelayDryRun({ ...base, silentStreak: 0 });
    const s3 = computeAdaptiveDelayDryRun({ ...base, silentStreak: 3 });
    expect(s3.calculatedDelayMs).toBeGreaterThan(s0.calculatedDelayMs);
    expect(s3.factors.silent_streak).toBe(1.75);
  });

  it("kürzliche Aktivität verlängert die Wartezeit", () => {
    const base = { curiosity: 0.6, energy: 0.9, lastAttempt: null, silentStreak: 0, now: NOW };
    const fresh = computeAdaptiveDelayDryRun({ ...base, idleMs: 45_000 });
    const long = computeAdaptiveDelayDryRun({ ...base, idleMs: 300_000 });
    expect(fresh.factors.recent_activity).toBe(1.25);
    expect(fresh.calculatedDelayMs).toBeGreaterThan(long.calculatedDelayMs);
  });

  it("Ergebnis bleibt immer zwischen 40 s und 15 min", () => {
    const maxed = computeAdaptiveDelayDryRun({
      idleMs: 10_000,
      curiosity: 0.05,
      energy: 0.05,
      lastAttempt: attempt({ reason: "duplicate" }),
      silentStreak: 10,
      now: NOW,
    });
    expect(maxed.calculatedDelayMs).toBeLessThanOrEqual(PROACTIVE_MAX_IDLE_MS);
    const mined = computeAdaptiveDelayDryRun({
      idleMs: 500_000,
      curiosity: 1,
      energy: 1,
      lastAttempt: attempt({ asked: true }),
      silentStreak: 0,
      now: NOW,
    });
    expect(mined.calculatedDelayMs).toBeGreaterThanOrEqual(PROACTIVE_MIN_IDLE_MS);
  });

  it("fehlende Werte werden als unknown geführt, nicht erfunden", () => {
    const r = computeAdaptiveDelayDryRun({
      idleMs: 200_000,
      curiosity: null,
      energy: null,
      lastAttempt: null,
      silentStreak: 0,
      now: NOW,
    });
    expect(r.factors.curiosity).toBe("unknown");
    expect(r.factors.energy).toBe("unknown");
    expect(r.factors.last_attempt).toBe("unknown");
    expect(r.calculatedDelayMs).toBe(PROACTIVE_MIN_IDLE_MS);
  });

  it("reine Funktion: Eingaben bleiben unverändert", () => {
    const input = {
      idleMs: 100_000,
      curiosity: 0.5,
      energy: 0.5,
      lastAttempt: attempt(),
      silentStreak: 2,
      now: NOW,
    };
    const snapshot = JSON.parse(JSON.stringify(input));
    computeAdaptiveDelayDryRun(input);
    expect(input).toEqual(snapshot);
  });
});
