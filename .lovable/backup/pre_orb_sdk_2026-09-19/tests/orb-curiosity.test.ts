/**
 * ORB Core – Curiosity Core: reine Logik (keine Datenbank, kein Netzwerk).
 *
 * Geprüft wird, dass ORB nur fragt, wenn er einen benennbaren inneren Grund
 * hat, und dass eine Aufforderung („frag mich“) diese Prüfung nicht umgeht.
 */

import { describe, expect, it } from "vitest";

import {
  CURIOSITY_ASK_THRESHOLD,
  CURIOSITY_MIN_ENERGY,
  CURIOSITY_SOCIAL_ACTIONS_ENABLED,
  CURIOSITY_SCOPE,
  curiosityScore,
  decideCuriosity,
  deriveKnowledgeGaps,
  gapKindsFor,
  isAskMeRequest,
  isDuplicateQuestion,
  type KnowledgeGap,
} from "@/lib/orb-curiosity";
import { PROACTIVE_COOLDOWN_MS } from "@/lib/orb-presence";

const NOW = Date.UTC(2026, 8, 20, 12, 0, 0);

function memory(over: Partial<Parameters<typeof deriveKnowledgeGaps>[0]["memories"][number]> = {}) {
  return {
    id: "n1",
    content: "Ich mag Grafikkarten mit viel VRAM",
    topic: "hardware",
    importance: 0.8,
    confidence: 0.9,
    activationCount: 3,
    lastAccessedAt: NOW - 60_000,
    ...over,
  };
}

function gaps(
  over: Parameters<typeof deriveKnowledgeGaps>[0]["memories"] = [memory()],
  extra: Partial<Parameters<typeof deriveKnowledgeGaps>[0]> = {},
): KnowledgeGap[] {
  return deriveKnowledgeGaps({
    memories: over,
    interests: [
      {
        topic: "hardware",
        weight: 0.7,
        confidence: 0.8,
        source: "user_stated",
        activationCount: 4,
      },
    ],
    asked: [],
    conversationTopics: [],
    curiosity: 0.7,
    now: NOW,
    ...extra,
  });
}

describe("ORB Curiosity Core – Wissenslücken", () => {
  it("1. erkennt ohne Erinnerungen keine Wissenslücke", () => {
    expect(gaps([])).toHaveLength(0);
  });

  it("2. bildet aus einer Vorliebe die Lücke „Grund“", () => {
    expect(gaps()[0]?.kind).toBe("grund");
  });

  it("3. bildet aus einem Vorhaben die Lücke „Stand“", () => {
    const list = gaps([memory({ content: "Ich möchte eine neue Grafikkarte kaufen" })]);
    expect(list.some((g) => g.kind === "stand")).toBe(true);
  });

  it("4. bildet aus einer Erfahrung die Lücke „Erfahrung“", () => {
    const list = gaps([memory({ content: "Ich habe die Karte gestern getestet" })]);
    expect(list.some((g) => g.kind === "erfahrung")).toBe(true);
  });

  it("5. hat für jede Erinnerung eine Ausweichlücke (Detail/Kontext)", () => {
    expect(gapKindsFor("Etwas Konkretes ohne Muster")).toEqual(["detail", "kontext"]);
  });

  it("6. ignoriert Erinnerungen ohne Thema", () => {
    expect(gaps([memory({ topic: null })])).toHaveLength(0);
  });

  it("7. ignoriert unsichere Erinnerungen", () => {
    expect(gaps([memory({ confidence: 0.2 })])).toHaveLength(0);
  });

  it("8. ignoriert inhaltsleere Erinnerungen", () => {
    expect(gaps([memory({ content: "und und" })])).toHaveLength(0);
  });

  it("9. schliesst eine beantwortete Lücke dauerhaft aus", () => {
    const list = gaps([memory()], {
      asked: [
        { nodeId: "n1", topic: "hardware", kind: "grund", question: "Warum?", answered: true },
      ],
    });
    expect(list.some((g) => g.kind === "grund")).toBe(false);
  });

  it("10. stellt eine bereits gestellte Lücke nicht erneut", () => {
    const list = gaps([memory()], {
      asked: [
        { nodeId: "n1", topic: "hardware", kind: "grund", question: "Warum?", answered: false },
      ],
    });
    expect(list.some((g) => g.kind === "grund")).toBe(false);
    expect(list.length).toBeGreaterThan(0);
  });

  it("11. bewertet eine Lücke zum laufenden Gesprächsthema höher", () => {
    const inTalk = gaps([memory()], { conversationTopics: ["hardware"] })[0]!;
    const offTalk = gaps([memory()])[0]!;
    expect(inTalk.score).toBeGreaterThan(offTalk.score);
  });

  it("12. sortiert die stärkste Lücke nach vorn", () => {
    const list = gaps();
    expect(list[0]!.score).toBeGreaterThanOrEqual(list[list.length - 1]!.score);
  });
});

