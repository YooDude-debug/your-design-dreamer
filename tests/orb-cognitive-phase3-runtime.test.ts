import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runCognitiveObservation } from "@/orb-core/cognitive-observation";

const mem = (id: string, content: string, lastAccessedAt?: string) => ({
  id,
  content,
  origin: "user_stated",
  lastAccessedAt,
});
const NOW = "2026-09-29T10:00:00.000Z";

function chat(text: string, memories: ReturnType<typeof mem>[], extra: Record<string, unknown> = {}) {
  const r = runCognitiveObservation({
    path: "chat",
    memoryIds: memories.map((m) => m.id),
    memories,
    input: { text, context: [], now: NOW, ...extra },
  });
  if (r.status !== "observed") throw new Error("failed");
  return r;
}

describe("Phase 3 Novelty – Chat-Runtime (passiv)", () => {
  it("A) Nutzereingabe + bekannte Memory-Inhalte → Faktoren bestimmt", () => {
    const r = chat("Mein Hund heißt Bello", [mem("m1", "Mein Hund heißt Bello", "2026-09-01T00:00:00Z")]);
    const f = r.inputNovelty!.factors;
    expect(f.repetition).toBe(1);
    expect(f.memoryNovelty).toBe(0);
    expect(f.contradiction).toBe(0);
    expect(f.contextNovelty).toBe(1);
    expect(f.reactivation).toBeCloseTo((28 + 10 / 24) / 180, 5);
  });

  it("B) abweichende Eingabe → memoryNovelty 1, detailNovelty null (kein verwandter Inhalt)", () => {
    const f = chat("Quantenphysik fasziniert", [mem("m1", "Mein Hund heißt Bello")]).inputNovelty!.factors;
    expect(f.memoryNovelty).toBe(1);
    expect(f.detailNovelty).toBeNull();
    expect(f.reactivation).toBeNull();
  });

  it("C) ähnliche Eingabe → repetition > 0", () => {
    const f = chat("Mein Hund Bello schläft", [mem("m1", "Mein Hund heißt Bello")]).inputNovelty!.factors;
    expect(f.repetition!).toBeGreaterThan(0);
    expect(f.detailNovelty!).toBeGreaterThan(0);
  });

  it("D) mehrere Memory-Inhalte; Widerspruch nach bestehender Regel, beide Seiten erhalten", () => {
    const r = chat("Bello ist braun", [mem("m1", "Bello ist schwarz"), mem("m2", "Anna mag Tee")]);
    expect(r.inputNovelty!.factors.contradiction).toBe(1);
    expect(r.inputNovelty!.contradictions[0].existing).toEqual({ type: "memory", memoryId: "m1" });
  });

  it("E) keine Memory-Inhalte → known [] (nichts bekannt)", () => {
    const f = chat("Hallo", []).inputNovelty!.factors;
    expect(f.memoryNovelty).toBe(1);
    expect(f.repetition).toBe(0);
  });

  it("F) echte messageId → conversation source", () => {
    const r = chat("Hallo", [], { messageId: "msg-1" });
    expect(r.inputNovelty!.provenance).toEqual({ type: "conversation", messageId: "msg-1" });
  });

  it("G) keine messageId → Quelle unknown, keine erfundene ID", () => {
    const r = chat("Hallo", []);
    expect(r.inputNovelty!.provenance).toEqual({ type: "unknown" });
    expect(JSON.stringify(r.inputNovelty)).not.toContain("messageId");
  });

  it("H) proactive_question → keine User-Novelty", () => {
    const r = runCognitiveObservation({
      path: "proactive_question",
      memoryIds: ["g1"],
      memories: [mem("g1", "Frage")],
      input: { text: "Was magst du?", now: NOW },
    });
    expect(r.status === "observed" && r.inputNovelty).toBeNull();
  });

  it("I/J) keine DB-/Modellaufrufe (kein fetch)", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    chat("Test", [mem("m1", "Test")]);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    const src = readFileSync("src/orb-core/cognitive-observation.ts", "utf8");
    expect(src).not.toMatch(/\.from\(|fetch\(|supabase/);
  });

  it("K) Novelty fließt nicht in Candidates/Snapshot", () => {
    const a = chat("Bello ist braun", [mem("m1", "Bello ist schwarz")]);
    const b = runCognitiveObservation({
      path: "chat",
      memoryIds: ["m1"],
      memories: [mem("m1", "Bello ist schwarz")],
    });
    if (b.status !== "observed") throw new Error();
    expect(a.snapshot).toEqual(b.snapshot);
    expect(a.strategies).toEqual(b.strategies);
    expect(a.decision).toEqual(b.decision);
    expect(a.actionPlans).toEqual(b.actionPlans);
    expect(b.inputNovelty).toBeNull();
  });

  it("L/M) Phase 4 und Phasen 9–16 weiter funktionsfähig", () => {
    const r = chat("x", [mem("m1", "Bello ist schwarz"), mem("m2", "Bello ist braun")]);
    const u = r.snapshot.candidates[0].uncertainty!;
    expect(u.factors.contradiction).toBe(1);
    expect(r.decision).toBeTruthy();
    expect(r.outcome).toBeNull();
    expect(r.adaptation).toBeNull();
  });

  it("Engine importiert keine Cognitive-Phase direkt", () => {
    const src = readFileSync("src/orb-core/engine.server.ts", "utf8");
    expect(src).not.toMatch(/orb-core\/cognitive\//);
  });
});
