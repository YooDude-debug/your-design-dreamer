/**
 * ORB Core – P20: Mehrfach-Informationsbereiche in der Retrieval-Vorauswahl.
 *
 * Geprüft wird ausschliesslich, dass eine Erinnerung mit mehreren Tatsachen
 * über mehrere passende Bereiche auffindbar wird. Relevanzformel, Untergrenze
 * 0.12, Speicherschwelle 0.35 und der harte Filter `overlap > 0` bleiben
 * unverändert – das wird hier ebenfalls nachgewiesen.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { scoreImportance, shouldPersist } from "@/orb-core/core";
import { memoryRelevance, similarity } from "@/orb-core/memory";
import {
  TOPIC_AFFINITY_FLOOR,
  domainKeywords,
  infoDomainOf,
  infoDomainsOf,
  questionIntentOf,
  topicAffinity,
} from "@/orb-core/recall";

const ENGINE = readFileSync("src/orb-core/engine.server.ts", "utf8");

const COLLECTION = "Brokkoli, Schnitzel, Schuhgröße 42, RTX 5070 OC";
const KOCH = "Der Nutzer ist Koch.";
const HEISSE = "Guten Abend. Ich heiße Mario.";
const NAME_IST = "Mein Name ist Mario.";
const AGE = "Ich bin 36 Jahre.";
const PURE_GPU = "Der Nutzer besitzt eine RTX 5070 OC.";
const PURE_FOOD = "Der Nutzer isst am liebsten Schnitzel und Brokkoli.";

function overlapOf(question: string, memory: string): number {
  return Math.max(similarity(question, memory), topicAffinity(question, memory));
}

describe("Eine Erinnerung darf mehrere Informationsbereiche tragen", () => {
  it("die Sammel-Erinnerung wird unter Essen UND Hardware erkannt", () => {
    const domains = infoDomainsOf(COLLECTION);
    expect(domains).toContain("essen");
    expect(domains).toContain("hardware");
  });

  it("der bisherige Einzelbereich bleibt unverändert (erster Treffer)", () => {
    expect(infoDomainOf(COLLECTION)).toBe("hardware");
  });

  it("ohne Treffer wird kein Bereich erfunden", () => {
    expect(infoDomainsOf("Der Nutzer war letzte Woche wandern.")).toEqual([]);
    expect(infoDomainsOf("")).toEqual([]);
  });
});

describe("Pflichtfälle: Frage findet die passende Erinnerung", () => {
  const cases: [string, string, string][] = [
    ["Was esse ich gerne?", COLLECTION, "essen"],
    ["Welche Grafikkarte habe ich?", COLLECTION, "hardware"],
    ["Was arbeite ich?", KOCH, "beruf"],
    ["Wie heiße ich?", HEISSE, "name"],
    ["Wie heiße ich?", NAME_IST, "name"],
    ["Wie alt bin ich?", AGE, "alter"],
  ];

  for (const [question, memory, domain] of cases) {
    it(`„${question}“ → ${domain}`, () => {
      expect(questionIntentOf(question)).toBe(domain);
      expect(infoDomainsOf(memory)).toContain(domain);
      expect(topicAffinity(question, memory)).toBe(TOPIC_AFFINITY_FLOOR);
      expect(overlapOf(question, memory)).toBeGreaterThan(0);
    });
  }

  it("„Mein Name ist Mario“ und „Ich heiße Mario“ liegen im selben Bereich", () => {
    expect(infoDomainsOf(NAME_IST)).toContain("name");
    expect(infoDomainsOf(HEISSE)).toContain("name");
  });

  it("die Schuhgrößenfrage bleibt ein wörtlicher Treffer (unverändert)", () => {
    expect(topicAffinity("Welche Schuhgröße habe ich?", COLLECTION)).toBe(0);
    expect(similarity("Welche Schuhgröße habe ich?", COLLECTION)).toBeGreaterThan(0);
  });
});

describe("Gegenproben: nichts wird weichgespült", () => {
  it("Altersfrage × reine Grafikkarten-Erinnerung bleibt verworfen", () => {
    expect(overlapOf("Wie alt bin ich?", PURE_GPU)).toBe(0);
  });

  it("Essensfrage × reine Grafikkarten-Erinnerung bleibt verworfen", () => {
    expect(overlapOf("Was esse ich gerne?", PURE_GPU)).toBe(0);
  });

  it("Grafikkartenfrage × reine Essens-Erinnerung bleibt verworfen", () => {
    expect(topicAffinity("Welche Grafikkarte habe ich?", PURE_FOOD)).toBe(0);
  });

  it("Wohnortfrage ohne Wohnort-Erinnerung findet nichts", () => {
    expect(questionIntentOf("Wo wohne ich?")).toBe("wohnort");
    expect(overlapOf("Wo wohne ich?", COLLECTION)).toBe(0);
    expect(overlapOf("Wo wohne ich?", PURE_GPU)).toBe(0);
    expect(overlapOf("Wo wohne ich?", AGE)).toBe(0);
  });

  it("Aussagen lösen keinen Bereichs-Recall aus", () => {
    expect(questionIntentOf(COLLECTION)).toBeNull();
    expect(questionIntentOf("Wie geht es dir?")).toBeNull();
  });
});

describe("Relevanzfilter und Speicherlogik sind unverändert", () => {
  it("Untergrenze, Schwelle und Wichtigkeitsformel sind identisch", () => {
    expect(TOPIC_AFFINITY_FLOOR).toBe(0.12);
    expect(scoreImportance("Es war eine RTX 5070 OC.")).toBeCloseTo(0.25, 5);
    expect(shouldPersist(0.25)).toBe(false);
    expect(shouldPersist(0.35)).toBe(true);
  });

  it("der harte Filter im Abrufpfad bleibt `overlap > 0`", () => {
    expect(ENGINE).toContain("filter((c) => c.overlap > 0)");
    expect(ENGINE).toContain(
      "const overlap = Math.max(similarity(text, n.content), topicAffinity(text, n.content));",
    );
  });

  it("wörtliche Treffer ranken weiterhin höher als die Untergrenze", () => {
    const base = {
      weight: 0.5,
      importance: 0.4,
      lastAccessedAt: 0,
      activationCount: 1,
      now: 0,
    };
    expect(memoryRelevance({ ...base, similarity: 0.8 })).toBeGreaterThan(
      memoryRelevance({ ...base, similarity: TOPIC_AFFINITY_FLOOR }),
    );
  });
});

describe("Kandidatensuche bleibt begrenzt und nutzerbezogen", () => {
  const block = ENGINE.slice(
    ENGINE.indexOf("async function retrieveCandidates"),
    ENGINE.indexOf(
      "/* -------------------------------------------------------------- Verarbeitung",
    ),
  );

  it("die Bereichsabfrage nutzt feste Leitwörter, keinen erfundenen Text", () => {
    expect(block).toContain("domainKeywords(intentTopic)");
    expect(domainKeywords("essen").length).toBeGreaterThan(0);
    expect(domainKeywords("unbekannt")).toEqual([]);
    expect(domainKeywords(null)).toEqual([]);
  });

  it("jede Kandidatenabfrage bleibt auf die Nutzerkennung und die Obergrenze begrenzt", () => {
    const selects = block.match(/from\("orb_nodes"\)\s*\.select\("\*"\)/g) ?? [];
    const scoped = block.match(/\.eq\("user_id", userId\)/g) ?? [];
    expect(selects.length).toBeGreaterThanOrEqual(4);
    expect(scoped.length).toBeGreaterThanOrEqual(selects.length);
    expect(block).toContain("limit(CANDIDATE_LIMIT)");
    expect(block).not.toContain("limit(1000)");
  });
});
