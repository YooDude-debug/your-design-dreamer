/**
 * ORB Core – Memory Quality Fix.
 *
 * Kernprinzip: gefunden ≠ belastbar.
 * Recall → gefundene Knoten → Belastbarkeit → aktive Erinnerungen → LLM.
 *
 * Diese Tests prüfen ausschliesslich die neue Belastbarkeitsprüfung und dass der
 * bestehende Recall (Topic-/Intent-Recall, Schwelle 0.35, Formeln) unverändert
 * weiterarbeitet.
 */

import { describe, expect, it } from "vitest";

import {
  correctedTerm,
  isCorrection,
  isReliableMemoryContent,
  isStorableStatement,
  selectReliableMemories,
  utteranceKind,
} from "@/orb-core/eligibility";
import { scoreImportance, shouldPersist, isLearningEvent } from "@/orb-core/core";
import { questionIntentOf, topicAffinity, TOPIC_AFFINITY_FLOOR } from "@/orb-core/recall";
import { detectExplicitLearningRequest, resolveFromContext } from "@/orb-core/context";

describe("Äusserungsart", () => {
  it("1. echte persönliche Aussage ist eine Aussage", () => {
    expect(utteranceKind("Ich bin Koch von Beruf.")).toBe("statement");
    expect(isStorableStatement("Es war eine RTX 5070 OC.")).toBe(true);
  });

  it("2. reine Frage wird nicht als Tatsache gespeichert", () => {
    expect(utteranceKind("Welche Grafikkarte habe ich?")).toBe("question");
    expect(isStorableStatement("Welche Grafikkarte habe ich?")).toBe(false);
    expect(isStorableStatement("Was mache ich beruflich?")).toBe(false);
  });

  it("3. Aufforderung wird nicht als Tatsache gespeichert", () => {
    expect(utteranceKind("Merk dir, dass ich eine RTX 5070 habe.")).toBe("request");
    expect(isStorableStatement("Bitte erzähl mir etwas.")).toBe(false);
    expect(isStorableStatement("Frag mich etwas.")).toBe(false);
  });

  it("4. Fragment ohne Inhalt ist nicht belastbar", () => {
    expect(utteranceKind("ok")).toBe("fragment");
    expect(utteranceKind("hm")).toBe("fragment");
    expect(isStorableStatement("")).toBe(false);
  });
});

describe("Korrektur einer früheren Angabe", () => {
  it("5. erkennt eine ausdrückliche Tippfehler-Korrektur samt falschem Wort", () => {
    expect(isCorrection("Eier war ein Tippfehler.")).toBe(true);
    expect(correctedTerm("Eier war ein Tippfehler.")).toBe("eier");
    expect(correctedTerm("Ich bin Koch von Beruf.")).toBeNull();
  });

  it("6. „Falsch“ bleibt ein Korrektur-Signal, wird aber keine Tatsache", () => {
    expect(isLearningEvent("Das war falsch")).toBe(true);
    expect(isCorrection("Das war falsch.")).toBe(true);
    expect(isReliableMemoryContent("Das war falsch.")).toBe(false);
  });

  it("F) korrigierte Angabe erreicht den LLM-Kontext nicht mehr", () => {
    const found = [{ content: "Ich bin Eier geboren" }, { content: "Ich bin Koch von Beruf." }];
    const active = selectReliableMemories(found, ["eier"]);
    expect(active.map((a) => a.content)).toEqual(["Ich bin Koch von Beruf."]);
    // Der Knoten selbst bleibt vorhanden – VERGESSEN ≠ LÖSCHEN.
    expect(found.length).toBe(2);
  });
});

describe("Lernerfahrung (0.95)", () => {
  it("7. nur eine belastbare Aussage darf das Feld verwenden", () => {
    expect(isStorableStatement("Ich reagiere zu schnell auf Kritik.")).toBe(true);
    expect(isStorableStatement("Was habe ich gestern gefragt?")).toBe(false);
    expect(isStorableStatement("Merk dir das.")).toBe(false);
  });
});

describe("Aktive Erinnerungen vor dem LLM-Kontext", () => {
  it("8. unbestätigtes Fragment wird nicht weitergegeben", () => {
    expect(isReliableMemoryContent("ok")).toBe(false);
  });

  it("9. bestehende gültige Erinnerung bleibt belastbar", () => {
    expect(isReliableMemoryContent("Es war eine RTX 5070 OC.")).toBe(true);
    expect(isReliableMemoryContent("Ich bin Koch von Beruf.")).toBe(true);
  });

  it("D) eine gespeicherte Frage gilt nicht als persönliche Tatsache", () => {
    const active = selectReliableMemories([
      { content: "Welche Grafikkarte habe ich?" },
      { content: "Es war eine RTX 5070 OC." },
    ]);
    expect(active.map((a) => a.content)).toEqual(["Es war eine RTX 5070 OC."]);
  });

  it("12. Kontextaufbau übernimmt nur freigegebene Knoten", () => {
    const found = [
      { content: "Bitte merk dir das." },
      { content: "hm" },
      { content: "Ich bin Koch von Beruf." },
    ];
    expect(selectReliableMemories(found).length).toBe(1);
  });
});

describe("Bestehender Recall bleibt erhalten", () => {
  it("A) „Welche Grafikkarte habe ich?“ findet die RTX-Erinnerung", () => {
    expect(questionIntentOf("Welche Grafikkarte habe ich?")).toBe("hardware");
    expect(topicAffinity("Welche Grafikkarte habe ich?", "Es war eine RTX 5070 OC.")).toBe(
      TOPIC_AFFINITY_FLOOR,
    );
  });

  it("B) „Was mache ich beruflich?“ findet die Berufs-Erinnerung", () => {
    expect(topicAffinity("Was mache ich beruflich?", "Ich arbeite als Koch.")).toBe(
      TOPIC_AFFINITY_FLOOR,
    );
  });

  it("C) unbekannte Information erzeugt keinen Kandidaten", () => {
    expect(topicAffinity("Welche Schuhgröße habe ich?", "Es war eine RTX 5070 OC.")).toBe(0);
    expect(selectReliableMemories([]).length).toBe(0);
  });

  it("E) Merk-Aufforderung speichert nur den aufgelösten Fakt", () => {
    const request = detectExplicitLearningRequest("Merke dir das.");
    expect(request).not.toBeNull();
    const resolved = resolveFromContext(request!, [
      { role: "user", body: "Ich esse am liebsten Schnitzel und Brokkoli" },
    ]);
    expect(resolved?.fact).toContain("Schnitzel");
    expect(isStorableStatement(resolved!.fact)).toBe(true);
    expect(isStorableStatement("Merke dir das.")).toBe(false);
  });

  it("6./10. Schwelle und Wichtigkeitsformel bleiben unverändert", () => {
    expect(shouldPersist(0.35)).toBe(true);
    expect(shouldPersist(0.34)).toBe(false);
    expect(scoreImportance("ok")).toBeCloseTo(0.25, 5);
  });
});
