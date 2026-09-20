/**
 * ORB Core – Gesprächsentscheidung (neues Verhalten).
 *
 * Geprüft wird ausschliesslich die neue, reine Entscheidungsschicht:
 * Welche Art von Beitrag ist erforderlich, und welche Stränge dürfen den
 * Gesprächsmoment beeinflussen. Gedächtnisformeln, Schwellen, Recall und
 * Cooldowns sind nicht Teil dieser Datei und bleiben unverändert.
 */

import { describe, expect, it } from "vitest";

import {
  CONVERSATION_MODES,
  MODE_HINT,
  MODE_RELEVANCE_MIN,
  decideConversationMode,
  isRelevantStrand,
  isSmallTalkOpening,
  needsDirectAnswer,
  selectRelevantStrands,
  type ConversationInput,
  type ConversationStrand,
} from "@/orb-core/conversation";

const strand = (over: Partial<ConversationStrand> = {}): ConversationStrand => ({
  content: "Ich arbeite als Koch.",
  topic: "arbeit",
  relevance: 0.5,
  confidence: 0.8,
  ...over,
});

const base = (over: Partial<ConversationInput> = {}): ConversationInput => ({
  text: "Ich war heute wieder arbeiten.",
  conversationTopics: ["arbeit"],
  strands: [strand()],
  curiosity: 0.5,
  energy: 0.7,
  contextMessages: 4,
  resumeThread: null,
  impulseAllowed: false,
  explicitLearning: false,
  ...over,
});

