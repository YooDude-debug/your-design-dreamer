import { describe, expect, it } from "vitest";
import { decideLifecycle, type LifecycleMemory } from "@/orb-core/reversible-lifecycle";

// Synthetische Testparameter – keine Produktionswerte.
const P = { dormantAfterMs: 100, expireAfterMs: 50, importanceThreshold: 0.5 };
const base: LifecycleMemory = {
  state: "active",
  importance: 0.2,
  knowledgeClass: "confirmed",
  lastContributedAt: 0,
};

describe("Phase 2F reversible lifecycle", () => {
  it("wichtige, selten genutzte Erinnerung → geschützt, läuft nie aus", () => {
    const d = decideLifecycle({ ...base, importance: 0.9, lastContributedAt: 0 }, P, { now: 1e9 });
    expect(d).toMatchObject({ next: "protected", reason: "protected_importance" });
  });

  it("dauerhaft relevante Erinnerung → geschützt, auch aus Ruhe", () => {
    const d = decideLifecycle({ ...base, state: "dormant", durable: true, dormantSince: 0 }, P, {
      now: 1e9,
    });
    expect(d).toMatchObject({ next: "protected", reason: "protected_durable" });
  });

  it("unwichtig, lange ungenutzt → ruhend, danach ausgelaufen", () => {
    expect(decideLifecycle(base, P, { now: 100 }).next).toBe("dormant");
    const m = { ...base, state: "dormant" as const, dormantSince: 100 };
    expect(decideLifecycle(m, P, { now: 120 }).reason).toBe("dormant_within_retention");
    expect(decideLifecycle(m, P, { now: 150 }).next).toBe("expired");
  });

  it("ruhend mit erneuter Relevanz → aktiv", () => {
    const m = { ...base, state: "dormant" as const, dormantSince: 0 };
    expect(decideLifecycle(m, P, { now: 1e9, contributedAgain: true })).toMatchObject({
      next: "active",
      reason: "reactivated",
    });
  });

  it("ausgelaufen + Bestätigung → keine stille Reaktivierung", () => {
    const d = decideLifecycle({ ...base, state: "expired" }, P, { now: 1, userConfirmed: true });
    expect(d).toMatchObject({ next: "expired", changed: false, requiresNewStatement: true });
  });

  it("abgeleitete Vermutung erhält keinen Schutz durch Häufigkeit", () => {
    const d = decideLifecycle({ ...base, knowledgeClass: "inferred" }, P, { now: 100 });
    expect(d.next).toBe("dormant");
  });

  it("widersprüchliche Erinnerung wird nicht automatisch verändert", () => {
    const d = decideLifecycle({ ...base, inOpenContradiction: true }, P, { now: 1e9 });
    expect(d).toMatchObject({ next: "active", changed: false, reason: "open_contradiction_hold" });
  });

  it("fehlende Daten oder Parameter → keine Änderung", () => {
    expect(decideLifecycle({ ...base, state: null }, P, { now: 1e9 }).reason).toBe("unknown_data");
    expect(decideLifecycle(base, {}, { now: 1e9 }).reason).toBe("parameter_missing");
    expect(decideLifecycle({ ...base, lastContributedAt: null }, P, { now: 1e9 }).reason).toBe(
      "no_usage_evidence_hold",
    );
    expect(
      decideLifecycle(
        { ...base, state: "dormant", dormantSince: 0 },
        { ...P, expireAfterMs: undefined },
        { now: 1e9 },
      ).reason,
    ).toBe("parameter_missing");
  });
});
