import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { distinctiveTokens, evaluateMemories } from "@/orb-core/memory-evaluation";
import { logPassiveMemoryEvaluation } from "@/orb-core/memory-evaluation.server";
import { ORB_DATA_SCOPES } from "@/orb-core/scope-values";

const mem = (id: string, content: string, relevance = 0.5, importance = 0.5) => ({
  id,
  content,
  relevance,
  importance,
});

describe("P14 S2 – Relevanz und Wichtigkeit getrennt", () => {
  it("werden unverändert und unabhängig übernommen", () => {
    const e = evaluateMemories({
      scope: "normal",
      memories: [mem("a", "x", 0.9, 0.1), mem("b", "y", 0.1, 0.9)],
      modelVisibleIds: [],
      replyText: "",
      userText: "",
    });
    expect(e.entries.map((x) => [x.id, x.relevance, x.importance])).toEqual([
      ["a", 0.9, 0.1],
      ["b", 0.1, 0.9],
    ]);
  });
  it("Nutzungsstatus hängt weder von Relevanz noch von Wichtigkeit ab", () => {
    const run = (r: number, i: number) =>
      evaluateMemories({
        scope: "normal",
        memories: [mem("a", "Grafikkarte RTX 5070", r, i)],
        modelVisibleIds: ["a"],
        replyText: "Du hast eine RTX 5070.",
        userText: "Welche Grafikkarte habe ich?",
      }).entries[0]!.usage;
    expect(new Set([run(0, 0), run(1, 1), run(0.2, 0.9), run(0.9, 0.2)])).toEqual(
      new Set(["usage_candidate"]),
    );
  });
});

describe("P14 S2 – Nutzung", () => {
  it("ohne Nachweis: unknown", () => {
    const e = evaluateMemories({
      scope: "normal",
      memories: [mem("a", "Lieblingsessen Lasagne")],
      modelVisibleIds: ["a"],
      replyText: "Schön, dass du fragst.",
      userText: "Wie geht es dir?",
    });
    expect(e.entries[0]).toMatchObject({ usage: "unknown", usage_reason: "no_reference_in_reply" });
  });
  it("gefunden/ausgewählt, aber nicht im Prompt: unknown, auch wenn die Antwort passt", () => {
    const e = evaluateMemories({
      scope: "normal",
      memories: [mem("a", "Lieblingsessen Lasagne")],
      modelVisibleIds: [],
      replyText: "Lasagne!",
      userText: "?",
    });
    expect(e.entries[0]).toMatchObject({ usage: "unknown", usage_reason: "not_model_visible" });
  });
  it("Prompt-Aufnahme allein ergibt keine Nutzung", () => {
    const e = evaluateMemories({
      scope: "normal",
      memories: [mem("a", "Wohnort Hamburg")],
      modelVisibleIds: ["a"],
      replyText: "Okay.",
      userText: "Hallo",
    });
    expect(e.entries[0]!.usage).toBe("unknown");
  });
  it("nachweisbare wörtliche Referenz → usage_candidate", () => {
    const e = evaluateMemories({
      scope: "normal",
      memories: [mem("a", "Wohnort Hamburg")],
      modelVisibleIds: ["a"],
      replyText: "Du wohnst in Hamburg.",
      userText: "Wo wohne ich?",
    });
    expect(e.entries[0]).toMatchObject({
      usage: "usage_candidate",
      usage_reason: "verbatim_reference_in_reply",
    });
  });
  it("Referenz stammt auch aus der Nutzereingabe → unknown", () => {
    const e = evaluateMemories({
      scope: "normal",
      memories: [mem("a", "Wohnort Hamburg")],
      modelVisibleIds: ["a"],
      replyText: "Hamburg ist schön.",
      userText: "Ich mag Hamburg",
    });
    expect(e.entries[0]!.usage_reason).toBe("reference_also_in_user_input");
  });
  it("Referenz passt auf mehrere Memories → unknown (mehrdeutig)", () => {
    const e = evaluateMemories({
      scope: "normal",
      memories: [mem("a", "Urlaub Hamburg"), mem("b", "Wohnort Hamburg")],
      modelVisibleIds: ["a", "b"],
      replyText: "Hamburg.",
      userText: "?",
    });
    expect(e.entries.map((x) => x.usage_reason)).toEqual([
      "reference_ambiguous",
      "reference_ambiguous",
    ]);
  });
  it("nur Allerweltswörter → unknown (kein unterscheidungskräftiges Token)", () => {
    expect(distinctiveTokens("ich mag es")).toEqual([]);
    const e = evaluateMemories({
      scope: "normal",
      memories: [mem("a", "ich mag es")],
      modelVisibleIds: ["a"],
      replyText: "ich mag es",
      userText: "",
    });
    expect(e.entries[0]!.usage_reason).toBe("no_distinctive_token");
  });
  it("Teilwort zählt nicht als Referenz", () => {
    const e = evaluateMemories({
      scope: "normal",
      memories: [mem("a", "Modell 5070")],
      modelVisibleIds: ["a"],
      replyText: "Nummer 50701",
      userText: "",
    });
    expect(e.entries[0]!.usage).toBe("unknown");
  });
});

