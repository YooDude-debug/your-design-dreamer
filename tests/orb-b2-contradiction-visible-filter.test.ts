import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { filterContradictionsForPrompt } from "@/orb-core/prompt-contradiction-filter";
import { detectContradictions } from "@/orb-core/continuity";
import { filterDirectAnswerMemories } from "@/orb-core/prompt-memory-filter";
import { decideConversationMode } from "@/orb-core/conversation";
import { topicOf, topicsOf } from "@/orb-core/memory";

const c = (nodeId: string) => ({ nodeId, memory: `m:${nodeId}` });

describe("B2 – Contradiction-Referenzen nur auf model-visible Memories", () => {
  it("1. P2-V2 behält A → Referenz bleibt", () => {
    expect(filterContradictionsForPrompt("DIRECT_ANSWER", [c("A")], ["A"])).toEqual([c("A")]);
  });

  it("2. P2-V2 entfernt A → Referenz entfällt", () => {
    expect(filterContradictionsForPrompt("DIRECT_ANSWER", [c("A")], [])).toEqual([]);
  });

  it("3. A sichtbar, B entfernt, C sichtbar → nur A und C", () => {
    const out = filterContradictionsForPrompt(
      "DIRECT_ANSWER",
      [c("A"), c("B"), c("C")],
      ["A", "C"],
    );
    expect(out.map((x) => x.nodeId)).toEqual(["A", "C"]);
  });

  it("4. keine Refill-Logik: Ergebnis ist immer Teilmenge in gleicher Reihenfolge", () => {
    const list = [c("A"), c("B"), c("C")];
    const before = JSON.stringify(list);
    const out = filterContradictionsForPrompt("DIRECT_ANSWER", list, ["C", "A", "Z"]);
    expect(out.length).toBeLessThanOrEqual(list.length);
    expect(out.every((x) => list.includes(x))).toBe(true);
    expect(out.map((x) => list.indexOf(x))).toEqual([...out.map((x) => list.indexOf(x))].sort());
    expect(JSON.stringify(list)).toBe(before);
    const src = readFileSync("src/orb-core/prompt-contradiction-filter.ts", "utf8");
    expect(src).not.toMatch(/push|concat|unshift/);
  });

  it("5. Contradiction-Erkennung selbst bleibt unverändert", () => {
    const mems = [{ id: "A", content: "Ich mag Kaffee", topic: topicOf("Ich mag Kaffee") }];
    const before = detectContradictions("Ich mag Kaffee nicht", mems);
    expect(before.length).toBe(1);
    filterContradictionsForPrompt("DIRECT_ANSWER", before, []);
    expect(detectContradictions("Ich mag Kaffee nicht", mems)).toEqual(before);
  });

  it("6. Antwortart-Auswahl bleibt unverändert", () => {
    const base = {
      text: "Was mache ich beruflich?",
      conversationTopics: topicsOf("Was mache ich beruflich?"),
      strands: [{ content: "Ich bin Koch", topic: "koch", relevance: 0.2, confidence: 0.9 }],
      curiosity: 1,
      energy: 0.25,
      contextMessages: 8,
      resumeThread: null,
      explicitLearning: false,
      impulseAllowed: false,
    };
    const a = decideConversationMode(base);
    filterContradictionsForPrompt(a.mode, [c("A")], []);
    expect(decideConversationMode(base)).toEqual(a);
  });

  it("7. andere Modi bleiben unverändert (UNKNOWN, kein Eingriff)", () => {
    for (const mode of ["FOLLOW_UP", "LISTEN", "IMPULSE", "REFLECT"]) {
      expect(filterContradictionsForPrompt(mode, [c("A"), c("B")], [])).toEqual([c("A"), c("B")]);
    }
  });

  it("8. konsistent mit der finalen P2-V2-Liste", () => {
    const items = [
      { id: "A", content: "Ich mag Kaffee", topic: topicOf("Ich mag Kaffee") },
      { id: "B", content: "Ich mag Berge", topic: topicOf("Ich mag Berge") },
    ];
    const text = "Ich mag Kaffee nicht";
    const found = detectContradictions(text, items);
    const visible = filterDirectAnswerMemories(text, items);
    const out = filterContradictionsForPrompt(
      "DIRECT_ANSWER",
      found,
      visible.map((v) => v.id),
    );
    const visibleIds = new Set(visible.map((v) => v.id));
    expect(out.every((x) => visibleIds.has(x.nodeId))).toBe(true);
  });

  it("9. null-IDs zählen nie als sichtbar", () => {
    expect(filterContradictionsForPrompt("DIRECT_ANSWER", [c("A")], [null, null])).toEqual([]);
  });

  it("10. Engine filtert erst nach P2 V2 und nur für den Prompt", () => {
    const src = readFileSync("src/orb-core/engine.server.ts", "utf8");
    expect(src).toContain("filterContradictionsForPrompt(");
    expect(src).toContain("contradictions: promptContradictions(conversationPlan)");
    // Speicherung und Zustand nutzen weiterhin die ungefilterte Liste.
    expect(src).toContain("contradictions,\n    focusNodeId");
    const filterAt = src.indexOf("const promptContradictions");
    expect(filterAt).toBeGreaterThan(src.indexOf("const directAnswerItems"));
  });
});
