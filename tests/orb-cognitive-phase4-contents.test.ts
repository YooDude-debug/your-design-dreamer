import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  runCognitiveObservation as run,
  type OrbObservedMemory,
} from "@/orb-core/cognitive-observation";
import { SOURCE_UNCERTAINTY } from "@/orb-core/cognitive/uncertainty";

const engine = readFileSync("src/orb-core/engine.server.ts", "utf8");
const ENTRY = readFileSync("src/orb-core/cognitive-observation.ts", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

const obs = (
  memories: OrbObservedMemory[],
  path: "chat" | "proactive_question" = "chat",
) => {
  const r = run({ path, memoryIds: memories.map((m) => m.id), memories });
  if (r.status !== "observed") throw new Error("expected observed");
  return r;
};
const unc = (r: ReturnType<typeof obs>, i: number) => r.snapshot.candidates[i].uncertainty!;

describe("Phase 4 – Memory-Inhalte aus dem Runtimepfad", () => {
  it("A – ein Memory ohne Vergleich: sourceAgreement/contradiction null", () => {
    const u = unc(obs([{ id: "m1", content: "Mein Auto ist rot" }]), 0);
    expect(u.factors.sourceAgreement).toBeNull();
    expect(u.factors.contradiction).toBeNull();
  });

  it("A2 – Inhalte ohne Treffer: contradiction 0 (Contract), sourceAgreement null", () => {
    const r = obs([
      { id: "m1", content: "Mein Auto ist rot" },
      { id: "m2", content: "Ich spiele gern Schach am Wochenende" },
    ]);
    expect(unc(r, 0).factors.contradiction).toBe(0);
    expect(unc(r, 0).factors.sourceAgreement).toBeNull();
  });

  it("B – übereinstimmende Inhalte: bestehende Agreement-Logik", () => {
    const r = obs([
      { id: "m1", content: "Ich arbeite als Tischler in Berlin" },
      { id: "m2", content: "Ich arbeite als Tischler in Berlin seit Jahren" },
    ]);
    expect(unc(r, 0).agreeingSources).toEqual([{ type: "memory", memoryId: "m2" }]);
    expect(unc(r, 0).factors.sourceAgreement).toBe(0);
    expect(unc(r, 0).factors.contradiction).toBe(0);
  });

  it("C – Widerspruch nach bestehender lexikalischer Regel", () => {
    const r = obs([
      { id: "m1", content: "Mein Auto ist rot" },
      { id: "m2", content: "Mein Auto ist blau" },
    ]);
    const u = unc(r, 0);
    expect(u.factors.contradiction).toBe(1);
    expect(u.factors.sourceAgreement).toBe(1);
    expect(u.contradictions).toEqual([
      {
        incoming: { type: "memory", memoryId: "m1" },
        existing: { type: "memory", memoryId: "m2" },
        existingText: "Mein Auto ist blau",
      },
    ]);
  });

  it("D/E – Herkunft wird unverändert durchgereicht, inferred bleibt inferred", () => {
    const r = obs([
      { id: "a", content: "x ist 1", origin: "user_stated" },
      { id: "b", content: "y ist 2", origin: "observed" },
      { id: "c", content: "z ist 3", origin: "inferred" },
      { id: "d", content: "w ist 4" },
    ]);
    expect(r.memoryOrigins).toEqual([
      { memoryId: "a", origin: "user_stated" },
      { memoryId: "b", origin: "observed" },
      { memoryId: "c", origin: "inferred" },
      { memoryId: "d", origin: null },
    ]);
    // Contract-Quelle bleibt die Memory-Referenz; keine erfundene Inference.
    expect(r.snapshot.candidates[2].source).toEqual({ type: "memory", memoryId: "c" });
    expect(JSON.stringify(r)).not.toMatch(/"type":"inference"/);
  });

  it("F – proactive_question nutzt Gap-Inhalte; keine ORB-Frage als Aussage", () => {
    const r = obs(
      [
        { id: "g1", content: "Mein Auto ist rot" },
        { id: "g2", content: "Mein Auto ist blau" },
      ],
      "proactive_question",
    );
    expect(r.path).toBe("proactive_question");
    expect(unc(r, 0).factors.contradiction).toBe(1);
    expect(engine).toMatch(
      /memoryIds: ctx\.gaps\.map\(\(g\) => g\.nodeId\),\s+memories: ctx\.gaps\.map\(\(g\) => \(\{ id: g\.nodeId, content: g\.memory \}\)\),/,
    );
    expect(engine.match(/memories: ctx\.gaps\.map/g)).toHaveLength(2);
    expect(engine).not.toMatch(/memories:[^\n]*spoken\.question/);
  });

  it("11 – Runtime-Contract Chat: recalled-Inhalt/Herkunft gelangt zu Phase 4", () => {
    expect(engine).toMatch(
      /memoryIds: recalled\.map\(\(r\) => r\.node\.id\),\s+memories: recalled\.map\(\(r\) => \(\{\s+id: r\.node\.id,\s+content: r\.node\.content,\s+origin: r\.node\.source,\s+\}\)\),/,
    );
    expect(ENTRY).toMatch(/assessCognitiveUncertainty\(/);
  });

  it("G/H – keine DB-, Netzwerk- oder Modellzugriffe im Orchestrator", () => {
    for (const p of [/fetch\(/, /supabase/i, /\bdb\./, /Date\.now|new Date/, /llm/i])
      expect(ENTRY).not.toMatch(p);
    expect(engine.match(/runCognitiveObservation\(/g)).toHaveLength(3);
  });

  it("I/J – recencyUncertainty null; Quellenfaktoren unverändert", () => {
    const u = unc(
      obs([
        { id: "m1", content: "Mein Auto ist rot" },
        { id: "m2", content: "Mein Auto ist blau" },
      ]),
      1,
    );
    expect(u.factors.recencyUncertainty).toBeNull();
    expect(u.factors.sourceCertainty).toBe(SOURCE_UNCERTAINTY.memory);
    expect(u.factors.inferenceDependency).toBe(0);
    expect(u.factors.missingEvidence).toBe(0);
  });

  it("K/L – Phase 9–16 laufen, deterministisch, Eingaben unverändert", () => {
    const mem = [
      { id: "m1", content: "Mein Auto ist rot" },
      { id: "m2", content: "Mein Auto ist blau" },
    ];
    const before = structuredClone(mem);
    const a = obs(mem);
    expect(mem).toEqual(before);
    expect(a).toEqual(obs(mem));
    expect(a.competitions ?? a.snapshot.competitions).toHaveLength(1);
    expect(a.actionPlans.length).toBeGreaterThan(0);
    expect(a.outcome).toBeNull();
    expect(a.adaptation).toBeNull();
    // Ohne memories identisch zum bisherigen Verhalten.
    const plain = run({ path: "chat", memoryIds: ["m1"] });
    if (plain.status !== "observed") throw new Error();
    expect(plain.snapshot.candidates[0].uncertainty?.factors.contradiction).toBeNull();
  });
});
