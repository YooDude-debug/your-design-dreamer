/**
 * ORB Core – P6: Klassifikation (Backend ≠ backen, Beruf ≠ Interesse) und
 * Gesprächskontinuität bei Kurzantworten. Echte Funktionen, keine Mocks.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  decideConversationMode,
  isShortReply,
  pendingOrbQuestion,
  type ConversationInput,
} from "@/orb-core/conversation";
import { isOccupationStatement, semanticTopicOf } from "@/orb-core/memory";
import { QUESTION_MEMORY_LOCK_MS } from "@/orb-core/curiosity";
import { decideImpulse } from "@/orb-core/impulse";
import type { DetectedGap } from "@/orb-core/gaps";

describe("P6 Klassifikation", () => {
  it("Backend wird nie als Essen erkannt", () => {
    for (const t of [
      "Komplett. Wenn das Backend und Server warm werden sinkt sogar die Latenz",
      "Ich habe Y-Dude genommen, weil das Backend schon da ist",
      "Das Backend ist schnell",
    ]) {
      expect(semanticTopicOf(t)).not.toBe("essen");
    }
    expect(semanticTopicOf("Das Backend ist schnell")).toBe("programmierung");
  });

  it("echtes Backen wird als Essen erkannt", () => {
    expect(semanticTopicOf("Ich backe gerne Pizza")).toBe("essen");
    expect(semanticTopicOf("Ich habe heute einen Kuchen gebacken")).toBe("essen");
    expect(semanticTopicOf("Am Wochenende backen wir Brot")).toBe("essen");
  });

  it("Softwareentwicklung ist Programmierung", () => {
    expect(semanticTopicOf("Ich arbeite in der Softwareentwicklung")).toBe("programmierung");
  });

  it("Koch als Beruf wird kein Thema", () => {
    expect(isOccupationStatement("Mario ist Koch.")).toBe(true);
    expect(semanticTopicOf("Mario ist Koch.")).toBeNull();
    expect(semanticTopicOf("Das bin ich gewesen und bin Koch")).toBeNull();
  });

  it("tatsächliche Gespräche über Essen bleiben Essen", () => {
    expect(semanticTopicOf("Ich esse gerne griechisches Essen")).toBe("essen");
    expect(semanticTopicOf("Ich bin Koch und koche gern Pasta")).toBe("essen");
  });

  it("mehrdeutige oder unbekannte Begriffe ⇒ unbekannt statt erzwungen", () => {
    expect(semanticTopicOf("Das ist die Essenz der Sache")).toBeNull();
    expect(semanticTopicOf("Das ist essentiell")).toBeNull();
    expect(semanticTopicOf("Der Plan ist gerichtet")).toBeNull();
    expect(semanticTopicOf("wenn")).toBeNull();
  });
});

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

describe("P6 Kurzantworten", () => {
  const q = pendingOrbQuestion([
    { role: "user", body: "Die Latenz sinkt." },
    { role: "orb", body: "Liegt das am Caching?" },
  ]);

  it.each(["Ja", "Nein", "Genau", "Alle drei"])("Frage → %s wird gebunden", (text) => {
    expect(isShortReply(text)).toBe(true);
    expect(decideConversationMode(base({ text, pendingQuestion: q })).mode).toBe("DIRECT_ANSWER");
  });

  it("nach Themenwechsel (Nutzer schrieb dazwischen) keine Bindung an alte Frage", () => {
    expect(
      pendingOrbQuestion([
        { role: "orb", body: "Liegt das am Caching?" },
        { role: "user", body: "Anderes Thema: mein Auto." },
        { role: "orb", body: "Verstanden, dein Auto." },
      ]),
    ).toBeNull();
  });

  it("bereits beantwortete Frage ist geschlossen", () => {
    expect(
      pendingOrbQuestion([
        { role: "orb", body: "Liegt das am Caching?" },
        { role: "user", body: "Ja" },
      ]),
    ).toBeNull();
  });

  it("mehrere Fragen hintereinander ⇒ nur die zuletzt gestellte", () => {
    expect(
      pendingOrbQuestion([
        { role: "orb", body: "Erste Frage?" },
        { role: "user", body: "Ja" },
        { role: "orb", body: "Gut. Ist es A? Oder eher B?" },
      ]),
    ).toBe("Oder eher B?");
  });
});

const gap = (over: Partial<DetectedGap> = {}): DetectedGap => ({
  id: "g",
  type: "repeated_topic",
  importance: 0.8,
  confidence: 0.8,
  relatedNodes: ["m1"],
  reason: "r",
  suggestedQuestion: "Essen taucht mehrfach auf.",
  form: "observation",
  topic: "essen",
  expiresAt: Date.now() + 1e9,
  futureRelevance: 0.8,
  ...over,
});

describe("P6 autonome Nachfrage", () => {
  const input = (over = {}) => ({
    gaps: [gap()],
    conversationTopics: [] as string[],
    lastImpulseAt: null,
    now: Date.now(),
    ...over,
  });

  it("Interesse ohne Gesprächsbezug wird kein Gesprächsthema", () => {
    expect(decideImpulse(input()).action).toBe("STAY_SILENT");
  });

  it("Themensperre über verschiedene Memory-IDs", () => {
    const d = decideImpulse(
      input({
        conversationTopics: ["essen"],
        gaps: [gap({ relatedNodes: ["m2"] })],
        recentlyAskedTopics: new Set(["essen"]),
      }),
    );
    expect(d.action).toBe("STAY_SILENT");
  });

  it("offene Frage blockiert neue autonome Nachfrage", () => {
    expect(decideImpulse(input({ conversationTopics: ["essen"], openQuestion: true })).action).toBe(
      "STAY_SILENT",
    );
  });

  it("7-Tage-Frist unverändert", () => {
    expect(QUESTION_MEMORY_LOCK_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("Kontext bleibt an Benutzer + Bereich gebunden, Reihenfolge deterministisch", () => {
    const eng = readFileSync("src/orb-core/engine.server.ts", "utf8");
    expect(eng).toContain("openQuestion: ctx.openQuestion !== null || ctx.openDialog");
    const i = eng.indexOf('.select("body, role")');
    const chunk = eng.slice(i, i + 300);
    expect(chunk).toContain('.eq("user_id", userId)');
    expect(chunk).toContain('.order("id", { ascending: false })');
  });
});