describe("P14 S2 – Bereichsgrenzen", () => {
  it.each(ORB_DATA_SCOPES)("Bereich %s: fremde Einträge werden verworfen", (scope) => {
    const other = ORB_DATA_SCOPES.find((s) => s !== scope)!;
    const e = evaluateMemories({
      scope,
      memories: [
        { ...mem("own", "Wohnort Hamburg"), scope },
        { ...mem("foreign", "Wohnort Hamburg"), scope: other },
      ],
      modelVisibleIds: ["own", "foreign"],
      replyText: "Hamburg",
      userText: "",
    });
    expect(e.scope).toBe(scope);
    expect(e.entries.map((x) => x.id)).toEqual(["own"]);
    expect(e.dropped_out_of_scope).toBe(1);
    // Fremder Eintrag macht die eigene Referenz nicht mehrdeutig.
    expect(e.entries[0]!.usage).toBe("usage_candidate");
  });
  it("ohne bekannten Bereich wird nichts bewertet oder geloggt", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logPassiveMemoryEvaluation({
      scope: null,
      eventId: "e",
      recalled: [mem("a", "x")],
      modelVisibleIds: [],
      replyText: "",
      userText: "",
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("P14 S2 – passiv, ohne Inhalte, ohne Rückwirkung", () => {
  it("Log enthält keine Inhalte, Antwort- oder Nutzertexte", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logPassiveMemoryEvaluation({
      scope: "orb_core",
      eventId: "evt_1",
      recalled: [mem("a", "Geheimwort Zebrafink42")],
      modelVisibleIds: ["a"],
      replyText: "Zebrafink42 Antworttext",
      userText: "Nutzertext",
    });
    const line = spy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(line).toContain("[orb.obs.memory_eval]");
    expect(line).toContain("contributed");
    expect(line).not.toMatch(/Zebrafink|Geheimwort|Antworttext|Nutzertext/);
    spy.mockRestore();
  });
  it("Eingaben werden nicht verändert; deterministisch", () => {
    const memories = [mem("b", "Wohnort Hamburg", 0.3, 0.7), mem("a", "RTX 5070", 0.6, 0.2)];
    const snapshot = JSON.stringify(memories);
    const args = {
      scope: "y_dude" as const,
      memories,
      modelVisibleIds: ["a", "b"],
      replyText: "RTX 5070",
      userText: "",
    };
    expect(evaluateMemories(args)).toEqual(evaluateMemories(args));
    expect(JSON.stringify(memories)).toBe(snapshot);
  });
  it("wirft nie, auch bei kaputter Eingabe", () => {
    expect(() =>
      logPassiveMemoryEvaluation({
        scope: "normal",
        eventId: "e",
        recalled: null as never,
        modelVisibleIds: [],
        replyText: "",
        userText: "",
      }),
    ).not.toThrow();
  });
  it("Module ohne DB/KI/Netz; Engine-Aufruf nach Abschlusslog, Rückgabe unbeeinflusst", () => {
    for (const f of [
      "src/orb-core/memory-evaluation.ts",
      "src/orb-core/memory-evaluation.server.ts",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/supabase|\.from\(|fetch\(|scopedDb|gateway|insert|update\(/);
    }
    const engine = readFileSync("src/orb-core/engine.server.ts", "utf8");
    const call = engine.indexOf("logPassiveMemoryEvaluation({");
    expect(call).toBeGreaterThan(engine.indexOf('kind: "turn"'));
    // Rückgabewert wird nicht verwendet.
    expect(engine).not.toMatch(/=\s*logPassiveMemoryEvaluation/);
    expect(readFileSync("src/orb-core/memory-lifecycle.ts", "utf8")).not.toMatch(/evaluation/);
  });
});
