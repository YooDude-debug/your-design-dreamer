// P5-D6: rein diagnostisch. Keine Produktivänderung, keine DB, keine externe API.
import { describe, it, expect } from "vitest";
import { contentTokens, normKey, similarity, topicsOf } from "@/orb-core/memory";
import { infoDomainsOf, questionIntentOf, topicAffinity } from "@/orb-core/recall";
import { userSignalsFrom } from "@/orb-core/analysis/validate";
import { detectConfirmationSignal } from "@/orb-core/confirmation-signal";

const MEM = {
  A: "Der Nutzer nutzt eine RTX 5070 Grafikkarte.",
  B: "Der Nutzer arbeitet als Koch.",
  C: "Der Nutzer wohnt in Leipzig.",
} as const;

/** Nur bestehende Funktionen: Wortüberlappung ODER gemeinsamer Informationsbereich. */
function probe(text: string) {
  const domains = infoDomainsOf(text);
  const hits = (Object.keys(MEM) as (keyof typeof MEM)[]).filter((k) => {
    const sim = similarity(text, MEM[k]);
    const dom = infoDomainsOf(MEM[k]).some((d) => domains.includes(d));
    return sim > 0 || dom;
  });
  return {
    tokens: contentTokens(text),
    domains,
    topics: topicsOf(text),
    normKey: normKey(text),
    sim: Object.fromEntries(
      Object.entries(MEM).map(([k, v]) => [k, Number(similarity(text, v).toFixed(2))]),
    ),
    affinity: Object.fromEntries(Object.entries(MEM).map(([k, v]) => [k, topicAffinity(text, v)])),
    hits,
    verdict: hits.length === 0 ? "KEIN" : hits.length === 1 ? "EINDEUTIG" : "MEHRDEUTIG",
  };
}

const CASES: [string, string, string[]][] = [
  ["A", "Vergiss die RTX.", ["A"]],
  ["B", "Vergiss meine Grafikkarte.", ["A"]],
  ["C", "Vergiss meinen Beruf.", ["B"]],
  ["D", "Vergiss meinen Wohnort.", ["C"]],
  ["E", "Vergiss Leipzig.", ["C"]],
  ["F", "Vergiss X.", []],
  ["G", "Vergiss die RTX und meinen Beruf.", ["A", "B"]],
];

describe("P5-D6 Zielauflösung nur mit bestehenden Bausteinen", () => {
  for (const [id, text, expected] of CASES)
    it(`${id}: "${text}"`, () => {
      const p = probe(text);
      process.stdout.write(`CASE ${id} ${JSON.stringify(p)}\n`);
      expect(p.hits).toEqual(expected);
      expect(userSignalsFrom([text]).forget).toBe(true); // Signal selbst trägt kein Ziel
      expect(questionIntentOf(text)).toBeNull(); // Chat-Recall-Affinität greift nur bei Fragen
      expect(Object.values(p.affinity).every((v) => v === 0)).toBe(true);
    });
  it("Konflikt: allgemeines Wort in zwei Memories → mehrdeutig, kein Eindeutigkeitswert", () => {
    const mem = [
      "Der Nutzer kauft eine Grafikkarte.",
      "Der Nutzer nutzt eine RTX 5070 Grafikkarte.",
    ];
    const text = "Vergiss meine Grafikkarte.";
    const scores = mem.map((m) => Number(similarity(text, m).toFixed(2)));
    const doms = mem.map((m) => infoDomainsOf(m).includes("hardware"));
    process.stdout.write(`CONFLICT sim=${scores} dom=${doms}\n`);
    expect(doms).toEqual([true, true]);
    expect(scores.every((s) => s > 0)).toBe(true);
  });
});

describe("P5-D6 Deiktisch und Negation", () => {
  for (const s of ["Vergiss das.", "Vergiss diese.", "Vergiss diese Memory.", "Vergiss den."])
    it(`"${s}" → forget=true, keine Inhaltswörter/Domain für ein Ziel`, () => {
      const p = probe(s);
      expect(userSignalsFrom([s]).forget).toBe(true);
      expect(p.domains).toEqual([]);
      expect(p.hits).toEqual([]);
      expect(detectConfirmationSignal(s)).toBe("NONE");
    });
  const NEG: [string, { forget: boolean; explicitRemember: boolean }][] = [
    ["Vergiss das nicht!", { forget: true, explicitRemember: false }],
    ["Vergiss X nicht.", { forget: true, explicitRemember: false }],
    ["Nicht vergessen.", { forget: false, explicitRemember: true }],
    ["Ich habe X vergessen.", { forget: false, explicitRemember: false }],
    ["Ich werde X nicht vergessen.", { forget: false, explicitRemember: true }],
  ];
  for (const [s, exp] of NEG)
    it(`Negation "${s}"`, () => {
      const sig = userSignalsFrom([s]);
      process.stdout.write(`NEG ${s} ${JSON.stringify(sig)}\n`);
      expect(sig).toMatchObject(exp);
    });
  it("Beide Signale gleichzeitig möglich (kein Vorrang im Signal selbst)", () => {
    expect(userSignalsFrom(["Vergiss das nicht, merk dir das!"])).toMatchObject({
      forget: true,
      explicitRemember: true,
    });
  });
});
