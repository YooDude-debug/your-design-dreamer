/**
 * P5-B1 – READ-ONLY-DIAGNOSE. Keine Produktivlogik, keine Memory-Wirkung.
 * Dokumentiert ausschliesslich, was BESTEHENDE Funktionen heute liefern.
 * Die Kategorien existieren nur in dieser Testdatei.
 */
import { describe, expect, it } from "vitest";
import {
  correctedTerm,
  isCorrection,
  isStorableStatement,
  utteranceKind,
} from "@/orb-core/eligibility";
import { polarityOf } from "@/orb-core/continuity";
import { parseProcessDecision } from "@/orb-core/process";
import { resolveReplyReference } from "@/orb-core/memory-usage";
import { REPLY_REF_KEY, userReplySnapshot } from "@/orb-core/reply-reference-snapshot";

type Diag =
  | "CONFIRMED_SINGLE"
  | "CONFIRMED_MULTIPLE"
  | "AMBIGUOUS"
  | "REJECTED"
  | "LEARNING"
  | "NONE";

/** Nur aus bestehenden Funktionen abgeleitet. Es existiert KEIN positives Signal im Code. */
function existingPositiveSignal(_text: string): boolean {
  return false;
}

function diagnose(text: string, visibleIds: string[] | null): Diag {
  const positive = existingPositiveSignal(text);
  if (isCorrection(text) && correctedTerm(text) !== null) return "REJECTED";
  if (positive) {
    if (!visibleIds || visibleIds.length === 0) return "NONE";
    if (visibleIds.length === 1) return "CONFIRMED_SINGLE";
    return "AMBIGUOUS"; // CONFIRMED_MULTIPLE ist im bestehenden System nicht beweisbar
  }
  if (isStorableStatement(text)) return "LEARNING";
  return "NONE";
}

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const ORB = "33333333-3333-4333-8333-333333333333";

function orbRow(ids: string[]) {
  return { id: ORB, role: "orb", created_at: "2026-09-25T07:00:00Z", state_snapshot: { model_visible_memory_ids: ids } };
}

describe("P5-B1 C1-Kette", () => {
  it("User-Snapshot → ORB-Zeile → sichtbare IDs (single)", () => {
    const ref = resolveReplyReference(ORB, orbRow([A]));
    expect(userReplySnapshot(ref)).toEqual({ [REPLY_REF_KEY]: ORB });
    expect(ref.referencedModelVisibleMemoryIds).toEqual([A]);
  });
  it("multi: beide IDs geladen, keine Reihenfolge-Semantik", () => {
    expect(resolveReplyReference(ORB, orbRow([A, B])).referencedModelVisibleMemoryIds).toEqual([A, B]);
  });
  it("alte ORB-Zeile ohne Tracking → null (nicht leer)", () => {
    const ref = resolveReplyReference(ORB, { id: ORB, role: "orb", created_at: "x", state_snapshot: {} });
    expect(ref.referencedModelVisibleMemoryIds).toBeNull();
  });
});

const TABLE: Array<[string, string, boolean, boolean, string]> = [
  // text, utteranceKind, isStorableStatement, isCorrection, polarity
  ["Ja", "fragment", false, false, "neutral"],
  ["Ja.", "fragment", false, false, "neutral"],
  ["Genau", "fragment", false, false, "neutral"],
  ["Ja, genau", "fragment", false, false, "neutral"],
  ["Genau das", "fragment", false, false, "neutral"],
  ["Stimmt", "statement", true, false, "neutral"],
  ["Richtig", "statement", true, false, "neutral"],
  ["Das stimmt", "statement", true, false, "neutral"],
  ["Ja, das stimmt", "statement", true, false, "neutral"],
  ["Nein", "fragment", false, false, "neutral"],
  ["Nein.", "fragment", false, false, "neutral"],
  ["Nein, das stimmt nicht", "statement", true, true, "negativ"],
  ["Das stimmt nicht", "statement", true, true, "negativ"],
  ["Ich bin Koch", "statement", true, false, "neutral"],
  ["Ja, ich bin Koch", "statement", true, false, "neutral"],
  ["Koch bin ich", "statement", true, false, "neutral"],
  ["Ja, der erste Punkt.", "statement", true, false, "neutral"],
  ["Ja, der Koch.", "statement", true, false, "neutral"],
  ["Ja, die Grafikkarte.", "statement", true, false, "neutral"],
  ["Genau die RTX.", "statement", true, false, "neutral"],
  ["Stimmt, ich bin Koch.", "statement", true, false, "neutral"],
];

describe("P5-B1 bestehende Signale (IST)", () => {
  it.each(TABLE)("%s", (t, kind, storable, corr, pol) => {
    expect(utteranceKind(t)).toBe(kind);
    expect(isStorableStatement(t)).toBe(storable);
    expect(isCorrection(t)).toBe(corr);
    expect(correctedTerm(t)).toBeNull(); // nie eine Memory-Zuordnung
    expect(polarityOf(t)).toBe(pol);
    expect(parseProcessDecision(t)).toBeNull(); // Prozess-Bestätigung greift nicht
  });
});

describe("P5-B1 Diagnose-Kategorien", () => {
  it("Single „Ja.“ → NONE (kein positives Signal im Code)", () => {
    expect(diagnose("Ja.", [A])).toBe("NONE");
  });
  it("Multi „Ja.“ → keine ID gewählt", () => {
    const d = diagnose("Ja.", [A, B]);
    expect(d).not.toBe("CONFIRMED_SINGLE");
    expect(d).not.toBe("CONFIRMED_MULTIPLE");
  });
  it("Learning bleibt Learning", () => {
    for (const t of ["Ich bin Koch", "Ja, ich bin Koch", "Koch bin ich"]) expect(diagnose(t, [A])).toBe("LEARNING");
  });
  it("Negation nie positive Confirmation", () => {
    for (const t of ["Nein.", "Nein, das stimmt nicht", "Das stimmt nicht"]) {
      expect(["CONFIRMED_SINGLE", "CONFIRMED_MULTIPLE"]).not.toContain(diagnose(t, [A]));
    }
  });
  it("Keine Memory-Daten verändert", () => {
    const node = { id: A, activation_count: 3, importance: 0.6, safety: 0.5, last_accessed_at: "t", content: "Koch" };
    const before = JSON.stringify(node);
    for (const [t] of TABLE) diagnose(t, [A, B]);
    resolveReplyReference(ORB, orbRow([A]));
    expect(JSON.stringify(node)).toBe(before);
  });
});
