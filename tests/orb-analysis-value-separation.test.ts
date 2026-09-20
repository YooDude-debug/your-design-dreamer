/**
 * ORB Core – A/B/C-Trennung der Analysewerte.
 *
 * A) Vorschlag der KI  B) Werte des deterministischen Validators
 * C) Werte, die tatsächlich gespeichert werden.
 * Die KI darf keinen Speicherwert erzwingen.
 */

import { describe, expect, it } from "vitest";
import { validateCandidates, type ExistingNode } from "@/orb-core/analysis/validate";
import { sanitizeCandidates, SCOPE_DECAY, type MemoryCandidate } from "@/orb-core/analysis/schema";

const NO_SIGNALS = {
  explicitRemember: false,
  temporaryOnly: false,
  forget: false,
  change: false,
};

function candidate(over: Partial<MemoryCandidate> = {}): MemoryCandidate {
  return {
    key: "lieblingsessen",
    value: "Mario isst am liebsten Schnitzel mit Brokkoli.",
    category: "preference",
    relevance: 0.91,
    longTermValue: 0.82,
    confidence: 0.94,
    temporalScope: "long_term",
    decayRate: 0.9,
    source: "conversation",
    sourceReference: "Benutzer: Ich esse am liebsten Schnitzel mit Brokkoli.",
    relatedNodeIds: [],
    action: "create_or_update",
    ...over,
  };
}

const NO_NODES: ExistingNode[] = [];

describe("Analysewerte: KI-Vorschlag ist nicht der Speicherwert", () => {
  it("behält den KI-Vorschlag unverändert getrennt vom akzeptierten Wert", () => {
    const c = candidate();
    const [v] = validateCandidates([c], NO_NODES, NO_SIGNALS);
    expect(v.candidate.relevance).toBe(0.91);
    expect(v.candidate.longTermValue).toBe(0.82);
    expect(v.candidate.confidence).toBe(0.94);
    expect(typeof v.relevance).toBe("number");
    expect(typeof v.longTermValue).toBe("number");
  });

  it("setzt bei unbrauchbarer KI-Verfallsrate die Core-Vorgabe ein", () => {
    const [parsed] = sanitizeCandidates([
      { ...candidate({ temporalScope: "temporary" }), decay_rate: "schnell" },
    ]);
    const [v] = validateCandidates([parsed], NO_NODES, NO_SIGNALS);
    expect(v.decayRate).toBe(SCOPE_DECAY.temporary);
  });

  it("lehnt einen Kandidaten trotz hoher KI-Sicherheit ab, wenn er unbelastbar ist", () => {
    const [v] = validateCandidates(
      [candidate({ key: "frage", value: "Welche Grafikkarte habe ich?", confidence: 1 })],
      NO_NODES,
      NO_SIGNALS,
    );
    expect(v.decision).toBe("rejected");
  });

  it("hält Werte aus der KI-Antwort im gültigen Bereich 0..1", () => {
    const [parsed] = sanitizeCandidates([
      { ...candidate(), relevance: 42, long_term_value: -3, confidence: 9 },
    ]);
    const [v] = validateCandidates([parsed], NO_NODES, NO_SIGNALS);
    for (const n of [v.relevance, v.longTermValue, v.confidence]) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });
});
