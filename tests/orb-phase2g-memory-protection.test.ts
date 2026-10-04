import { describe, expect, it } from "vitest";
import {
  decideLifecycle,
  PHASE_2G_PARAMS as P,
  type LifecycleMemory,
} from "@/orb-core/reversible-lifecycle";

const DAY = 86_400_000;
const base: LifecycleMemory = {
  state: "active",
  importance: 0.3,
  knowledgeClass: "confirmed",
  lastContributedAt: 0,
};

describe("Phase 2G memory protection", () => {
  it("Parameter verbindlich", () => {
    expect(P).toEqual({
      dormantAfterMs: 90 * DAY,
      expireAfterMs: 180 * DAY,
      importanceThreshold: 0.75,
    });
  });

  it("wichtig (≥ 0,75), selten verwendet → geschützt", () => {
    expect(decideLifecycle({ ...base, importance: 0.8 }, P, { now: 1000 * DAY })).toMatchObject({
      next: "protected",
      reason: "protected_importance",
    });
    expect(decideLifecycle({ ...base, importance: 0.6 }, P, { now: 91 * DAY }).next).toBe(
      "dormant",
    );
  });

  it("ausdrücklich dauerhaft → geschützt, auch aus Ruhe", () => {
    expect(
      decideLifecycle({ ...base, state: "dormant", dormantSince: 0 }, P, {
        now: 500 * DAY,
        userMarkedDurable: true,
      }).next,
    ).toBe("protected");
    expect(decideLifecycle({ ...base, category: "identity" }, P, { now: 1000 * DAY }).reason).toBe(
      "protected_category",
    );
  });

  it("häufig verwendet, aber unwichtig → kein Schutz", () => {
    const d = decideLifecycle({ ...base, lastContributedAt: 10 * DAY }, P, {
      now: 11 * DAY,
      contributedAgain: true,
    });
    expect(d).toMatchObject({ next: "active", reason: "still_relevant" });
  });

  it("bestätigt geschützt ohne Nutzungsnachweis bleibt geschützt", () => {
    const d = decideLifecycle(
      { ...base, state: "protected", importance: 0.9, lastContributedAt: null },
      P,
      { now: 1000 * DAY },
    );
    expect(d).toMatchObject({ next: "protected", changed: false });
  });

  it("medizinisch mit möglicher Veränderung → geschützt, Aktualität ungeklärt", () => {
    const d = decideLifecycle({ ...base, category: "medical" }, P, {
      now: 1000 * DAY,
      possibleChange: true,
    });
    expect(d).toMatchObject({ next: "protected", currency: "unresolved" });
  });

  it("offener Widerspruch → Zustand unverändert", () => {
    const d = decideLifecycle({ ...base, inOpenContradiction: true }, P, { now: 1000 * DAY });
    expect(d).toMatchObject({ next: "active", changed: false, reason: "open_contradiction_hold" });
  });

  it("ausgelaufen + spätere Bestätigung → keine stille Reaktivierung", () => {
    const d = decideLifecycle({ ...base, state: "expired" }, P, { now: 1, userConfirmed: true });
    expect(d).toMatchObject({ next: "expired", requiresNewStatement: true });
  });

  it("Schutzgrund fällt nachvollziehbar weg → aktiv, sonst bleibt Schutz", () => {
    const m = { ...base, state: "protected" as const, category: "user_marked_durable" as const };
    expect(decideLifecycle(m, P, { now: 1, protectionWithdrawn: true })).toMatchObject({
      next: "active",
      reason: "protection_withdrawn",
    });
    expect(decideLifecycle(m, P, { now: 1 }).next).toBe("protected");
  });

  it("Vermutung erhält keinen Schutz", () => {
    expect(
      decideLifecycle({ ...base, knowledgeClass: "inferred" }, P, { now: 91 * DAY }).next,
    ).toBe("dormant");
  });
});
