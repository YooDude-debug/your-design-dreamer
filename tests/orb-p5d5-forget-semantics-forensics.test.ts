// P5-D5: rein diagnostisch. Keine Produktivänderung, keine DB, keine externe API.
import { describe, it, expect } from "vitest";
import {
  userSignalsFrom,
  validateCandidate,
  findRelatedNode,
  type ExistingNode,
} from "@/orb-core/analysis/validate";
import { normKey } from "@/orb-core/memory";
import type { MemoryCandidate } from "@/orb-core/analysis/schema";

const node = (id: string, content: string): ExistingNode => ({
  id,
  content,
  normKey: normKey(content) || null,
  category: "fact",
  longTermValue: 0.5,
  temporalScope: "long_term",
});
const A = node("A", "Der Nutzer nutzt RTX 5070.");
const B = node("B", "Der Nutzer arbeitet als Koch.");
const C = node("C", "Der Nutzer wohnt in Leipzig.");
const cand = (value: string): MemoryCandidate => ({
  key: "k",
  value,
  category: "fact",
  relevance: 0.8,
  longTermValue: 0.8,
  confidence: 0.9,
  temporalScope: "long_term",
  decayRate: 0.01,
  source: "conversation",
  sourceReference: "",
  relatedNodeIds: [],
  action: "forget",
});

describe("P5-D5 Parser: was bleibt vom Satz übrig", () => {
  const cases: [string, boolean][] = [
    ["Vergiss X.", true],
    ["Vergiss Y.", true],
    ["Vergiss X und Y.", true],
    ["Vergiss das.", true],
    ["Vergiss diese Memory.", true],
    ["Ich habe X vergessen.", false],
    ["Nicht vergessen.", false],
    ["Vergiss die RTX.", true],
    ["Vergiss meinen Beruf.", true],
    ["Vergiss meinen Wohnort.", true],
    ["Vergiss das nicht!", true], // Gegenteil gemeint, trotzdem forget=true
  ];
  for (const [s, f] of cases)
    it(`"${s}" → forget=${f}`, () => {
      const sig = userSignalsFrom([s]);
      expect(sig.forget).toBe(f);
      // Output ist ausschliesslich ein Boolean-Satz – kein Ziel, kein Text, keine ID
      expect(Object.keys(sig).sort()).toEqual([
        "change",
        "explicitRemember",
        "forget",
        "temporaryOnly",
      ]);
      expect(Object.values(sig).every((v) => typeof v === "boolean")).toBe(true);
    });
  it("A, B, C ergeben identische Signale (Ziel geht verloren)", () => {
    const sigs = [
      "Vergiss die RTX.",
      "Vergiss meinen Beruf.",
      "Vergiss meinen Wohnort.",
      "Vergiss X.",
    ].map((s) => JSON.stringify(userSignalsFrom([s])));
    expect(new Set(sigs).size).toBe(1);
  });
  it('"Vergiss das nicht!": forget=true, explicitRemember=false', () => {
    expect(userSignalsFrom(["Vergiss das nicht!"])).toMatchObject({
      forget: true,
      explicitRemember: false,
    });
  });
  it('"Nicht vergessen." → explicitRemember=true, forget=false', () => {
    expect(userSignalsFrom(["Nicht vergessen."])).toMatchObject({
      forget: false,
      explicitRemember: true,
    });
  });
});

describe("P5-D5 Zielauflösung: nur der Modell-Kandidat bestimmt den Treffer", () => {
  const forget = userSignalsFrom(["Vergiss die RTX."]);
  it("Ziel = Treffer des Kandidaten, nicht des Satzes", () => {
    // Das Modell liefert B als Kandidat, obwohl der User die RTX meinte → B wird Ziel
    expect(validateCandidate(cand(B.content), [A, B, C], forget)).toMatchObject({
      decision: "update",
      nodeId: "B",
    });
    expect(validateCandidate(cand(A.content), [A, B, C], forget)).toMatchObject({
      decision: "update",
      nodeId: "A",
    });
  });
  it("Kandidat ohne Treffer → rejected; Satz selbst ist als Wert nicht belastbar", () => {
    expect(
      validateCandidate(cand("Der Nutzer wohnt in Hamburg am Hafen."), [B], forget).decision,
    ).toBe("rejected");
    expect(validateCandidate(cand("Vergiss die RTX."), [A, B, C], forget).decision).toBe(
      "rejected",
    );
  });
  it("Mehrere Kandidaten → jeder Treffer einzeln Ziel (alle drei)", () => {
    const ids = [A, B, C].map((n) => validateCandidate(cand(n.content), [A, B, C], forget).nodeId);
    expect(ids).toEqual(["A", "B", "C"]);
  });
  it("findRelatedNode nutzt nur candidate.value/category – kein Signaltext", () => {
    expect(findRelatedNode(cand("Der Nutzer nutzt RTX 5070."), [A, B, C])?.id).toBe("A");
  });
});
