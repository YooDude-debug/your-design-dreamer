import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { evaluateMemories, type MemoryEvaluation } from "@/orb-core/memory-evaluation";
import {
  ORB_SHADOW_EVAL_ENABLED,
  compareShadow,
  runShadowEvaluation,
  shadowScore,
} from "@/orb-core/memory-shadow";

const evalOf = (entries: MemoryEvaluation["entries"], scope: MemoryEvaluation["scope"] = "normal"): MemoryEvaluation => ({
  kind: "orb.memory_evaluation",
  version: 1,
  scope,
  entries,
  dropped_out_of_scope: 0,
});

const E = (id: string, relevance: number, importance: number, usage: "unknown" | "usage_candidate" = "unknown") => ({
  id,
  relevance,
  importance,
  usage,
  usage_reason: usage === "unknown" ? ("no_reference_in_reply" as const) : ("verbatim_reference_in_reply" as const),
});

describe("P14 S3 shadow evaluation", () => {
  it("ist standardmäßig deaktiviert und liefert dann nichts", () => {
    expect(ORB_SHADOW_EVAL_ENABLED).toBe(false);
    expect(runShadowEvaluation({ evaluation: evalOf([E("a", 0.9, 0.5)]), modelVisibleIds: ["a"] })).toBeNull();
  });

  it("ist reproduzierbar (gleiche Eingabe → gleiches Ergebnis, unabhängig von Reihenfolge)", () => {
    const entries = [E("a", 0.9, 0.1), E("b", 0.5, 0.9), E("c", 0.4, 0.2)];
    const r1 = compareShadow({ evaluation: evalOf(entries), modelVisibleIds: ["a", "c"] });
    const r2 = compareShadow({ evaluation: evalOf([...entries].reverse()), modelVisibleIds: ["c", "a"] });
    expect(r2).toEqual(r1);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(compareShadow({ evaluation: evalOf(entries), modelVisibleIds: ["a", "c"] })));
  });

  it("gleiche Entscheidung → keine Abweichung", () => {
    const r = compareShadow({ evaluation: evalOf([E("a", 0.9, 0.9), E("b", 0.1, 0.1)]), modelVisibleIds: ["a"] });
    expect(r.deviations).toBe(0);
    expect(r.entries.every((e) => e.cause === "same_decision")).toBe(true);
  });

  it("Abweichung durch Wichtigkeit erhält nachvollziehbare Ursache", () => {
    // Baseline wählt a (höchste Relevanz); Shadow bevorzugt b wegen hoher Wichtigkeit.
    const r = compareShadow({ evaluation: evalOf([E("a", 0.6, 0.0), E("b", 0.5, 1.0)]), modelVisibleIds: ["a"] });
    const a = r.entries.find((e) => e.id === "a")!;
    const b = r.entries.find((e) => e.id === "b")!;
    expect(b.deviation).toBe("would_include");
    expect(b.cause).toBe("importance_outweighs_relevance");
    expect(a.deviation).toBe("would_exclude");
    expect(a.cause).toBe("importance_outweighs_relevance");
  });

  it("usage_candidate wirkt nur als belegter Bonus, unknown trägt nie bei", () => {
    expect(shadowScore({ relevance: 0.5, importance: 0.5, usage: "unknown" })).toBe(0.45);
    expect(shadowScore({ relevance: 0.5, importance: 0.5, usage: "usage_candidate" })).toBe(0.55);
    const r = compareShadow({
      evaluation: evalOf([E("a", 0.55, 0.5), E("b", 0.5, 0.5, "usage_candidate")]),
      modelVisibleIds: ["a"],
    });
    expect(r.entries.find((e) => e.id === "b")!.cause).toBe("usage_candidate_bonus");
  });

  it("fehlende/ungültige Werte bleiben unknown statt geraten", () => {
    const r = compareShadow({ evaluation: evalOf([E("a", Number.NaN, 0.5), E("b", 0.5, 2)]), modelVisibleIds: ["a"] });
    expect(r.unknown).toBe(2);
    for (const e of r.entries) {
      expect(e.deviation).toBe("unknown");
      expect(e.shadow_score).toBeNull();
      expect(e.cause).toBe("invalid_input_value");
    }
  });

  it("fehlender Nutzungsnachweis bleibt unknown (S2 → S3 durchgereicht)", () => {
    const ev = evaluateMemories({
      scope: "orb_core",
      memories: [{ id: "m1", relevance: 0.7, importance: 0.4, content: "Grafikkarte RTX5070" }],
      modelVisibleIds: ["m1"],
      replyText: "Klingt gut.",
      userText: "Hallo",
    });
    const r = compareShadow({ evaluation: ev, modelVisibleIds: ["m1"] });
    expect(r.entries[0]!.usage).toBe("unknown");
  });

  it.each(["normal", "orb_core", "y_dude", "unassigned"] as const)("schließt fremde Scopes aus (%s)", (scope) => {
    const other = scope === "normal" ? "y_dude" : "normal";
    const r = compareShadow({
      evaluation: evalOf([E("a", 0.9, 0.5), E("x", 0.99, 0.99)], scope),
      modelVisibleIds: ["a", "x"],
      entryScopes: { a: scope, x: other },
    });
    expect(r.scope).toBe(scope);
    expect(r.entries.map((e) => e.id)).toEqual(["a"]);
    expect(r.dropped_out_of_scope).toBe(1);
  });

  it("verändert Eingaben nicht (keine Rückwirkung auf ORB-Entscheidungen)", () => {
    const ev = evalOf([E("a", 0.6, 0.0), E("b", 0.5, 1.0)]);
    const visible = ["a"];
    const snapshot = JSON.stringify({ ev, visible });
    compareShadow({ evaluation: Object.freeze(ev), modelVisibleIds: Object.freeze(visible) });
    expect(JSON.stringify({ ev, visible })).toBe(snapshot);
  });

  it("Fehler in der Shadow-Auswertung werfen nie", () => {
    const broken = { evaluation: null as unknown as MemoryEvaluation, modelVisibleIds: [] };
    expect(() => runShadowEvaluation(broken, true)).not.toThrow();
    expect(runShadowEvaluation(broken, true)).toBeNull();
  });

  it("ist isoliert: kein DB/Netz/KI-Import, nicht in Engine oder Retrieval eingebunden", () => {
    const src = readFileSync("src/orb-core/memory-shadow.ts", "utf8");
    expect(src).not.toMatch(/supabase|fetch\(|\.server|gateway|openai|console\./i);
    const engine = readFileSync("src/orb-core/engine.server.ts", "utf8");
    expect(engine).not.toMatch(/memory-shadow/);
  });
});
