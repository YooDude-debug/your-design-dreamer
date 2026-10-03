/**
 * ORB Core – Conversation Logic Audit (2026-10-03).
 * Reproduziert die Fehlerfälle des Gesprächs nach dem Reset an den echten
 * Funktionen und Gates (keine Mock-Antworten).
 */
import { describe, expect, it } from "vitest";
import {
  decideConversationMode,
  isShortReply,
  pendingOrbQuestion,
  type ConversationInput,
} from "@/orb-core/conversation";
import { isOccupationStatement, semanticTopicOf, topicsOf } from "@/orb-core/memory";
import { deriveKnowledgeGaps } from "@/orb-core/curiosity";
import { decideImpulse } from "@/orb-core/impulse";
import { isCorrection } from "@/orb-core/eligibility";
import { buildSpeakSystemPrompt, replyBindingHint } from "@/orb-core/llm/prompt.server";
import type { DetectedGap } from "@/orb-core/gaps";

const LATENCY_Q =
  "Ich bin mir nicht sicher, aber ich meine, du hattest Y-Dude mit ORB Core integriert. Meinst du, dass die niedrigere Latenz nach dem Aufwärmen durch Caching oder persistente Serverprozesse entsteht?";

const base = (over: Partial<ConversationInput> = {}): ConversationInput => ({
  text: "Ja",
  conversationTopics: [],
  strands: [],
  curiosity: 0.99,
  energy: 0.7,
  contextMessages: 8,
  resumeThread: null,
  impulseAllowed: false,
  explicitLearning: false,
  ...over,
});

const state = { curiosity: 0.9, joy: 1, fear: 0, trust: 1, uncertainty: 0.6, energy: 0.7 };

describe("A/P0 – Kurzantwort auf offene ORB-Frage", () => {
  const pending = pendingOrbQuestion([
    { role: "user", body: "Komplett. Wenn das Backend warm wird sinkt die Latenz" },
    { role: "orb", body: LATENCY_Q },
  ]);

  it("letzte ORB-Frage wird erkannt", () => {
    expect(pending).toContain("Caching oder persistente Serverprozesse");
    expect(pendingOrbQuestion([{ role: "orb", body: "Ich höre zu." }])).toBeNull();
    expect(pendingOrbQuestion([{ role: "orb", body: "A?" }, { role: "user", body: "x" }])).toBeNull();
  });

  it("1. Offene Frage → „Ja“ → kein LISTEN, inhaltlicher Anschluss", () => {
    expect(decideConversationMode(base()).mode).toBe("LISTEN"); // Vorher-Verhalten
    const plan = decideConversationMode(base({ pendingQuestion: pending }));
    expect(plan.mode).toBe("DIRECT_ANSWER");
  });

  it("2. Offene Frage → „Nein“ → ebenfalls gebunden", () => {
    expect(decideConversationMode(base({ text: "Nein", pendingQuestion: pending })).mode).toBe(
      "DIRECT_ANSWER",
    );
  });

  it("Kurzantwort-Erkennung: knapp ja, lang/Frage nein", () => {
    for (const t of ["Ja", "nein", "Genau.", "Stimmt", "Alle 3 Punkte von dir genannt", "Beides"])
      expect(isShortReply(t), t).toBe(true);
    for (const t of ["Ja?", "Ich war heute arbeiten", "Ja und dann habe ich noch sehr viel mehr erzählt"])
      expect(isShortReply(t), t).toBe(false);
  });

  it("Prompt bindet die Antwort an genau diese Frage; ohne Bezug unverändert", () => {
    const hint = replyBindingHint(pending);
    expect(hint).toContain("Caching");
    expect(hint).toContain("Wiederhole keine bereits gemachten Vorschläge");
    expect(replyBindingHint(null)).toBe("");
    const p = { text: "Ja", state, goals: [], decision: "answer", recalled: [], interests: [] };
    expect(buildSpeakSystemPrompt({ ...p, replyTo: null })).toBe(buildSpeakSystemPrompt(p));
    expect(buildSpeakSystemPrompt({ ...p, replyTo: pending })).toContain(hint);
  });

  it("6. mehrere bestätigte Probleme → Fortschritt statt Wiederholung verlangt", () => {
    const q = "Was fehlt dir im Moment am meisten: Nutzer, Einnahmen oder ein klarer nächster Schritt?";
    expect(isShortReply("Alle 3 Punkte von dir genannt")).toBe(true);
    expect(replyBindingHint(q)).toMatch(/Priorisierung|konkreten nächsten Schritt/);
  });

  it("7. unbelegte Ursache → nur als Möglichkeit", () => {
    expect(replyBindingHint("Warum?x?")).toContain("als Möglichkeit, nicht als Tatsache");
  });
});

