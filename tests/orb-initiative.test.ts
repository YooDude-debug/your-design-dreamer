import { describe, expect, it } from "vitest";

import {
  categoriesOf,
  categoryAsGap,
  classifyAutonomousQuestion,
  decideFollowUp,
  deriveCategoryCandidates,
  followUpAsGap,
  followUpText,
  type FollowUpQuestionRow,
} from "@/orb-core/initiative";
import { decideCuriosity, deriveKnowledgeGaps, type KnowledgeGap } from "@/orb-core/curiosity";
import { finalAutonomyGate } from "@/orb-core/autonomy";
import { decideImpulse } from "@/orb-core/impulse";
import { topicsOf } from "@/orb-core/memory";
import type { ProactiveMemory } from "@/orb-core/presence";

const NOW = Date.parse("2026-09-27T12:00:00Z");
const WINDOW = 30 * 60_000;

const mem = (over: Partial<ProactiveMemory> = {}): ProactiveMemory => ({
  id: "n1",
  content: "Ich spiele gerne Fortnite.",
  topic: "fortnite",
  importance: 0.8,
  confidence: 0.9,
  activationCount: 2,
  lastAccessedAt: NOW - 60_000,
  ...over,
});

const noImpulse = decideImpulse({
  gaps: [],
  curiosity: 0.8,
  conversationTopics: [],
  recentUserTexts: [],
  previousImpulses: [],
  knownAnswers: [],
  openQuestion: false,
  lastImpulseAt: null,
  now: NOW,
});

const gate = (gap: KnowledgeGap, energy = 0.8, curiosity = 0.8) => {
  const decision = decideCuriosity({
    curiosity,
    energy,
    gaps: [gap],
    lastQuestionAt: null,
    openQuestion: false,
    now: NOW,
  });
  return finalAutonomyGate({ energy, curiosity: decision, impulse: noImpulse });
};

const row = (over: Partial<FollowUpQuestionRow> = {}): FollowUpQuestionRow => ({
  id: "q1",
  question: "Spielst du außer Fortnite noch andere Games?",
  topic: "gaming",
  gap_kind: "category:gaming",
  knowledge_gap: "Kategorie Gaming",
  answered: false,
  asked_at: new Date(NOW - 2 * WINDOW).toISOString(),
  score: 0.4,
  source_memory_ids: ["n1"],
  ...over,
});

const msgs = (...userAfter: string[]) => [
  ...userAfter.map((body) => ({ role: "user", body })),
  { role: "orb", body: "Spielst du außer Fortnite noch andere Games?" },
];

describe("Category-Curiosity", () => {
  it("A. relevante Gap gewinnt (Kategorie-Pfad nur bei no_candidate)", () => {
    const gaps = deriveKnowledgeGaps({
      memories: [mem()],
      interests: [],
      asked: [],
      conversationTopics: ["fortnite"],
      curiosity: 0.8,
      now: NOW,
    });
    const decision = decideCuriosity({
      curiosity: 0.8,
      energy: 0.8,
      gaps,
      lastQuestionAt: null,
      openQuestion: false,
      now: NOW,
    });
    const g = finalAutonomyGate({ energy: 0.8, curiosity: decision, impulse: noImpulse });
    expect(g.allowed).toBe(true);
    expect(g.gate).not.toBe("no_candidate");
  });

  it("B. Gaming-Kategorie kann unter dem Gate fragen", () => {
    const [c] = deriveCategoryCandidates({
      memories: [mem()],
      askedKinds: [],
      conversationTopics: [],
      curiosity: 0.8,
      now: NOW,
    });
    expect(c?.category).toBe("gaming");
    expect(gate(categoryAsGap(c!)).allowed).toBe(true);
    // Energie-Gate bleibt wirksam
    expect(gate(categoryAsGap(c!), 0.05).allowed).toBe(false);
  });

  it("C. keine geeignete Kategorie → keine Frage", () => {
    expect(
      deriveCategoryCandidates({
        memories: [mem({ content: "Der Himmel ist blau.", topic: "himmel" })],
        askedKinds: [],
        conversationTopics: [],
        curiosity: 0.8,
        now: NOW,
      }),
    ).toEqual([]);
  });

  it("sensible Inhalte werden nie Kategorie", () => {
    expect(categoriesOf("Ich arbeite trotz Krankheit, Diagnose steht aus")).toEqual([]);
  });

  it("D. bereits genutzte Kategorie wird nicht erneut abgefragt; Bekanntes wird mitgeführt", () => {
    const c = deriveCategoryCandidates({
      memories: [mem()],
      askedKinds: ["category:gaming"],
      conversationTopics: [],
      curiosity: 0.8,
      now: NOW,
    });
    expect(c).toEqual([]);
    const [k] = deriveCategoryCandidates({
      memories: [mem()],
      askedKinds: [],
      conversationTopics: [],
      curiosity: 0.8,
      now: NOW,
    });
    expect(k!.known).toContain("Ich spiele gerne Fortnite.");
  });

  it("E. Kategorie-Frage eindeutig unterscheidbar", () => {
    expect(classifyAutonomousQuestion("category:gaming")).toBe("category_curiosity");
    expect(classifyAutonomousQuestion("praeferenz")).toBe("gap_curiosity");
    expect(classifyAutonomousQuestion("follow_up")).toBe("follow_up");
  });

  it("K. normale kontextuelle Rückfrage ist keine autonome Frage", () => {
    expect(classifyAutonomousQuestion(null)).toBe("contextual");
  });
});

