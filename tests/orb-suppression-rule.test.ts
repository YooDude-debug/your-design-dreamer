import { describe, expect, it } from "vitest";

import { readUserControl } from "@/orb-core/impulse";

/**
 * Regressionstests zur bestätigten Suppression-Fehlauslösung.
 * Grundlage: docs/ORB_AUTONOMOUS_SUPPRESSION_FIX_DESIGN_2026-09-22.md (Variante 3).
 * Geprüft wird ausschliesslich die deterministische Abwink-Erkennung.
 */
describe("ORB Suppression-Regel – eindeutiger Nutzerintent", () => {
  const suppresses = (text: string) => readUserControl([text]).preference === "suppress";

  describe("positive Suppression – eindeutige Wendungen", () => {
    const positives = [
      "hör auf zu fragen",
      "frag nicht weiter",
      "keine weiteren Fragen",
      "stell mir jetzt keine Frage",
      "nicht weiter fragen",
      "nie wieder fragen",
      "Nicht jetzt, bitte später",
      "Frag mich das nie wieder",
    ];
    for (const text of positives) {
      it(`erkennt „${text}" als Abwinken`, () => {
        expect(suppresses(text)).toBe(true);
      });
    }
  });

  describe("keine Suppression – Alltagswörter im Satz", () => {
    const negatives = [
      "auch. haben wir später frieden beschlossen ?",
      "wir machen das später",
      "egal wie das ausgeht",
      "das ist mir nicht egal",
      "das passiert immer",
      "ich weiß nicht warum",
      "keine Ahnung, vielleicht 2019",
      "das war unwichtig für die Entscheidung",
      "lass das mal so stehen",
    ];
    for (const text of negatives) {
      it(`unterdrückt nicht bei „${text}"`, () => {
        expect(suppresses(text)).toBe(false);
      });
    }
  });

  it("deutet eine Bitte um weitere Fragen nicht als Abwinken", () => {
    expect(suppresses("ich will nicht, dass du aufhörst zu fragen")).toBe(false);
  });

  it("erhält die ausdrückliche Einladung", () => {
    expect(readUserControl(["Frag ruhig nach"]).preference).toBe("allow");
  });

  it("erkennt eine dauerhafte Ablehnung weiterhin als dauerhaft", () => {
    const control = readUserControl(["Frag mich das nie wieder"]);
    expect(control.preference).toBe("suppress");
    expect(control.permanent).toBe(true);
  });

  it("macht aus einer reinen Zeitangabe keine dauerhafte Ablehnung", () => {
    const control = readUserControl(["das passiert immer"]);
    expect(control.preference).toBe("unset");
    expect(control.permanent).toBe(false);
  });
});
