/**
 * Gemeinsame Datenstruktur für die rechtlichen Dokumente.
 * Diese Struktur ist die einzige Quelle für die im Projekt angezeigten
 * Dokumente UND für die daraus erzeugten PDF-Kopien (scripts/legal-pdf.ts).
 */
export type LegalDocSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDoc = {
  slug: "datenschutz" | "agb" | "richtlinien";
  title: string;
  version: string;
  date: string;
  /** Kurzer Hinweis auf den Prüfstatus – erscheint auf Seite und im PDF. */
  notice: string;
  intro?: string;
  sections: LegalDocSection[];
};

export const REVIEW_TECH = "[RECHTLICH/TECHNISCH ZU PRÜFEN]";
export const REVIEW_LAWYER = "[RECHTLICHE PRÜFUNG DURCH ANWALT]";
export const LEGAL_NOTICE = "Technischer Stand zur rechtlichen Prüfung – nicht anwaltlich geprüft.";
export const LEGAL_DATE = "10. August 2026";