describe("Follow-up", () => {
  const base = { answerWindowMs: WINDOW, now: NOW, topicsOf };

  it("F. unbeantwortet → genau ein Follow-up möglich", () => {
    const d = decideFollowUp({ ...base, questions: [row()], recentMessages: msgs("hm ok") });
    expect(d.eligible).toBe(true);
    expect(followUpText(row().question)).toContain(row().question);
    expect(gate(followUpAsGap(row())).allowed).toBe(true);
  });

  it("G. beantwortet → kein Follow-up", () => {
    const d = decideFollowUp({
      ...base,
      questions: [row({ answered: true })],
      recentMessages: msgs("Ja, Minecraft"),
    });
    expect(d.eligible).toBe(false);
  });

  it("H. ausdrückliche Ablehnung → kein Follow-up", () => {
    const d = decideFollowUp({
      ...base,
      questions: [row()],
      recentMessages: msgs("Das will ich nicht beantworten"),
    });
    expect(d.eligible).toBe(false);
  });

  it("I. Themawechsel → nicht sofort nachhaken", () => {
    const d = decideFollowUp({
      ...base,
      questions: [row()],
      recentMessages: msgs("Mein Urlaub in Spanien war super"),
    });
    expect(d.eligible).toBe(false);
  });

  it("J. Follow-up bereits gesendet → kein weiteres", () => {
    const fu = row({ id: "q2", gap_kind: "follow_up", knowledge_gap: "follow_up:q1" });
    expect(
      decideFollowUp({ ...base, questions: [fu, row()], recentMessages: msgs("hm") }).eligible,
    ).toBe(false);
    // Auch wenn später eine andere Frage neuer ist, wird q1 nicht mehr verfolgt.
    expect(
      decideFollowUp({ ...base, questions: [row(), fu], recentMessages: msgs("hm") }).eligible,
    ).toBe(false);
  });

  it("kein Follow-up im laufenden Antwortfenster oder ohne weitere Nachricht", () => {
    expect(
      decideFollowUp({
        ...base,
        questions: [row({ asked_at: new Date(NOW - 60_000).toISOString() })],
        recentMessages: msgs("hm"),
      }).eligible,
    ).toBe(false);
    expect(decideFollowUp({ ...base, questions: [row()], recentMessages: msgs() }).eligible).toBe(
      false,
    );
  });
});

describe("L. bestehendes Verhalten unverändert", () => {
  it("Gap-Erkennung ignoriert Kategorie-Provenienz nicht als beantwortet", () => {
    const gaps = deriveKnowledgeGaps({
      memories: [mem()],
      interests: [],
      asked: [],
      conversationTopics: [],
      curiosity: 0.8,
      now: NOW,
    });
    expect(gaps.length).toBeGreaterThan(0);
  });
});