describe("ORB Curiosity Core – Neugier-Wert", () => {
  it("13. sinkt mit der Neugier des Innenzustands", () => {
    const base = {
      relevance: 0.8,
      importance: 0.8,
      confidence: 0.9,
      conversationalFit: 1,
      novelty: 1,
    };
    expect(curiosityScore({ ...base, curiosity: 0.8 })).toBeGreaterThan(
      curiosityScore({ ...base, curiosity: 0.4 }),
    );
  });

  it("14. sinkt bei bereits gestellten Fragen (geringere Neuheit)", () => {
    const base = {
      curiosity: 0.7,
      relevance: 0.8,
      importance: 0.8,
      confidence: 0.9,
      conversationalFit: 1,
    };
    expect(curiosityScore({ ...base, novelty: 1 })).toBeGreaterThan(
      curiosityScore({ ...base, novelty: 0.4 }),
    );
  });

  it("15. bleibt im Bereich 0..1", () => {
    const value = curiosityScore({
      curiosity: 2,
      relevance: 2,
      importance: 2,
      confidence: 2,
      conversationalFit: 2,
      novelty: 2,
    });
    expect(value).toBeLessThanOrEqual(1);
    expect(value).toBeGreaterThanOrEqual(0);
  });
});

describe("ORB Curiosity Core – Entscheidung", () => {
  const base = { curiosity: 0.7, energy: 0.8, lastQuestionAt: null, now: NOW };

  it("16. tut ohne Wissenslücke nichts", () => {
    const d = decideCuriosity({ ...base, gaps: [] });
    expect(d.action).toBe("DO_NOTHING");
    expect(d.reason).toContain("Wissenslücke");
  });

  it("17. tut bei geringer Neugier nichts", () => {
    const d = decideCuriosity({ ...base, curiosity: 0.2, gaps: gaps() });
    expect(d.action).toBe("DO_NOTHING");
  });

  it("18. wartet bei zu geringer Energie", () => {
    const d = decideCuriosity({ ...base, energy: CURIOSITY_MIN_ENERGY - 0.01, gaps: gaps() });
    expect(d.action).toBe("WAIT");
  });

  it("19. wartet, solange eine eigene Frage offen ist", () => {
    const d = decideCuriosity({ ...base, gaps: gaps(), openQuestion: true });
    expect(d.action).toBe("WAIT");
  });

  it("20. wartet während des Cooldowns", () => {
    const d = decideCuriosity({
      ...base,
      gaps: gaps(),
      lastQuestionAt: NOW - (PROACTIVE_COOLDOWN_MS.high - 1000),
    });
    expect(d.action).toBe("WAIT");
    expect(d.reason).toContain("Cooldown");
  });

  it("21. wartet, wenn der Neugier-Wert unter der Schwelle liegt", () => {
    const weak = gaps([memory({ importance: 0.3, lastAccessedAt: NOW - 40 * 86_400_000 })]);
    const d = decideCuriosity({ ...base, curiosity: 0.4, gaps: weak });
    expect(d.action).toBe("WAIT");
    expect(d.score).toBeLessThan(CURIOSITY_ASK_THRESHOLD);
  });

  it("22. fragt bei starker, neuer Wissenslücke", () => {
    const d = decideCuriosity({ ...base, curiosity: 0.9, gaps: gaps() });
    expect(d.action).toBe("ASK");
    expect(d.gap?.topic).toBe("hardware");
    expect(d.score).toBeGreaterThanOrEqual(CURIOSITY_ASK_THRESHOLD);
  });

  it("23. begründet jede Entscheidung benennbar", () => {
    for (const d of [
      decideCuriosity({ ...base, gaps: [] }),
      decideCuriosity({ ...base, gaps: gaps(), openQuestion: true }),
      decideCuriosity({ ...base, curiosity: 0.9, gaps: gaps() }),
    ]) {
      expect(d.reason.length).toBeGreaterThan(5);
    }
  });
});

describe("ORB Curiosity Core – Duplikate, Aufforderung, Grenzen", () => {
  it("24. erkennt eine nahezu gleiche Frage als Duplikat", () => {
    expect(isDuplicateQuestion("Warum magst du viel VRAM?", ["Warum magst du viel VRAM?"])).toBe(
      true,
    );
  });

  it("25. lässt eine inhaltlich andere Frage zu", () => {
    expect(isDuplicateQuestion("Welche Auflösung spielst du?", ["Warum magst du viel VRAM?"])).toBe(
      false,
    );
  });

  it("26. erkennt die ausdrückliche Aufforderung", () => {
    expect(isAskMeRequest("Frag mich etwas")).toBe(true);
    expect(isAskMeRequest("Stelle mir eine Frage")).toBe(true);
    expect(isAskMeRequest("Ich habe eine neue Karte")).toBe(false);
  });

  it("27. die Aufforderung umgeht die innere Prüfung nicht", () => {
    // Gleiche Entscheidungslogik, unabhängig davon, wer sie ausgelöst hat.
    const d = decideCuriosity({
      curiosity: 0.7,
      energy: 0.8,
      gaps: [],
      lastQuestionAt: null,
      now: NOW,
    });
    expect(d.action).toBe("DO_NOTHING");
  });

  it("28. wirkt ausschliesslich im ORB-Core-Chat, ohne soziale Aktionen", () => {
    expect(CURIOSITY_SCOPE).toBe("orb_core_chat_only");
    expect(CURIOSITY_SOCIAL_ACTIONS_ENABLED).toBe(false);
  });
});
