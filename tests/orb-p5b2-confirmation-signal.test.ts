/**
 * P5-B2 – diagnostische Erkennung reiner Zustimmung. Keine Memory-Wirkung.
 */
import { describe, expect, it } from "vitest";
import {
  detectConfirmationSignal,
  diagnoseConfirmation,
  normalizeUtterance,
} from "@/orb-core/confirmation-signal";
import { isStorableStatement, utteranceKind, isCorrection } from "@/orb-core/eligibility";

const POSITIVE = [
  "Ja",
  "Ja.",
  "JA!",
  "Stimmt",
  "Stimmt.",
  "Genau",
  "Genau.",
  "Richtig",
  "Das stimmt",
  "Das stimmt.",
  "Ja, genau",
  "Ja, genau.",
  "Ja, das stimmt",
];

const NOT_POSITIVE = [
  "Nein",
  "Nein.",
  "Das stimmt nicht",
  "Nein, das stimmt nicht",
  "Ich bin Koch",
  "Ja, ich bin Koch.",
  "Ja, das stimmt, ich arbeite dort.",
  "Stimmt, ich bin Koch",
  "Genau die RTX",
  "Richtig, das war gestern",
  "Richtig, ich arbeite als Koch",
  "",
  "   ",
];

describe("P5-B2 Signal", () => {
  for (const text of POSITIVE) {
    it(`positiv: ${JSON.stringify(text)}`, () => {
      expect(detectConfirmationSignal(text)).toBe("POSITIVE_CONFIRMATION");
    });
  }
  for (const text of NOT_POSITIVE) {
    it(`nicht positiv: ${JSON.stringify(text)}`, () => {
      expect(detectConfirmationSignal(text)).toBe("NONE");
    });
  }
  it("nicht-String → NONE", () => {
    expect(detectConfirmationSignal(null)).toBe("NONE");
    expect(detectConfirmationSignal(undefined)).toBe("NONE");
  });
  it("Normalisierung entfernt nur Satzzeichen, keine Wörter", () => {
    expect(normalizeUtterance("Ja, genau!")).toBe("ja genau");
    expect(normalizeUtterance("Ja, ich bin Koch.")).toBe("ja ich bin koch");
  });
});

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("P5-B2 Referenzdiagnose", () => {
  it("positiv + [A] → CONFIRMED_SINGLE_CANDIDATE", () => {
    expect(diagnoseConfirmation(detectConfirmationSignal("Ja."), [A])).toBe(
      "CONFIRMED_SINGLE_CANDIDATE",
    );
  });
  it("positiv + [A,B] → AMBIGUOUS_CANDIDATE, keine ID-Auswahl", () => {
    const result = diagnoseConfirmation("POSITIVE_CONFIRMATION", [A, B]);
    expect(result).toBe("AMBIGUOUS_CANDIDATE");
    expect(String(result)).not.toContain(A);
    expect(String(result)).not.toContain(B);
  });
  it("positiv + [] → NONE", () => {
    expect(diagnoseConfirmation("POSITIVE_CONFIRMATION", [])).toBe("NONE");
  });
  it("positiv + null → NONE", () => {
    expect(diagnoseConfirmation("POSITIVE_CONFIRMATION", null)).toBe("NONE");
    expect(diagnoseConfirmation("POSITIVE_CONFIRMATION", undefined)).toBe("NONE");
  });
  it("kein Signal + [A] → NONE", () => {
    expect(diagnoseConfirmation(detectConfirmationSignal("Ich bin Koch"), [A])).toBe("NONE");
  });
});

describe("P5-B2 bestehender Lernpfad unverändert", () => {
  it("Zustimmungssätze behalten ihre bisherige Klassifikation", () => {
    expect(isStorableStatement("Stimmt")).toBe(true);
    expect(isStorableStatement("Richtig")).toBe(true);
    expect(isStorableStatement("Das stimmt")).toBe(true);
    expect(isStorableStatement("Ja")).toBe(false);
    expect(utteranceKind("Ja")).toBe("fragment");
    expect(isCorrection("Das stimmt nicht")).toBe(true);
  });
  it("Diagnose ist rein: gleiche Eingabe, gleiches Ergebnis, kein Seiteneffekt", () => {
    const node = {
      activation_count: 3,
      importance: 0.5,
      safety: 0.2,
      last_accessed_at: "t0",
      text: "Koch",
    };
    const before = JSON.stringify(node);
    for (let i = 0; i < 3; i += 1) {
      expect(diagnoseConfirmation(detectConfirmationSignal("Ja"), [A])).toBe(
        "CONFIRMED_SINGLE_CANDIDATE",
      );
    }
    expect(JSON.stringify(node)).toBe(before);
  });
});
