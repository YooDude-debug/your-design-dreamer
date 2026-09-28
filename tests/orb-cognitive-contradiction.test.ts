import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { detectContradiction, type OrbStatement } from "@/orb-core/cognitive/contradiction";
import { isDirectMemory } from "@/orb-core/cognitive/foundation";

const s = (
  subject: string,
  predicate: string,
  value: string,
  extra: Partial<OrbStatement> = {},
): OrbStatement => ({
  subject,
  predicate,
  value,
  ...extra,
});
const blau = s("Auto", "farbe", "blau");
const rot = s("Auto", "farbe", "rot");

describe("Phase 8 – Cognitive Contradiction", () => {
  it("A – gleiche Aussage → none", () => {
    const r = detectContradiction(blau, s("Auto", "farbe", "blau"));
    expect(r).toMatchObject({ detected: false, type: "none" });
  });

  it("B/P – anderer Value → direct, confidence 1", () => {
    expect(detectContradiction(blau, rot)).toMatchObject({
      detected: true,
      type: "direct",
      confidence: 1,
    });
  });

  it("C/D – anderes Subject / Predicate → none", () => {
    expect(detectContradiction(blau, s("Motorrad", "farbe", "rot")).type).toBe("none");
    expect(detectContradiction(blau, s("Auto", "tempo", "schnell")).type).toBe("none");
  });

  it("E/F/G/Q – fehlende Teile → unknown, confidence null", () => {
    for (const bad of [s("", "farbe", "rot"), s("Auto", "  ", "rot"), s("Auto", "farbe", "")]) {
      expect(detectContradiction(blau, bad)).toMatchObject({
        detected: false,
        type: "unknown",
        confidence: null,
      });
      expect(detectContradiction(bad, blau).type).toBe("unknown");
    }
    expect(
      detectContradiction(blau, { subject: "Auto", predicate: "farbe" } as OrbStatement).type,
    ).toBe("unknown");
  });

  it("H/I – Whitespace und Groß-/Kleinschreibung normalisiert", () => {
    expect(detectContradiction(blau, s(" auto ", " Farbe", "Blau ")).type).toBe("none");
    expect(detectContradiction(blau, s(" AUTO", "FARBE ", " Rot")).type).toBe("direct");
  });

  it("J/K/L/M – Provenance erhalten, keine Quellenpriorisierung", () => {
    const mem = { type: "memory", memoryId: "m1" } as const;
    const conv = { type: "conversation", messageId: "c1" } as const;
    const inf = { type: "inference", sourceIds: ["m1"] } as const;
    const a = detectContradiction(
      s("Auto", "farbe", "blau", { source: mem }),
      s("Auto", "farbe", "rot", { source: conv }),
    );
    const b = detectContradiction(
      s("Auto", "farbe", "blau", { source: conv }),
      s("Auto", "farbe", "rot", { source: mem }),
    );
    expect(a.left.source).toEqual(mem);
    expect(a.right.source).toEqual(conv);
    expect([a.type, a.confidence]).toEqual([b.type, b.confidence]);
    const c = detectContradiction(
      s("Auto", "farbe", "blau", { source: conv }),
      s("Auto", "farbe", "rot", { source: inf }),
    );
    expect(c.right.source).toEqual(inf);
    expect(isDirectMemory(c.right.source!)).toBe(false);
    const d = detectContradiction(
      s("Auto", "farbe", "blau", { source: mem }),
      s("Auto", "farbe", "rot", { source: mem }),
    );
    expect([d.type, d.confidence]).toEqual(["direct", 1]);
  });

  it("N/O – keine Zeit- oder Wahrheitsentscheidung", () => {
    const old = s("Auto", "farbe", "blau", { observedAt: "2020-01-01T00:00:00Z" });
    const neu = s("Auto", "farbe", "rot", { observedAt: "2026-09-28T00:00:00Z" });
    const a = detectContradiction(old, neu);
    const b = detectContradiction(neu, old);
    expect([a.type, a.confidence]).toEqual([b.type, b.confidence]);
    expect(a.left.observedAt).toBe(old.observedAt);
    const rec = a as unknown as Record<string, unknown>;
    for (const k of ["winner", "truth", "preferred", "resolved", "keep", "discard"])
      expect(rec[k]).toBeUndefined();
  });

  it("R/V – deterministisch, Eingaben unverändert", () => {
    const l = s("Auto", "farbe", "blau", { source: { type: "inference", sourceIds: ["x"] } });
    const snap = JSON.stringify(l);
    const r1 = detectContradiction(l, rot);
    expect(r1).toEqual(detectContradiction(l, rot));
    expect(r1.left).not.toBe(l);
    expect(JSON.stringify(l)).toBe(snap);
  });

  it("S/T/U/W/X – keine Uhr, Zufall, DB/API/LLM, Retrieval, Learning", () => {
    const src = readFileSync("src/orb-core/cognitive/contradiction.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(
      /Date\.now|new Date\(|Math\.random|randomUUID|supabase|fetch\(|createServerFn|\.server"|insert\(|speak\(|retriev|memory-|learn|process\.env/i,
    );
    expect(code.match(/^import .*$/gm)).toEqual([
      'import type { OrbInformationSource } from "@/orb-core/cognitive/foundation";',
    ]);
  });

  it("Y/Z – nicht eingebunden; novelty/uncertainty unverändert eigenständig", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f)) files.push(p);
      }
    };
    walk("src");
    const users = files.filter(
      (f) =>
        !f.endsWith("cognitive/contradiction.ts") &&
        readFileSync(f, "utf8").includes("cognitive/contradiction"),
    );
    expect(users).toEqual([]);
  });
});
