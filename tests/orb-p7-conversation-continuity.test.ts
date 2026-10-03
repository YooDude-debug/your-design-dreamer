import { describe, it, expect } from "vitest";
import {
  isAnsweredInConversation,
  pendingOrbQuestions,
  ambiguousReplyHint,
  conversationOriginContents,
  attributionHint,
  speculationHint,
  CONVERSATION_CONTINUITY_RULE,
} from "@/orb-core/continuity-rules";
import { buildSpeakSystemPrompt } from "@/orb-core/llm/prompt.server";
import { isShortReply, pendingOrbQuestion } from "@/orb-core/conversation";

const state = { curiosity: 0.5, joy: 0.5, fear: 0.1, trust: 0.5, uncertainty: 0.3, energy: 0.8 } as never;
const base = { state, goals: [], decision: "answer", recalled: [] as string[], interests: [] };
const u = (body: string) => ({ role: "user", body });
const o = (body: string) => ({ role: "orb", body });

describe("P7 Gesprächskontinuität", () => {
  it("„Ich mag dünne Pizza“ → gleiche Präferenzfrage gilt als beantwortet", () => {
    const msgs = [u("Ich mag dünne Pizza am liebsten.")];
    expect(isAnsweredInConversation("Magst du lieber dünne oder dicke Pizza?", msgs)).toBe(true);
  });
  it("Frau/dicker Teig nach Erklärung → beantwortet (Inhalt statt Wortlaut)", () => {
    const msgs = [u("Ich koche alles ohne Rezept."), u("Meine Frau mag dicken Teig, deshalb mache ich ihre Pizza dicker.")];
    expect(isAnsweredInConversation("Machst du für deine Frau einen dickeren Teig?", msgs)).toBe(true);
  });
  it("neues Thema bleibt fragbar", () => {
    expect(isAnsweredInConversation("Welchen Käse nimmst du für Lasagne?", [u("Ich mag dünne Pizza.")])).toBe(false);
  });
  it("nur Benutzernachrichten zählen als Antwort", () => {
    expect(isAnsweredInConversation("Magst du dünne Pizza?", [o("Magst du dünne Pizza?")])).toBe(false);
  });
  it("„Meine Frau mag dicke Pizza“ → Zuordnung zur Frau", () => {
    expect(attributionHint("Meine Frau mag dicke Pizza")).toMatch(/meine frau/);
    expect(attributionHint("Ich mag dicke Pizza")).toBe("");
    expect(buildSpeakSystemPrompt({ ...base, userText: "Meine Frau mag dicke Pizza" })).toContain("nicht dem Benutzer");
  });
  it("„Ja“ auf eine eindeutige Frage bleibt gebunden", () => {
    const msgs = [o("Soll ich das zusammenfassen?")];
    expect(isShortReply("Ja")).toBe(true);
    expect(pendingOrbQuestion(msgs)).toBe("Soll ich das zusammenfassen?");
    expect(pendingOrbQuestions(msgs)).toHaveLength(1);
    expect(ambiguousReplyHint(pendingOrbQuestions(msgs))).toBe("");
  });
  it("mehrere Fragen in einer Nachricht → kein Raten", () => {
    const qs = pendingOrbQuestions([o("Magst du Pizza? Oder lieber Pasta?")]);
    expect(qs).toHaveLength(2);
    const p = buildSpeakSystemPrompt({ ...base, ambiguousReplyTo: qs });
    expect(p).toContain("nicht eindeutig");
    expect(p).toContain("frage kurz nach");
  });
  it("aktuelle Aussage vor älterer Erinnerung, Konflikt benennen", () => {
    expect(CONVERSATION_CONTINUITY_RULE).toMatch(/Vorrang vor älteren Erinnerungen/);
    expect(CONVERSATION_CONTINUITY_RULE).toMatch(/nenne den Unterschied/);
  });
  it("aktuelle Information → nicht als alte Erinnerung", () => {
    const fresh = conversationOriginContents(
      [
        { content: "mag dünne Pizza", createdAt: "2026-10-03T15:00:00Z" },
        { content: "ist Koch", createdAt: "2026-09-01T10:00:00Z" },
      ],
      "2026-10-03T14:50:00Z",
    );
    expect(fresh).toEqual(["mag dünne Pizza"]);
    const p = buildSpeakSystemPrompt({ ...base, recalled: ["mag dünne Pizza", "ist Koch"], conversationMemories: fresh });
    expect(p).toContain("„mag dünne Pizza“ [gerade in diesem Gespräch gesagt, keine ältere Erinnerung]");
    expect(p).not.toContain("„ist Koch“ [gerade");
    expect(conversationOriginContents([{ content: "x", createdAt: "2026-10-03T15:00:00Z" }], null)).toEqual([]);
  });
  it("Korrektur und unklare Antwort: keine erfundene Bestätigung", () => {
    expect(isShortReply("Vielleicht?")).toBe(false);
    expect(CONVERSATION_CONTINUITY_RULE).toMatch(/frage kurz nach, statt einen Bezug zu behaupten/);
  });
  it("theoretische Umsatzfrage → Szenario statt Prognose", () => {
    expect(speculationHint("Wie viel könnte ich mit ORB Core verdienen?")).toMatch(/Szenarien/);
    expect(speculationHint("Wie geht es dir?")).toBe("");
  });
  it("Aussage ohne Rückfrage ist erlaubt", () => {
    expect(buildSpeakSystemPrompt(base)).toContain("Aussage ohne Rückfrage ist ausdrücklich erlaubt");
  });
});
