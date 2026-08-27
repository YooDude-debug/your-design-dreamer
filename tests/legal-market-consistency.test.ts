/**
 * Konsistenzprüfung Rechtstexte ↔ tatsächliche Market-/Zahlungsfunktion.
 *
 * Der Test hält fest, was Code und Datenmodell belegen, und verhindert, dass
 * die Rechtstexte wieder hinter den Funktionsumfang zurückfallen (z. B. die
 * Aussage „kostenlose Plattform“ trotz Stripe-Abrechnung).
 */
import { describe, expect, it } from "vitest";
import { PRIVACY_DOCS, TERMS_DOCS } from "@/lib/legal";
import type { LegalDoc } from "@/lib/legal/types";

const LANGS = ["de", "en", "el"] as const;

function text(doc: LegalDoc): string {
  return doc.sections
    .flatMap((s) => [s.title, ...(s.paragraphs ?? []), ...(s.bullets ?? [])])
    .join("\n")
    .toLowerCase();
}

describe("AGB: Y-Dude Market", () => {
  it.each(LANGS)("beschreibt den Market in der Fassung %s", (lang) => {
    const doc = TERMS_DOCS[lang];
    expect(doc.version).toBe("3.1");
    const t = text(doc);
    for (const needle of ["market", "stripe"]) expect(t).toContain(needle);
  });

  it.each(LANGS)("stellt in %s klar, dass Y-Dude nicht Verkäufer ist", (lang) => {
    const t = text(TERMS_DOCS[lang]);
    const claims = ["nicht verkäufer", "not the seller", "δεν είναι πωλητής"];
    expect(claims.some((c) => t.includes(c))).toBe(true);
  });

  it.each(LANGS)("nennt in %s Plattformgebühr, Versand und Erstattung", (lang) => {
    const t = text(TERMS_DOCS[lang]);
    const groups = [
      ["plattformgebühr", "platform fee", "προμήθεια πλατφόρμας"],
      ["versand", "shipping", "αποστολή"],
      ["erstattung", "refund", "επιστροφ"],
      ["widerruf", "withdrawal", "υπαναχώρησ"],
    ];
    for (const g of groups) expect(g.some((n) => t.includes(n))).toBe(true);
  });

  it("behauptet in der deutschen Fassung keine durchgängig kostenlose Plattform", () => {
    const t = text(TERMS_DOCS.de);
    expect(t).not.toContain("y-dude stellt eine kostenlose plattform bereit");
    expect(t).toContain("kostenpflichtig");
  });
});

describe("Datenschutz: Market und Zahlungsdienstleister", () => {
  it.each(LANGS)("nennt in %s Stripe als eingesetzten Dienst", (lang) => {
    const doc = PRIVACY_DOCS[lang];
    expect(doc.version).toBe("3.1");
    expect(text(doc)).toContain("stripe");
  });

  it.each(LANGS)("beschreibt in %s Versandadresse und Transaktionsdaten", (lang) => {
    const t = text(PRIVACY_DOCS[lang]);
    const groups = [
      ["lieferadresse", "delivery address", "διεύθυνση παράδοσης"],
      ["transaktion", "transaction", "συναλλαγ"],
    ];
    for (const g of groups) expect(g.some((n) => t.includes(n))).toBe(true);
  });
});
