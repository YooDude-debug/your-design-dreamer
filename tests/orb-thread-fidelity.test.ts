/**
 * P7 – Regression für die drei realen Fehlerfälle vom 03.10.2026 und die
 * unveränderten Autonomie-, Energie- und Fragepfade.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CURIOSITY_ASK_THRESHOLD,
  CURIOSITY_MIN_ENERGY,
  QUESTION_MEMORY_LOCK_MS,
  checkQuestionFidelity,
  decideCuriosity,
  deriveKnowledgeGaps,
  isIdentityMemory,
  nameTokensFrom,
} from "@/orb-core/curiosity";
import { AUTONOMY_MIN_ENERGY } from "@/orb-core/autonomy";
import { isSemanticTopic, semanticTopicOf, topicOf } from "@/orb-core/memory";
import { isReferentlessClosure } from "@/orb-core/prompt-memory-filter";
import { buildSpeakSystemPrompt, imageStateHint } from "@/orb-core/llm/prompt.server";
import { userSignalsFrom, validateCandidate } from "@/orb-core/analysis/validate";
import type { ProactiveMemory } from "@/orb-core/presence";

const NOW = Date.parse("2026-10-03T06:31:00Z");
const mem = (over: Partial<ProactiveMemory>): ProactiveMemory => ({
  id: "x",
  content: "",
  topic: null,
  importance: 0.8,
  confidence: 0.95,
  activationCount: 9,
  lastAccessedAt: NOW - 18 * 3_600_000,
  ...over,
});

const NAME = mem({
  id: "0d1d839f",
  content: "Mario ist der richtige Name des Benutzers.",
  topic: "mario",
  confidence: 1,
});
const ORB_TECH = mem({
  id: "f06765db",
  content: "Mario interessiert sich für die technische Funktionsweise von ORB Core.",
  topic: "ki",
  importance: 0.8,
  confidence: 0.9,
  activationCount: 22,
});
const userKiTurn = "Was können KI heute nicht und was könnten sie tun, damit sie einzigartig sind?";

describe("P1 Themenbildung", () => {
  it("Eigenname/Einzelwort ⇒ unbekannt; Schlüsselwort ⇒ Thema", () => {
    expect(semanticTopicOf("Mario möchte eine kompakte Übersicht.")).toBeNull();
    expect(semanticTopicOf("wenn ich ein Projekt starte")).toBeNull();
    expect(semanticTopicOf("Ich spiele gerne Fortnite und andere Spiele")).toBe("gaming");
    expect(isSemanticTopic("mario")).toBe(false);
    expect(isSemanticTopic("gaming")).toBe(true);
  });
  it("Abruf-Thema (topicOf) bleibt unverändert", () => {
    expect(topicOf("Mario möchte eine kompakte Übersicht.")).toBe("mario");
  });
  it("Name wird aus Identitätsangabe erkannt", () => {
    expect(isIdentityMemory(NAME.content)).toBe(true);
    expect(isIdentityMemory(ORB_TECH.content)).toBe(false);
    expect(nameTokensFrom([NAME.content, "Ich heiße Lena."])).toEqual(["lena", "mario"]);
  });
  it("Speicherpfade nutzen semanticTopicOf, Interessen nur mit Beleg", () => {
    const engine = readFileSync("src/orb-core/engine.server.ts", "utf8");
    const apply = readFileSync("src/orb-core/analysis/apply.server.ts", "utf8");
    expect(engine).toContain("if (!isSemanticTopic(topic)) return;");
    expect(engine).toContain("topic: semanticTopicOf(resolvedContextFact ? memoryText : text),");
    expect(apply).not.toMatch(/topic: topicOf\(/);
  });
});

describe("Fehlerfall A / P2 Gesprächsrelevanz", () => {
  const base = {
    interests: [
      { topic: "mario", weight: 1, confidence: 0.9 },
      { topic: "ki", weight: 0.78, confidence: 0.9 },
    ] as never,
    asked: [],
    curiosity: 1,
    now: NOW,
  };
  it("Name-Erinnerung erzeugt keine Lücke; passender Kandidat gewinnt", () => {
    const gaps = deriveKnowledgeGaps({
      ...base,
      memories: [NAME, ORB_TECH],
      conversationTopics: ["ki", "mario"],
      userConversationTopics: ["ki"],
      anchorTopics: ["ki"],
      nameTokens: ["mario"],
    });
    expect(gaps.some((g) => g.nodeId === NAME.id)).toBe(false);
    expect(gaps[0]?.nodeId).toBe(ORB_TECH.id);
  });
  it("Bezug zur letzten Nutzernachricht schlägt höhere Erinnerungsstärke", () => {
    const strong = mem({ id: "a", content: "Ich spiele gerne Fortnite.", topic: "gaming" });
    const weak = mem({
      id: "b",
      content: "Ich finde künstliche Intelligenz spannend.",
      topic: "ki",
      importance: 0.4,
      activationCount: 1,
    });
    const gaps = deriveKnowledgeGaps({
      ...base,
      interests: [],
      memories: [strong, weak],
      conversationTopics: ["ki", "gaming"],
      anchorTopics: ["ki"],
    });
    expect(gaps[0]?.nodeId).toBe("b");
    expect(gaps[0]!.score).toBeLessThan(gaps.find((g) => g.nodeId === "a")!.score);
  });
  it("ohne passenden Kandidaten darf ORB weiterhin fragen (Fragelust unverändert)", () => {
    const gaps = deriveKnowledgeGaps({
      ...base,
      interests: [],
      memories: [mem({ id: "c", content: "Ich spiele gerne Fortnite.", topic: "gaming" })],
      conversationTopics: ["ki"],
      anchorTopics: ["ki"],
    });
    const d = decideCuriosity({
      curiosity: 1,
      energy: 0.5,
      gaps,
      lastQuestionAt: null,
      openQuestion: false,
      now: NOW,
    });
    expect(d.action).toBe("ASK");
  });
  it("Alt-Thema ohne Beleg zählt nur, wenn der Nutzer es selbst anspricht", () => {
    const legacy = mem({ id: "d", content: "Mario möchte Projekte im Graph.", topic: "mario" });
    const withName = { ...base, interests: [], memories: [legacy], nameTokens: ["mario"] };
    expect(deriveKnowledgeGaps({ ...withName, userConversationTopics: [] })).toEqual([]);
    const projekt = mem({ id: "e", content: "Projekte im Graph speichern.", topic: "projekt" });
    expect(
      deriveKnowledgeGaps({
        ...base,
        interests: [],
        memories: [projekt],
        userConversationTopics: ["projekt"],
      }).length,
    ).toBeGreaterThan(0);
    expect(
      deriveKnowledgeGaps({
        ...base,
        interests: [],
        memories: [projekt],
        userConversationTopics: [],
      }),
    ).toEqual([]);
  });
});

describe("Fehlerfall A / P3 Prüfung nach Formulierung", () => {
  it("„Mario-Spiel“ aus Name-Erinnerung wird verworfen", () => {
    const r = checkQuestionFidelity({
      question: "Welches konkrete Mario-Spiel magst du am liebsten?",
      memory: NAME.content,
      topic: "mario",
      nameTokens: ["mario"],
    });
    expect(r.ok).toBe(false);
  });
  it("„Thema Mario taucht mehrfach auf“ ohne Bezug wird verworfen", () => {
    expect(
      checkQuestionFidelity({
        question: "Das Thema „Mario“ taucht in den vorliegenden Angaben mehrfach auf.",
        memory: "Mario möchte, dass der Graph Bilder speichert.",
        topic: "mario",
        nameTokens: ["mario"],
      }).ok,
    ).toBe(false);
  });
  it("passende Frage bleibt erhalten", () => {
    expect(
      checkQuestionFidelity({
        question:
          "Welcher Teil der technischen Funktionsweise von ORB Core interessiert dich am meisten?",
        memory: ORB_TECH.content,
        topic: "ki",
        nameTokens: ["mario"],
      }).ok,
    ).toBe(true);
    expect(
      checkQuestionFidelity({
        question: "Welche Spiele spielst du außer Fortnite noch?",
        memory: "Ich spiele gerne Fortnite.",
        topic: "gaming",
      }).ok,
    ).toBe(true);
  });
  it("nur autonome Fragen werden geprüft, verworfen mit Gate fidelity", () => {
    const engine = readFileSync("src/orb-core/engine.server.ts", "utf8");
    expect(engine).toMatch(
      /if \(options\.explicit !== true\) \{\s+const fidelity = checkQuestionFidelity/,
    );
    expect(engine).toContain('{ gate: "fidelity" }');
  });
});

describe("Fehlerfall C / P4 Gesprächsanker", () => {
  it("Abschlussaussage ohne Bezug wird nicht in den Prompt gegeben", () => {
    expect(
      isReferentlessClosure(
        "Das Thema haben wir beendet. Wir konzentrieren uns auf andere Sachen.",
      ),
    ).toBe(true);
    expect(isReferentlessClosure("Mario hat das Projekt Fernweh beendet.")).toBe(false);
  });
  it("Eigene-Frage-Hinweis verlangt Bezug auf genau diese Frage", () => {
    const p = buildSpeakSystemPrompt({
      state: { curiosity: 1, joy: 1, fear: 0, trust: 1, uncertainty: 0, energy: 0.4 },
      goals: [],
      decision: "answer",
      recalled: [],
      interests: [],
      ownQuestion: { question: "Welches Spiel?", gap: "x" },
    });
    expect(p).toContain("nicht auf ein früheres oder bereits abgeschlossenes Thema");
  });
});

describe("Fehlerfall B / P5 Bildzustand", () => {
  const state = { curiosity: 1, joy: 1, fear: 0, trust: 1, uncertainty: 0, energy: 0.4 };
  it("ohne Bildbezug bleibt der Prompt byte-identisch", () => {
    const a = buildSpeakSystemPrompt({
      state,
      goals: [],
      decision: "answer",
      recalled: [],
      interests: [],
      visualHint: true,
    });
    const b = buildSpeakSystemPrompt({
      state,
      goals: [],
      decision: "answer",
      recalled: [],
      interests: [],
      visualHint: true,
      imageState: null,
    });
    expect(a).toBe(b);
  });
  it("kein Anhang ⇒ kein Bildzugriff, Bearbeitung nicht verfügbar, Erzeugung getrennt", () => {
    const h = imageStateHint({ attached: 0, generationAvailable: true });
    expect(h).toContain("kein Bild angehängt");
    expect(h).toContain("kein aktueller Bildzugriff");
    expect(h).toContain("Bildbearbeitung");
    expect(h).toContain("kannst du nicht");
    expect(h).toContain("Ein neues Bild erzeugen kannst du");
  });
  it("Anhang ⇒ nur dieses Bild sichtbar", () => {
    expect(imageStateHint({ attached: 1, generationAvailable: false })).toContain("ist 1 Bild");
  });
});

describe("P6 Provenienz", () => {
  const cand = (value: string) =>
    ({
      value,
      action: "create",
      category: "other",
      confidence: 0.9,
      relevance: 0.8,
      longTermValue: 0.9,
      temporalScope: "long_term",
      decayRate: 0.01,
      sourceReference: "",
    }) as never;
  it("Ableitung „bestätigt“ ohne Nutzerbestätigung wird abgelehnt", () => {
    const v = validateCandidate(
      cand("Mario hat ein Bild als sein tatsächliches Aussehen bestätigt."),
      [],
      userSignalsFrom(["das bin ich auf dem bild ok"].slice(1)),
    );
    expect(v.decision).toBe("rejected");
  });
  it("mit ausdrücklicher Bestätigung zulässig", () => {
    const v = validateCandidate(
      cand("Mario hat ein Bild als sein tatsächliches Aussehen bestätigt."),
      [],
      userSignalsFrom(["Ja, das bin wirklich ich auf dem Bild."]),
    );
    expect(v.decision).not.toBe("rejected");
  });
  it("eigene Ableitungen werden im Prompt gekennzeichnet", () => {
    const p = buildSpeakSystemPrompt({
      state: { curiosity: 1, joy: 1, fear: 0, trust: 1, uncertainty: 0, energy: 0.4 },
      goals: [],
      decision: "answer",
      recalled: ["A", "B"],
      interests: [],
      inferredMemories: ["B"],
    });
    expect(p).toContain("„A“;");
    expect(p).toContain("„B“ [eigene Ableitung, nicht vom Nutzer bestätigt]");
  });
});

describe("Unveränderte Grenzen", () => {
  it("Energie, Schwelle und 7-Tage-Sperre gleich", () => {
    expect(CURIOSITY_MIN_ENERGY).toBe(0.15);
    expect(AUTONOMY_MIN_ENERGY).toBe(0.15);
    expect(CURIOSITY_ASK_THRESHOLD).toBe(0.2);
    expect(QUESTION_MEMORY_LOCK_MS).toBe(7 * 24 * 60 * 60_000);
  });
  it("Prompt ohne neue Angaben ist unverändert für normale Antworten", () => {
    const p = buildSpeakSystemPrompt({
      state: { curiosity: 1, joy: 1, fear: 0, trust: 1, uncertainty: 0, energy: 0.4 },
      goals: [],
      decision: "answer",
      recalled: ["A"],
      interests: [],
    });
    expect(p).not.toContain("Bildstatus");
    expect(p).not.toContain("eigene Ableitung");
  });
  void userKiTurn;
});
