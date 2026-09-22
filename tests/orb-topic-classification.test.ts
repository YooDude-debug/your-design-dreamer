/**
 * Regressionstests zur Topic-Klassifizierung (TARGETED FIX 01, Teil B).
 *
 * Grundlage: die 15 im Stability Forensic Audit reproduzierten Fehlzuordnungen.
 * Nach dem Fix muss jeder Fall entweder einem inhaltlich passenden Thema oder
 * einem neutralen Thema (erstes Inhaltswort, kein Keyword-Treffer) zugeordnet
 * werden. Die Zuordnung bleibt vollständig deterministisch – kein LLM.
 */

import { describe, expect, it } from "vitest";

import { topicOf, topicsOf } from "@/orb-core/memory";

const KEYWORD_TOPICS = [
  "hardware",
  "gaming",
  "smartphones",
  "programmierung",
  "ki",
  "essen",
  "sport",
  "musik",
  "reisen",
  "film",
  "auto",
  "natur",
];

/** Neutral = kein bekanntes Thema getroffen (Fallback erstes Inhaltswort). */
function isNeutral(topic: string | null): boolean {
  return topic === null || !KEYWORD_TOPICS.includes(topic);
}

describe("Topic-Fix: die drei gemeldeten Fälle", () => {
  it("„wandern“ bleibt Reisen (echte Beugung über das geschriebene Wort)", () => {
    expect(topicOf("Ich gehe wandern")).toBe("reisen");
    expect(topicOf("Wir waren wandern im Allgäu")).toBe("reisen");
  });

  it("„Wand“ ist nicht länger Reisen", () => {
    expect(topicOf("Die Wand ist weiss")).not.toBe("reisen");
    expect(isNeutral(topicOf("Die Wand ist weiss"))).toBe(true);
  });

  it("„Rechnung“ ist nicht länger Hardware, „Rechner“ bleibt Hardware", () => {
    expect(topicOf("Die Rechnung war hoch")).not.toBe("hardware");
    expect(isNeutral(topicOf("Die Rechnung war hoch"))).toBe(true);
    expect(topicOf("Mein Rechner ist neu")).toBe("hardware");
  });

  it("„Bandage“ ist nicht länger Musik, „Band“ bleibt Musik", () => {
    expect(topicOf("Ich brauche eine Bandage")).not.toBe("musik");
    expect(isNeutral(topicOf("Ich brauche eine Bandage"))).toBe(true);
    expect(topicOf("Ich höre gern diese Band")).toBe("musik");
  });
});

describe("Topic-Fix: die zwölf weiteren reproduzierten Fehlzuordnungen", () => {
  const cases: { input: string; notTopic: string }[] = [
    { input: "Bandbreite ist gross", notTopic: "musik" },
    { input: "Bandscheibe tut weh", notTopic: "musik" },
    { input: "Bandnudeln mit Sauce", notTopic: "musik" },
    { input: "Bandana auf dem Kopf", notTopic: "musik" },
    { input: "Der Reis war lecker", notTopic: "reisen" },
    { input: "Reisszwecke gefunden", notTopic: "reisen" },
    { input: "Bergpredigt gelesen", notTopic: "reisen" },
    { input: "Bergwerk besichtigt", notTopic: "reisen" },
    { input: "Rechnungswesen studiert", notTopic: "hardware" },
    { input: "Spielzeugauto gekauft", notTopic: "gaming" },
    { input: "Spielplatz am Haus", notTopic: "gaming" },
    { input: "Waldbrand gemeldet", notTopic: "natur" },
  ];

  for (const c of cases) {
    it(`„${c.input}“ ist nicht ${c.notTopic}`, () => {
      const topic = topicOf(c.input);
      expect(topic).not.toBe(c.notTopic);
      expect(isNeutral(topic)).toBe(true);
    });
  }

  it("„Wandtattoo“ bleibt neutral wie vorher", () => {
    expect(isNeutral(topicOf("Wandtattoo an der Wand"))).toBe(true);
  });
});

describe("Topic-Fix: bestehende korrekte Zuordnungen bleiben erhalten", () => {
  it("Reisen", () => {
    expect(topicOf("Ich reise gern nach Italien")).toBe("reisen");
    expect(topicOf("Ich war im Urlaub")).toBe("reisen");
    expect(topicOf("Der Flug war günstig")).toBe("reisen");
    expect(topicOf("Das Hotel war gut")).toBe("reisen");
    expect(topicOf("Ich gehe gern in die Berge")).toBe("reisen");
    expect(topicOf("Wir waren am Strand")).toBe("reisen");
  });

  it("Musik", () => {
    expect(topicOf("Ich mag Musik und Konzerte")).toBe("musik");
    // Bestehendes Verhalten: „spiele“ trifft zuerst gaming, Musik bleibt erkannt.
    expect(topicsOf("Ich spiele Gitarre")).toContain("musik");
    expect(topicOf("Das Album ist stark")).toBe("musik");
  });

  it("Hardware", () => {
    expect(topicOf("Ich habe eine neue Grafikkarte")).toBe("hardware");
    expect(topicOf("Ich interessiere mich für PC-Hardware")).toBe("hardware");
    expect(topicOf("Es war eine RTX 5070 OC.")).toBe("hardware");
    expect(topicOf("Ich nutze eine Radeon von AMD.")).toBe("hardware");
    expect(topicOf("Welche GPU habe ich?")).toBe("hardware");
  });

  it("weitere Themen", () => {
    expect(topicOf("Ich zocke viel auf der Konsole")).toBe("gaming");
    expect(topicOf("Ich mag Pizza mit Ananas")).toBe("essen");
    expect(topicsOf("Neue GPU für Gaming vorgestellt")).toContain("hardware");
  });

  it("Programmierung, KI und Sport bleiben korrekt", () => {
    expect(topicOf("Ich programmiere jeden Tag")).toBe("programmierung");
    expect(topicsOf("Wir nutzen Python und eine Datenbank")).toContain("programmierung");
    expect(topicOf("Künstliche Intelligenz fasziniert mich")).toBe("ki");
    // „neuronal“ trifft das Keyword „neural“ bewusst NICHT (Präfixregel) – neutral ist korrekt.
    expect(topicsOf("Ein neuronales Netz lernt schnell")).not.toContain("ki");
    expect(topicsOf("Das Modell wurde neu trainiert")).toContain("ki");
    expect(topicOf("Ich gehe dreimal pro Woche ins Training")).toBe("sport");
    expect(topicsOf("Fußball am Wochenende")).toContain("sport");
  });

  it("unbekannte Begriffe bleiben neutral", () => {
    expect(isNeutral(topicOf("Quastenflosser gesehen"))).toBe(true);
    expect(topicOf("")).toBeNull();
  });
});
