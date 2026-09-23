/**
 * ORB Core – Semantischer Themen- und Frage-Recall
 * (Fix zu docs/ORB_MEMORY_RECALL_CONTEXT_AUDIT_2026-09-19.md).
 *
 * Geprüft wird, dass eine vorhandene Erinnerung auch bei natürlicher Sprache
 * als Kandidat gefunden wird – und dass Wichtigkeitsformel, Konfidenz und die
 * Speicherschwelle 0.35 dabei unverändert bleiben.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { scoreImportance, shouldPersist } from "@/orb-core/core";
import { memoryRelevance, similarity, topicOf } from "@/orb-core/memory";
import {
  TOPIC_AFFINITY_FLOOR,
  infoDomainOf,
  questionIntentOf,
  topicAffinity,
} from "@/orb-core/recall";

const ENGINE = readFileSync("src/orb-core/engine.server.ts", "utf8");

const GPU_MEMORY = "Der Nutzer besitzt eine RTX 5070 OC.";
const FOOD_MEMORY = "Der Nutzer isst am liebsten Schnitzel und Brokkoli.";
const JOB_MEMORY = "Der Nutzer arbeitet als Koch.";
const PROJECT_MEMORY = "Der Nutzer arbeitet an Y-Dude.";

describe("Topic-Normalisierung für Hardwarebegriffe", () => {
  it("ordnet RTX, GPU und Grafikkarte dem Thema hardware zu", () => {
    expect(topicOf("Es war eine RTX 5070 OC.")).toBe("hardware");
    expect(topicOf("Ich habe eine GeForce RTX 4090.")).toBe("hardware");
    expect(topicOf("Welche GPU habe ich?")).toBe("hardware");
    expect(topicOf("Ich mag Grafikkarten.")).toBe("hardware");
    expect(topicOf("Ich nutze eine Radeon von AMD.")).toBe("hardware");
  });

  it("zerstört bestehende Themen nicht", () => {
    expect(topicOf("Ich interessiere mich für PC-Hardware.")).toBe("hardware");
    expect(topicOf("Ich zocke viel auf der Konsole.")).toBe("gaming");
    expect(topicOf("Ich mag Pizza mit Ananas.")).toBe("essen");
  });
});

describe("Frage-Intent bleibt klein und deterministisch", () => {
  it("erkennt den Informationsbereich einer Frage", () => {
    expect(questionIntentOf("Welche Grafikkarte habe ich?")).toBe("hardware");
    expect(questionIntentOf("Welche GPU nutze ich?")).toBe("hardware");
    expect(questionIntentOf("Was esse ich gerne?")).toBe("essen");
    expect(questionIntentOf("Was mache ich beruflich?")).toBe("beruf");
    expect(questionIntentOf("An welchem Softwareprojekt arbeite ich?")).toBe("projekte");
    expect(questionIntentOf("Wie heißt mein Projekt?")).toBe("projekte");
  });

  it("liefert für Aussagen und unklare Fragen keinen Bereich", () => {
    expect(questionIntentOf("Es war eine RTX 5070 OC.")).toBeNull();
    expect(questionIntentOf("Wie geht es dir?")).toBeNull();
    expect(questionIntentOf("")).toBeNull();
  });

  it("ist deterministisch (gleiche Eingabe, gleiches Ergebnis)", () => {
    expect(questionIntentOf("Welche GPU habe ich?")).toBe(questionIntentOf("Welche GPU habe ich?"));
  });
});

describe("Topic-basierter Recall trotz fehlender Wortüberschneidung", () => {
  const cases: [string, string][] = [
    ["Welche Grafikkarte habe ich?", GPU_MEMORY],
    ["Welche GPU nutze ich?", GPU_MEMORY],
    ["Was esse ich gerne?", FOOD_MEMORY],
    ["Was mache ich beruflich?", JOB_MEMORY],
    ["An welchem Softwareprojekt arbeite ich?", PROJECT_MEMORY],
  ];

  for (const [question, memory] of cases) {
    it(`findet „${memory}“ bei „${question}“`, () => {
      const lexical = similarity(question, memory);
      const affinity = topicAffinity(question, memory);
      expect(affinity).toBe(TOPIC_AFFINITY_FLOOR);
      // Der Kandidat überlebt den bestehenden Filter (overlap > 0).
      expect(Math.max(lexical, affinity)).toBeGreaterThan(0);
    });
  }

  it("verbindet keine unterschiedlichen Bereiche", () => {
    expect(topicAffinity("Welche Grafikkarte habe ich?", FOOD_MEMORY)).toBe(0);
    expect(topicAffinity("Was esse ich gerne?", GPU_MEMORY)).toBe(0);
  });

  it("ohne passende Erinnerung bleibt der Kandidat verworfen", () => {
    const question = "Welche Grafikkarte habe ich?";
    const unrelated = "Der Nutzer war letzte Woche wandern.";
    expect(Math.max(similarity(question, unrelated), topicAffinity(question, unrelated))).toBe(0);
  });

  it("wörtliche Treffer ranken weiterhin höher als Themen-Affinität", () => {
    const question = "Welche Grafikkarte habe ich?";
    const literal = "Der Nutzer hat eine neue Grafikkarte gekauft.";
    expect(similarity(question, literal)).toBeGreaterThan(TOPIC_AFFINITY_FLOOR);
    expect(TOPIC_AFFINITY_FLOOR).toBeLessThan(0.2);
  });
});

describe("Bestehende Relevanz- und Speicherlogik bleibt unverändert", () => {
  it("Schwelle 0.35 und Wichtigkeitsformel sind unangetastet", () => {
    expect(scoreImportance("Es war eine RTX 5070 OC.")).toBeCloseTo(0.25, 5);
    expect(shouldPersist(0.25)).toBe(false);
    expect(shouldPersist(0.35)).toBe(true);
    expect(ENGINE).toContain("shouldPersist(importance)");
    expect(ENGINE).toContain("shouldPersist(memoryImportance)");
    expect(ENGINE).not.toMatch(/PERSIST_THRESHOLD\s*=\s*0\.(?!35)/);
  });

  it("Relevanzformel bewertet Themen-Affinität schwächer als Wortgleichheit", () => {
    const base = {
      weight: 0.5,
      importance: 0.4,
      lastAccessedAt: 0,
      activationCount: 1,
      now: 0,
    };
    const viaTopic = memoryRelevance({ ...base, similarity: TOPIC_AFFINITY_FLOOR });
    const viaWords = memoryRelevance({ ...base, similarity: 0.8 });
    expect(viaTopic).toBeGreaterThan(0);
    expect(viaWords).toBeGreaterThan(viaTopic);
  });

  it("ausdrückliches Merken speichert die aufgelöste Aussage, nicht den Auftrag", () => {
    expect(ENGINE).toContain("content: memoryText");
    expect(ENGINE).toContain("resolvedContextFact !== null");
    expect(ENGINE).toContain("scoreImportance(memoryText");
  });
});

describe("User-Isolation und Architekturgrenzen", () => {
  it("jede Kandidatenabfrage ist auf die Nutzerkennung eingeschränkt", () => {
    const block = ENGINE.slice(
      ENGINE.indexOf("async function retrieveCandidates"),
      ENGINE.indexOf(
        "/* -------------------------------------------------------------- Verarbeitung",
      ),
    );
    const selects = block.match(/from\("orb_nodes"\)\s*\.select\("\*"\)/g) ?? [];
    const scoped = block.match(/\.eq\("user_id", userId\)/g) ?? [];
    expect(selects.length).toBeGreaterThanOrEqual(4);
    expect(scoped.length).toBeGreaterThanOrEqual(selects.length);
    // P20: der Bereichszugang prüft nicht mehr nur das gespeicherte Stichwort,
    // sondern zusätzlich den Inhalt über die festen Leitwörter des Bereichs.
    expect(block).toContain("`topic.eq.${intentTopic}`");
    expect(block).toContain("domainKeywords(intentTopic)");
  });

  it("der Informationsbereich stammt aus ORB Core, nicht aus dem Sprachmodell", () => {
    const recall = readFileSync("src/orb-core/recall.ts", "utf8");
    expect(recall).not.toMatch(/fetch\(|openai|gateway/i);
    expect(infoDomainOf(GPU_MEMORY)).toBe("hardware");
  });
});
