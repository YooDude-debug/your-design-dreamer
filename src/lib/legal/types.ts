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

// Zusätzliche Sprachvarianten der Hinweistexte (für EN/EL-Fassungen der Dokumente).
// Die ursprünglichen deutschen Exporte oben bleiben für scripts/legal-pdf.ts unverändert.
export const REVIEW_TECH_EN = "[LEGALLY/TECHNICALLY TO BE REVIEWED]";
export const REVIEW_LAWYER_EN = "[LEGAL REVIEW BY A LAWYER PENDING]";
export const LEGAL_NOTICE_EN = "Technical draft for legal review – not yet reviewed by a lawyer.";

export const REVIEW_TECH_EL = "[ΠΡΟΣ ΝΟΜΙΚΟ/ΤΕΧΝΙΚΟ ΕΛΕΓΧΟ]";
export const REVIEW_LAWYER_EL = "[ΕΚΚΡΕΜΕΙ ΝΟΜΙΚΟΣ ΕΛΕΓΧΟΣ ΑΠΟ ΔΙΚΗΓΟΡΟ]";
export const LEGAL_NOTICE_EL =
  "Τεχνικό προσχέδιο προς νομικό έλεγχο – δεν έχει ελεγχθεί ακόμη από δικηγόρο.";

/**
 * Stand der Fassung 3.1 (Ergänzung Y-Dude Market und Zahlungsabwicklung).
 * LEGAL_DATE bleibt unverändert, damit unveränderte Dokumente (Richtlinien)
 * und die bestehenden PDF-Kopien ihren ursprünglichen Stand behalten.
 */
export const LEGAL_DATE_V31 = "27. August 2026";
