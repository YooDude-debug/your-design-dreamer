import { describe, expect, it } from "vitest";
import { evaluateUsageEvidence } from "@/orb-core/memory-usage-evidence";

const gpu = { id: "m1", content: "Nutzer besitzt eine RTX5070 Grafikkarte" };
const city = { id: "m2", content: "Nutzer wohnt in Musterstadt" };
const hobby = { id: "m3", content: "Nutzer spielt gern Schach" };

const by = (r: ReturnType<typeof evaluateUsageEvidence>, id: string) => r.find((e) => e.id === id)!;

describe("Phase 2E usage evidence", () => {
  it("direkte Verwendung → contributed", () => {
    const r = evaluateUsageEvidence({
      retrieved: [gpu], suppliedIds: ["m1"],
      userText: "Welches Spiel läuft bei mir flüssig?",
      replyText: "Mit deiner RTX5070 läuft das gut.",
    });
    expect(by(r, "m1")).toEqual({ id: "m1", status: "contributed", reason: "exclusive_verbatim_reference" });
  });

  it("mehrere verwendete Erinnerungen", () => {
    const r = evaluateUsageEvidence({
      retrieved: [gpu, city], suppliedIds: ["m1", "m2"], userText: "Tipps?",
      replyText: "In Musterstadt gibt es einen Laden für deine RTX5070.",
    });
    expect(r.map((e) => e.status)).toEqual(["contributed", "contributed"]);
  });

  it("gefunden, aber nicht bereitgestellt → retrieved", () => {
    const r = evaluateUsageEvidence({
      retrieved: [gpu, city], suppliedIds: ["m1"], userText: "x",
      replyText: "Musterstadt und RTX5070.",
    });
    expect(by(r, "m2")).toMatchObject({ status: "retrieved", reason: "not_supplied" });
  });

  it("bereitgestellt, aber nicht verwendet → supplied", () => {
    const r = evaluateUsageEvidence({
      retrieved: [city], suppliedIds: ["m1", "m2"], userText: "Wie spät?",
      replyText: "Es ist Mittag.",
    });
    expect(by(r, "m2")).toMatchObject({ status: "supplied", reason: "no_reference_in_reply" });
  });

  it("nur thematische Nähe zählt nicht", () => {
    const r = evaluateUsageEvidence({
      retrieved: [hobby], suppliedIds: ["m3"], userText: "Brettspiele?",
      replyText: "Strategiespiele trainieren das Denken.",
    });
    expect(by(r, "m3").status).not.toBe("contributed");
  });

  it("Echo der Nutzernachricht → unknown", () => {
    const r = evaluateUsageEvidence({
      retrieved: [gpu], suppliedIds: ["m1"], userText: "Ist die RTX5070 gut?",
      replyText: "Die RTX5070 ist gut.",
    });
    expect(by(r, "m1")).toMatchObject({ status: "unknown", reason: "reference_echoes_user_input" });
  });

  it("geteiltes Merkmal mehrerer Erinnerungen → unknown", () => {
    const a = { id: "a", content: "Termin am Montag in Musterstadt" };
    const b = { id: "b", content: "Schwester wohnt in Musterstadt" };
    const r = evaluateUsageEvidence({
      retrieved: [a, b], suppliedIds: ["a", "b"], userText: "?", replyText: "Musterstadt passt.",
    });
    expect(r.map((e) => e.status)).toEqual(["unknown", "unknown"]);
  });

  it("widersprüchliche Erinnerungen beide belegt → unknown", () => {
    const a = { id: "a", content: "arbeitet bei Firmaalpha" };
    const b = { id: "b", content: "arbeitet bei Firmabeta" };
    const r = evaluateUsageEvidence({
      retrieved: [a, b], suppliedIds: ["a", "b"], userText: "?",
      replyText: "Firmaalpha oder Firmabeta?", contradictions: [["a", "b"]],
    });
    expect(r.map((e) => e.reason)).toEqual(["contradiction_both_referenced", "contradiction_both_referenced"]);
  });

  it("Widerspruch, nur eine Seite belegt → contributed", () => {
    const a = { id: "a", content: "arbeitet bei Firmaalpha" };
    const b = { id: "b", content: "arbeitet bei Firmabeta" };
    const r = evaluateUsageEvidence({
      retrieved: [a, b], suppliedIds: ["a", "b"], userText: "?",
      replyText: "Bei Firmabeta.", contradictions: [["a", "b"]],
    });
    expect(r.map((e) => e.status)).toEqual(["supplied", "contributed"]);
  });
});