describe("Gesprächsmodus", () => {
  it("1. direkte Frage ergibt DIRECT_ANSWER", () => {
    const plan = decideConversationMode(base({ text: "Welche Grafikkarte habe ich?" }));
    expect(plan.mode).toBe("DIRECT_ANSWER");
  });

  it("direkte Aufforderung ohne Fragezeichen zählt ebenfalls", () => {
    expect(needsDirectAnswer("Erkläre mir den Unterschied")).toBe(true);
    expect(needsDirectAnswer("Ich war heute arbeiten")).toBe(false);
  });

  it("2. relevanter Anschluss ergibt FOLLOW_UP", () => {
    const plan = decideConversationMode(base());
    expect(plan.mode).toBe("FOLLOW_UP");
    expect(plan.relevantStrands).toEqual(["Ich arbeite als Koch."]);
    expect(plan.focusTopic).toBe("arbeit");
  });

  it("offener Gedankenfaden trägt einen Anschluss auch ohne Strang", () => {
    const plan = decideConversationMode(
      base({ strands: [], resumeThread: { title: "Umzug", unknown: ["Termin"] } }),
    );
    expect(plan.mode).toBe("FOLLOW_UP");
  });

  it("3. natürlicher Smalltalk ohne Informationsbedarf", () => {
    const plan = decideConversationMode(
      base({
        text: "Hallo",
        conversationTopics: [],
        strands: [],
        curiosity: 0.2,
      }),
    );
    expect(plan.mode).toBe("SMALLTALK");
    expect(isSmallTalkOpening("Hallo")).toBe(true);
  });

  it("Smalltalk braucht vorhandenen Gesprächskontext", () => {
    const plan = decideConversationMode(
      base({ text: "Hallo", conversationTopics: [], strands: [], contextMessages: 0 }),
    );
    expect(plan.mode).toBe("LISTEN");
  });

  it("4. bestehender echter Impuls ergibt PROACTIVE_IMPULSE", () => {
    const plan = decideConversationMode(base({ impulseAllowed: true }));
    expect(plan.mode).toBe("PROACTIVE_IMPULSE");
  });

  it("5. kein sinnvoller Beitrag ergibt LISTEN", () => {
    const plan = decideConversationMode(
      base({ text: "hm", conversationTopics: [], strands: [], contextMessages: 0 }),
    );
    expect(plan.mode).toBe("LISTEN");
    expect(plan.relevantStrands).toEqual([]);
    expect(plan.focusTopic).toBeNull();
  });

  it("LISTEN gilt nicht bei erforderlicher Antwort", () => {
    const plan = decideConversationMode(
      base({ text: "Wie viel Uhr ist es?", conversationTopics: [], strands: [] }),
    );
    expect(plan.mode).toBe("DIRECT_ANSWER");
  });

  it("6. starker irrelevanter Strang löst keinen Impuls aus", () => {
    const plan = decideConversationMode(
      base({
        text: "Ich war heute wieder arbeiten.",
        conversationTopics: ["arbeit"],
        strands: [
          strand({ content: "Es war eine RTX 5070 OC.", topic: "hardware", relevance: 0.05 }),
        ],
      }),
    );
    expect(plan.mode).not.toBe("PROACTIVE_IMPULSE");
    expect(plan.relevantStrands).toEqual([]);
  });

  it("7. starker relevanter Strang darf berücksichtigt werden", () => {
    const plan = decideConversationMode(
      base({
        text: "Heute ging es um meine Grafikkarte.",
        conversationTopics: ["hardware"],
        strands: [
          strand({ content: "Es war eine RTX 5070 OC.", topic: "hardware", relevance: 0.6 }),
        ],
      }),
    );
    expect(plan.relevantStrands).toEqual(["Es war eine RTX 5070 OC."]);
  });

  it("8. unabhängige Erinnerungen werden nicht künstlich verbunden", () => {
    const plan = decideConversationMode(
      base({
        text: "Ich war heute wieder arbeiten.",
        conversationTopics: ["arbeit"],
        strands: [
          strand({ content: "Ich arbeite als Koch.", topic: "arbeit", relevance: 0.5 }),
          strand({ content: "Ich mag keine Ananas.", topic: "essen", relevance: 0.04 }),
        ],
      }),
    );
    expect(plan.relevantStrands).toEqual(["Ich arbeite als Koch."]);
  });

  it("Relevanzgrenze gilt für themenfremde Stränge", () => {
    expect(
      isRelevantStrand(strand({ topic: "essen", relevance: MODE_RELEVANCE_MIN }), ["arbeit"]),
    ).toBe(true);
    expect(
      isRelevantStrand(strand({ topic: "essen", relevance: MODE_RELEVANCE_MIN - 0.01 }), [
        "arbeit",
      ]),
    ).toBe(false);
  });

  it("nur die stärksten relevanten Stränge gehen weiter", () => {
    const selected = selectRelevantStrands({
      conversationTopics: ["arbeit"],
      strands: [
        strand({ content: "A", relevance: 0.3 }),
        strand({ content: "B", relevance: 0.9 }),
        strand({ content: "C", relevance: 0.6 }),
      ],
    });
    expect(selected.map((s) => s.content)).toEqual(["B", "C"]);
  });

  it("9. niedrige Energie erzeugt keinen eigenen Beitrag", () => {
    const plan = decideConversationMode(base({ energy: 0.05 }));
    expect(plan.mode).toBe("LISTEN");
  });

  it("geringe Neugier verhindert den Anschluss", () => {
    const plan = decideConversationMode(base({ curiosity: 0.1 }));
    expect(plan.mode).toBe("SMALLTALK");
  });

  it("ausdrückliche Merk-Aufforderung wird bestätigt, nicht hinterfragt", () => {
    const plan = decideConversationMode(base({ explicitLearning: true }));
    expect(plan.mode).toBe("DIRECT_ANSWER");
  });

  it("die Entscheidung ist deterministisch", () => {
    const input = base();
    expect(decideConversationMode(input)).toEqual(decideConversationMode(input));
  });

  it("jeder Modus besitzt eine Sprachanweisung", () => {
    for (const mode of CONVERSATION_MODES) {
      expect(MODE_HINT[mode].length).toBeGreaterThan(10);
    }
  });

  it("jede Entscheidung ist begründet", () => {
    for (const input of [base(), base({ impulseAllowed: true }), base({ text: "Was ist das?" })]) {
      expect(decideConversationMode(input).reason.length).toBeGreaterThan(10);
    }
  });
});
