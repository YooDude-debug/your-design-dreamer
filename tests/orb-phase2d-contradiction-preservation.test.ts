import { describe, expect, it } from "vitest";
import {
  planContradiction,
  type PreservationStatement,
} from "@/orb-core/contradiction-preservation";

const s = (
  value: string,
  text = "",
  source: PreservationStatement["source"] = "user_stated",
): PreservationStatement => ({
  subject: "nutzer",
  predicate: "arbeitgeber",
  value,
  source,
  observedAt: "2026-01-01T00:00:00Z",
  text,
});

describe("Phase 2D – Contradiction Preservation", () => {
  it("Firma A → 'jetzt bei Firma B' = zeitliche Veränderung, nichts überschrieben", () => {
    const p = planContradiction(s("Firma A"), s("Firma B", "Ich arbeite jetzt bei Firma B"));
    expect(p).toMatchObject({
      kind: "temporal_change",
      overwriteExisting: false,
      keepNew: true,
      relation: "supersedes_in_time",
      current: "new",
    });
  });
  it("anderer Wert ohne Marker = Widerspruch, beide erhalten, keine Wahrheitsentscheidung", () => {
    const p = planContradiction(s("Firma A"), s("Firma B", "Ich arbeite bei Firma B"));
    expect(p).toMatchObject({
      kind: "contradiction",
      overwriteExisting: false,
      keepNew: true,
      relation: "contradicts",
      current: null,
    });
  });
  it("ausdrückliche Ergänzung ist kein Widerspruch", () => {
    expect(planContradiction(s("Firma A"), s("Firma B", "Ich arbeite auch bei Firma B")).kind).toBe(
      "supplement",
    );
  });
  it("gleicher Wert = Duplikat, keine neue Erinnerung", () => {
    expect(planContradiction(s("Firma A"), s("firma a ")).kind).toBe("duplicate");
  });
  it("Wortähnlichkeit bei anderem Bezug ist kein Widerspruch", () => {
    const p = planContradiction(s("Firma A"), { ...s("Firma A"), predicate: "wohnort" });
    expect(p.kind).toBe("unrelated");
  });
  it("Vermutung verdrängt bestätigten Fakt nie – auch mit Zeitmarker", () => {
    const p = planContradiction(
      s("Firma A"),
      s("Firma B", "arbeitet jetzt wohl bei Firma B", "inferred"),
    );
    expect(p).toMatchObject({
      kind: "contradiction",
      current: null,
      existingClass: "confirmed",
      newClass: "inferred",
      reason: "inference_cannot_supersede_confirmed",
      overwriteExisting: false,
    });
  });
  it("unvollständige Struktur = unbekannt", () => {
    expect(planContradiction(s(""), s("Firma B")).kind).toBe("unknown");
  });
});
