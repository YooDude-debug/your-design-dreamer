import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  LIFECYCLE_ORDER,
  NON_RECALLABLE_LIFECYCLES,
  isRecallableLifecycle,
} from "@/orb-core/memory-lifecycle";

describe("Phase 2A – Lifecycle im Abruf", () => {
  it("archived und forgotten sind nicht abrufbar", () => {
    expect(isRecallableLifecycle("archived")).toBe(false);
    expect(isRecallableLifecycle("forgotten")).toBe(false);
  });
  it("active, weak, stale bleiben abrufbar", () => {
    for (const l of ["active", "weak", "stale"]) expect(isRecallableLifecycle(l)).toBe(true);
  });
  it("unbekannte/fehlende Werte werden nicht erfunden und bleiben abrufbar", () => {
    expect(isRecallableLifecycle(null)).toBe(true);
    expect(isRecallableLifecycle(undefined)).toBe(true);
    expect(isRecallableLifecycle("dormant")).toBe(true);
  });
  it("nutzt nur vorhandene Zustände", () => {
    for (const l of NON_RECALLABLE_LIFECYCLES) expect(LIFECYCLE_ORDER).toContain(l);
  });
  it("Abruf filtert, exact-Treffer bleibt zustandsunabhängig, user_id-Filter unverändert", () => {
    const src = readFileSync("src/orb-core/engine.server.ts", "utf8");
    const fn = src.slice(
      src.indexOf("async function retrieveCandidates"),
      src.indexOf("/* -------------------------------------------------------------- Verarbeitung"),
    );
    expect(fn).toContain("isRecallableLifecycle(n.lifecycle)");
    expect(fn).toMatch(/const exact = key \? \(\[\.\.\.byId\.values\(\)\]/);
    expect((fn.match(/\.eq\("user_id", userId\)/g) ?? []).length).toBe(5);
  });
});

import { memoryLevel } from "@/orb-core/memory";
describe("Phase 2B – Wichtigkeit ≠ Häufigkeit", () => {
  const now = 1_000 * 3_600_000;
  it("häufig, aber unwichtig → nicht B", () => {
    expect(
      memoryLevel(
        { importance: 0.2, activationCount: 9, lastAccessedAt: now - 50 * 3_600_000 },
        now,
      ),
    ).toBe("C");
  });
  it("selten, aber wichtig → B", () => {
    expect(
      memoryLevel(
        { importance: 0.8, activationCount: 0, lastAccessedAt: now - 900 * 3_600_000 },
        now,
      ),
    ).toBe("B");
  });
});
