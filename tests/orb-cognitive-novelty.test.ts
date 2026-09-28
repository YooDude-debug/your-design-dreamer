import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { assessCognitiveNovelty, type OrbKnownStatement } from "@/orb-core/cognitive/novelty";
import { isDirectMemory, type OrbInformationSource } from "@/orb-core/cognitive/foundation";

const conv: OrbInformationSource = { type: "conversation", messageId: "c1" };
const ydude: OrbKnownStatement = {
  text: "Der Benutzer arbeitet an Y-Dude",
  source: { type: "memory", memoryId: "m1" },
  lastActivatedAt: "2026-09-27T00:00:00Z",
};
const NOW = "2026-09-28T00:00:00Z";

describe("Phase 3 – Cognitive Novelty", () => {
  it("A – neue Information zu unbekanntem Thema", () => {
    const a = assessCognitiveNovelty({ statement: "Ich spiele Schach im Verein", source: conv, known: [ydude], context: [], now: NOW });
    expect(a.factors.memoryNovelty).toBe(1);
    expect(a.factors.repetition).toBe(0);
    expect(a.factors.detailNovelty).toBeNull();
    expect(a.factors.reactivation).toBeNull();
    expect(a.factors.contextNovelty).toBe(1);
  });

  it("B – bekanntes Thema + neues Detail", () => {
    const a = assessCognitiveNovelty({
      statement: "Der Benutzer arbeitet an Y-Dude mit neuem Offline-Sync-Ansatz über CRDT",
      source: conv,
      known: [ydude],
      now: NOW,
    });
    expect(a.factors.detailNovelty!).toBeGreaterThan(0.5);
    expect(a.factors.memoryNovelty!).toBeLessThan(a.factors.detailNovelty! + 0.2);
  });

  it("C – exakte Wiederholung", () => {
    const a = assessCognitiveNovelty({ statement: "Ich arbeite weiterhin an Y-Dude", source: conv, known: [{ ...ydude, text: "Ich arbeite an Y-Dude" }], now: NOW });
    expect(a.factors.repetition).toBe(1);
    expect(a.factors.memoryNovelty).toBe(0);
    expect(a.factors.detailNovelty).toBe(0);
  });

  it("D/P – lange nicht erwähnt: reactivation hoch, memoryNovelty niedrig", () => {
    const a = assessCognitiveNovelty({
      statement: "Der Benutzer arbeitet an Y-Dude",
      source: conv,
      known: [{ ...ydude, lastActivatedAt: "2026-03-01T00:00:00Z" }],
      now: NOW,
    });
    expect(a.factors.reactivation).toBe(1);
    expect(a.factors.memoryNovelty).toBe(0);
  });

  it("E/F/R – Widerspruch, beide Quellen erhalten, keine Wahrheitsentscheidung", () => {
    const old: OrbKnownStatement = { text: "Das Lieblingsspiel ist Elden Ring", source: { type: "memory", memoryId: "m9" } };
    const a = assessCognitiveNovelty({ statement: "Das Lieblingsspiel ist Tetris", source: conv, known: [old] });
    expect(a.factors.contradiction).toBe(1);
    expect(a.contradictions).toEqual([{ incoming: conv, existing: old.source, existingText: old.text }]);
    expect(Object.keys(a.contradictions[0]).sort()).toEqual(["existing", "existingText", "incoming"]);
    const r = a as Record<string, unknown>;
    expect(r.winner).toBeUndefined();
    expect(r.truth).toBeUndefined();
    expect(a.factors.memoryNovelty).not.toBe(a.factors.contradiction);
  });

  it("G – fehlende Daten → null", () => {
    const a = assessCognitiveNovelty({ statement: "Etwas" });
    expect(Object.values(a.factors).every((v) => v === null)).toBe(true);
    expect(a.confidence).toBe(0);
    expect(assessCognitiveNovelty().unknownFactors).toHaveLength(6);
  });

  it("H/I/J – NaN, Infinity → null; außerhalb 0..1 → clamp", () => {
    const a = assessCognitiveNovelty({
      factors: { memoryNovelty: NaN, contextNovelty: Infinity, detailNovelty: -Infinity, reactivation: 4, repetition: -1 },
    });
    expect(a.factors.memoryNovelty).toBeNull();
    expect(a.factors.contextNovelty).toBeNull();
    expect(a.factors.detailNovelty).toBeNull();
    expect(a.invalidFactors).toEqual(["memoryNovelty", "contextNovelty", "detailNovelty"]);
    expect(a.factors.reactivation).toBe(1);
    expect(a.factors.repetition).toBe(0);
  });

  it("K/L – Provenance unverändert, Inference nie Memory, keine Mutation", () => {
    const inf: OrbInformationSource = { type: "inference", sourceIds: ["m1"] };
    const known = [ydude];
    const snap = JSON.stringify({ inf, known });
    const a = assessCognitiveNovelty({ statement: "Y-Dude nutzt CRDT", source: inf, known, now: NOW });
    expect(a.provenance).toEqual(inf);
    expect(a.provenance).not.toBe(inf);
    expect(a.basedOnInference).toBe(true);
    expect(isDirectMemory(a.provenance)).toBe(false);
    expect(JSON.stringify({ inf, known })).toBe(snap);
    expect(assessCognitiveNovelty({ statement: "x", source: { type: "bogus" } }).provenance).toEqual({ type: "unknown" });
  });

  it("M – Recency und Novelty getrennt: aktuell erwähnt, aber nicht neu", () => {
    const a = assessCognitiveNovelty({ statement: "Der Benutzer arbeitet an Y-Dude", source: conv, known: [ydude], context: ["Der Benutzer arbeitet an Y-Dude"], now: NOW });
    expect(a.factors.reactivation!).toBeLessThan(0.01);
    expect(a.factors.contextNovelty).toBe(0);
    expect(a.factors.memoryNovelty).toBe(0);
    expect((a.factors as Record<string, unknown>).recency).toBeUndefined();
  });

  it("N/O – Importance bestimmt Novelty nicht", () => {
    const important = { ...ydude, importance: 0.95 } as OrbKnownStatement & { importance: number };
    const hi = assessCognitiveNovelty({ statement: "Der Benutzer arbeitet an Y-Dude", source: conv, known: [important] });
    expect(hi.factors.memoryNovelty).toBe(0);
    const lo = assessCognitiveNovelty({ statement: "Ich lerne Griechisch", source: conv, known: [{ ...ydude, importance: 0.05 } as OrbKnownStatement] });
    expect(lo.factors.memoryNovelty).toBe(1);
    expect(important.importance).toBe(0.95);
  });

  it("Q – Repetition ist nicht Novelty; kein Gesamtscore", () => {
    const a = assessCognitiveNovelty({ statement: "Ich arbeite an Y-Dude", source: conv, known: [{ ...ydude, text: "Ich arbeite an Y-Dude" }] }) as unknown as Record<string, unknown>;
    expect(a.novelty).toBeUndefined();
    expect(a.score).toBeUndefined();
    expect(a.interesting).toBeUndefined();
  });

  it("deterministisch, isoliert, ohne Seiteneffekte", () => {
    const i = { statement: "Das Spiel ist Tetris", source: conv, known: [ydude], context: ["hi"], now: NOW };
    expect(assessCognitiveNovelty(i)).toEqual(assessCognitiveNovelty(i));
    const src = readFileSync("src/orb-core/cognitive/novelty.ts", "utf8");
    expect(src).not.toMatch(/supabase|fetch\(|createServerFn|\.server|insert\(|speak\(|process\.env|Date\.now|Math\.random/);
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f)) files.push(p);
      }
    };
    walk("src");
    const users = files.filter((f) => !f.endsWith("cognitive/novelty.ts") && readFileSync(f, "utf8").includes("cognitive/novelty"));
    expect(users).toEqual([]);
  });
});