describe("B/P1 – Themenbildung", () => {
  it("„Backend“ ist nicht „backen“ (Essen) – bewiesene Ursache", () => {
    const t = "Komplett. Wenn das Backend und Server warm werden sinkt sogar die Latenz";
    expect(semanticTopicOf(t)).toBe("programmierung");
    expect(topicsOf(t)).not.toContain("essen");
    expect(
      semanticTopicOf(
        "Mario integrierte Y-Dude als technische Grundlage in ORB Core, weil dessen Backend bereits vorhanden war.",
      ),
    ).not.toBe("essen");
    expect(semanticTopicOf("Ich backe gerne Brot und backen macht Spaß")).toBe("essen");
  });

  it("4. Beruf Koch ≠ Interesse an Essen", () => {
    expect(isOccupationStatement("Mario ist Koch.")).toBe(true);
    expect(semanticTopicOf("Mario ist Koch.")).toBeNull();
    expect(semanticTopicOf("Das bin ich gewesen und bin Koch")).toBeNull();
    expect(semanticTopicOf("Ich koche gerne Pasta")).toBe("essen");
    const gaps = deriveKnowledgeGaps({
      memories: [
        {
          id: "fe3db3bb",
          content: "Mario ist Koch.",
          topic: "essen", // bestehender Altwert bleibt gespeichert
          importance: 0.7,
          confidence: 0.9,
          activationCount: 1,
          lastAccessedAt: Date.now(),
        },
      ],
      interests: [],
      asked: [],
      conversationTopics: ["essen"],
      curiosity: 0.9,
      now: Date.now(),
    });
    expect(gaps).toEqual([]);
  });

  it("Name bleibt keine Berufsangabe-Ausnahme verletzend", () => {
    expect(isOccupationStatement("Mario ist der richtige Name des Benutzers.")).toBe(false);
  });
});

describe("C/P1 – autonome Impulse", () => {
  const now = Date.now();
  const gap = (over: Partial<DetectedGap> = {}): DetectedGap =>
    ({
      id: "g1",
      type: "repeated_topic",
      form: "observation",
      topic: "essen",
      relatedNodes: ["n1"],
      importance: 0.8,
      confidence: 0.9,
      futureRelevance: 0.8,
      suggestedQuestion: "Das Thema „essen“ taucht mehrfach auf.",
      reason: "Thema wiederholt.",
      expiresAt: now + 3_600_000,
      ...over,
    }) as DetectedGap;
  const input = (over: Record<string, unknown> = {}) => ({
    gaps: [gap()],
    curiosity: 0.99,
    conversationTopics: ["programmierung"],
    recentUserTexts: [],
    previousImpulses: [],
    knownAnswers: [],
    lastImpulseAt: null,
    now,
    ...over,
  });

  it("3. Thema KI-Architektur → keine Essen-Beobachtung", () => {
    expect(decideImpulse(input()).action).toBe("STAY_SILENT");
  });

  it("Beobachtung bleibt erlaubt, wenn das Thema im Gespräch ist", () => {
    expect(decideImpulse(input({ conversationTopics: ["essen"] })).action).toBe("SPEAK");
  });

  it("9. gleiche Themen-Lücke in anderer Formulierung → gesperrt", () => {
    const d = decideImpulse(
      input({
        conversationTopics: ["gaming"],
        gaps: [gap({ topic: "gaming", relatedNodes: ["neu"], suggestedQuestion: "Gaming taucht oft auf." })],
        recentlyAskedTopics: new Set(["gaming"]),
      }),
    );
    expect(d.action).toBe("STAY_SILENT");
  });

  it("8. Impuls während offener Frage → zurückgestellt", () => {
    const d = decideImpulse(input({ conversationTopics: ["essen"], openQuestion: true }));
    expect(d.action).toBe("STAY_SILENT");
    expect(d.reason).toMatch(/offen/);
  });
});

describe("5. Korrektur", () => {
  it("Korrektur einer falschen Annahme wird erkannt", () => {
    expect(isCorrection("Nein, das stimmt nicht, ich bin Koch")).toBe(true);
  });
});
