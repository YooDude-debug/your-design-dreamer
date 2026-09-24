import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildSpeakSystemParts,
  buildSpeakSystemPrompt,
  joinSpeakParts,
  type SpeakPromptInput,
} from "@/orb-core/llm/prompt.server";
import { countConversation, measureSpeakPrompt } from "@/orb-core/llm/prompt-metrics";
import { contextWindow, formatConversationContext } from "@/orb-core/context";
import { selectByLevel, type MemoryLevel } from "@/orb-core/memory";
import { selectReliableMemories } from "@/orb-core/eligibility";

const state = { curiosity: 0.5, joy: 0.5, fear: 0.1, trust: 0.6, uncertainty: 0.2, energy: 0.8 };

function input(over: Partial<SpeakPromptInput> = {}): SpeakPromptInput {
  return {
    state: state as SpeakPromptInput["state"],
    goals: ["help_user"],
    decision: "answer",
    recalled: [],
    interests: [],
    mode: "DIRECT_ANSWER",
    modeReason: "Test",
    ...over,
  };
}

function measure(i: SpeakPromptInput, userText = "Hallo ORB") {
  const parts = buildSpeakSystemParts(i);
  const system = joinSpeakParts(parts);
  return {
    system,
    m: measureSpeakPrompt({
      parts,
      system,
      userText,
      counts: {
        memories: i.recalled.length,
        certainty: i.phrasings?.length ?? 0,
        interests: Math.min(5, i.interests.length),
        threads: i.openThreads?.length ?? 0,
        contradictions: i.contradictions?.length ?? 0,
        historyMessages: 0,
      },
      buildMs: 0,
    }),
  };
}

function sumChars(m: ReturnType<typeof measure>["m"]) {
  return Object.values(m.sections).reduce((a, s) => a + s.chars, 0) + m.separatorChars;
}

const mems = (n: number) => Array.from({ length: n }, (_, k) => `Ich mag Thema ${k} sehr gern.`);

describe("P0 Prompt-Messbarkeit", () => {
  const cases: [string, SpeakPromptInput, string][] = [
    ["normaler Chat", input({ context: "Benutzer: Hi | Du: Hallo" }), "Wie geht's?"],
    ["0 Memories", input(), "Hallo"],
    [
      "mehrere Memories",
      input({
        recalled: mems(3),
        phrasings: mems(3).map((c) => ({ content: c, certainty: "vage" as const, hint: "h" })),
      }),
      "Was mag ich?",
    ],
    ["maximal 6 Memories", input({ recalled: mems(6) }), "Erzähl"],
    ["lange Nachricht", input(), "x".repeat(1000)],
  ];

  for (const [name, i, text] of cases) {
    it(`${name}: Prompt unverändert, Summe der Bereiche = Gesamtgröße`, () => {
      const before = JSON.stringify(i);
      const { system, m } = measure(i, text);
      expect(system).toBe(buildSpeakSystemPrompt(i));
      expect(sumChars(m)).toBe(m.systemChars);
      expect(m.systemChars).toBe(system.length);
      expect(m.userInputChars).toBe(text.length);
      expect(m.sections.memories.entries).toBe(i.recalled.length);
      expect(JSON.stringify(i)).toBe(before);
    });
  }

  it("Metriken enthalten nur Zahlen, keine Texte", () => {
    const { m } = measure(input({ recalled: ["GEHEIM Inhalt"], context: "Benutzer: GEHEIM" }));
    const json = JSON.stringify(m);
    expect(json).not.toContain("GEHEIM");
    for (const s of Object.values(m.sections)) {
      expect(typeof s.chars).toBe("number");
    }
  });

  it("8 Verlaufseinträge: Zähler korrekt, Fenster unverändert", () => {
    const msgs = Array.from({ length: 10 }, (_, k) => ({
      role: (k % 2 === 0 ? "user" : "orb") as "user" | "orb",
      body: "y".repeat(300),
    }));
    const win = contextWindow(msgs);
    const formatted = formatConversationContext(win);
    const c = countConversation(win, formatted);
    expect(c.messages).toBe(8);
    expect(c.userMessages).toBe(4);
    expect(c.orbMessages).toBe(4);
    expect(c.historyChars).toBe(formatted!.length);
    const { m } = measure(input({ context: formatted }));
    expect(m.sections.history.chars).toBeGreaterThanOrEqual(formatted!.length);
    expect(contextWindow(msgs)).toEqual(win);
  });

  it("Zählen verändert Memory-Auswahl und Werte nicht", () => {
    const cands = Array.from({ length: 12 }, (_, k) => ({
      level: (["A", "B", "C"] as MemoryLevel[])[k % 3]!,
      score: k / 12,
      content: `Ich bin Eintrag ${k}.`,
      importance: 0.5,
      confidence: 0.9,
    }));
    const snap = JSON.stringify(cands);
    const a = selectByLevel(cands, 6);
    const counts = { afterLevels: a.length, afterEligibility: selectReliableMemories(a).length };
    const b = selectByLevel(cands, 6);
    expect(b).toEqual(a);
    expect(counts.afterLevels).toBe(6);
    expect(JSON.stringify(cands)).toBe(snap);
  });

  it("Messmodul ruft kein Modell auf (keine Provider-/Netz-Importe)", () => {
    const src = readFileSync("src/orb-core/llm/prompt-metrics.ts", "utf8");
    const imports = src.match(/^import .*$/gm) ?? [];
    expect(imports.every((l) => l.startsWith("import type"))).toBe(true);
    expect(src).not.toMatch(/fetch\(|generateReply|provider/);
  });
});
