import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  filterDirectAnswerMemories,
  isForeignForDirectAnswer,
} from "@/orb-core/prompt-memory-filter";
import { contentTokens, normKey, topicOf, topicsOf } from "@/orb-core/memory";
import { decideConversationMode } from "@/orb-core/conversation";

const mem = (content: string, topic: string | null = topicOf(content)) => ({ content, topic });

const RTX = mem("Ich habe eine RTX 5070 Grafikkarte");
const FORT = mem("Für fortnite reicht es auf epische Einstellungen. Sind locker 125 FPS drin");
const KOCH = mem("Ich bin Koch");
const ESSEN = mem("Ich esse gerne Schnitzel");
const ORB = mem("ORB Core nutzt das Lovable AI Gateway als API");

describe("P2 V2 – finale Memory-Übergabe bei direkten Antworten", () => {
  it("1. Grafikkarte → RTX 5070 bleibt", () => {
    expect(filterDirectAnswerMemories("Welche Grafikkarte habe ich?", [RTX])).toEqual([RTX]);
  });
  it("2. Beruf → Koch bleibt", () => {
    expect(filterDirectAnswerMemories("Was mache ich beruflich?", [KOCH])).toEqual([KOCH]);
  });
  it("3. Essen → Schnitzel bleibt", () => {
    expect(filterDirectAnswerMemories("Was esse ich gerne?", [ESSEN])).toEqual([ESSEN]);
  });
  it("4. Fortnite → Fortnite-Memory bleibt", () => {
    expect(filterDirectAnswerMemories("Wie viele FPS schaffe ich in Fortnite?", [FORT])).toEqual([
      FORT,
    ]);
  });
  it("5. ORB Core/API → ORB-Memory bleibt", () => {
    expect(filterDirectAnswerMemories("Welche API verwendet ORB Core?", [ORB])).toEqual([ORB]);
  });
  it("6. Einstellungen ORB Core: ORB bleibt, Fortnite entfällt", () => {
    expect(filterDirectAnswerMemories("Welche Einstellungen nutzt ORB Core?", [ORB, FORT])).toEqual(
      [ORB],
    );
  });
  it("7. gemeinsamer Bereich bleibt (ohne gemeinsames Wort)", () => {
    expect(isForeignForDirectAnswer("Was mache ich beruflich?", mem("Ich bin Koch", null))).toBe(
      false,
    );
  });
  it("8. gleiches gespeichertes Thema bleibt", () => {
    const text = "Ganz genau";
    expect(isForeignForDirectAnswer(text, mem("Völlig anderer Inhalt", topicOf(text)))).toBe(false);
  });
  it("9. mehr als ein gemeinsamer Wortstamm bleibt", () => {
    expect(
      isForeignForDirectAnswer(
        "Hast du Kausalität selbst bestätigt?",
        mem("Ich trage dir Kausalität selbst vor", "trage"),
      ),
    ).toBe(false);
  });
  it("10. ohne Bereich, Thema und mit höchstens einem Wortstamm wird entfernt", () => {
    expect(isForeignForDirectAnswer("Kannst du mir helfen?", mem("Kannst du Schach", "x"))).toBe(
      true,
    );
    expect(isForeignForDirectAnswer("Wie spät ist es?", mem("Ich mag Berge", "berge"))).toBe(true);
  });
  it("keine Nachrücker, Reihenfolge bleibt, Eingaben unverändert", () => {
    const list = [ORB, FORT, RTX];
    const before = JSON.stringify(list);
    const out = filterDirectAnswerMemories("Welche Einstellungen nutzt ORB Core?", list);
    expect(out.length).toBeLessThanOrEqual(list.length);
    expect(out.every((m) => list.includes(m))).toBe(true);
    expect(out.map((m) => list.indexOf(m))).toEqual([...out.map((m) => list.indexOf(m))].sort());
    expect(JSON.stringify(list)).toBe(before);
  });
  it("Antwortart wird vor dem Filter bestimmt und bleibt unverändert", () => {
    const base = {
      text: "Was mache ich beruflich?",
      conversationTopics: topicsOf("Was mache ich beruflich?"),
      strands: [{ content: KOCH.content, topic: KOCH.topic, relevance: 0.05, confidence: 0.9 }],
      curiosity: 1,
      energy: 0.25,
      contextMessages: 8,
      resumeThread: null,
      explicitLearning: false,
      impulseAllowed: false,
    };
    const a = decideConversationMode(base);
    filterDirectAnswerMemories(base.text, [KOCH, FORT]);
    expect(decideConversationMode(base)).toEqual(a);
  });
  it("normKey, topicOf und contentTokens bleiben unverändert", () => {
    expect(normKey("Ich bin Koch")).toBe("koch");
    expect(topicOf(FORT.content)).toBe(FORT.topic);
    expect(contentTokens("kannst genau weißt")).toEqual(["kannst", "genau", "weißt"]);
  });
  it("Engine nutzt den Filter nur im Pfad direkter Antworten", () => {
    const src = readFileSync("src/orb-core/engine.server.ts", "utf8");
    expect(src).toContain(
      'plan.mode === "DIRECT_ANSWER" ? directAnswerMemories : plan.relevantStrands',
    );
  });
});
