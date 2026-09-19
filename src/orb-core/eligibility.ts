/**
 * ORB Core – Belastbarkeit von Erinnerungen (rein, deterministisch).
 *
 * Diese Datei enthält KEINE Gedächtnisformeln: sie berührt weder Wichtigkeit,
 * Konfidenz, Verfall, Relevanz noch die Speicherschwelle (0.35). Sie beantwortet
 * ausschliesslich zwei Fragen:
 *
 *  1. Ist eine Äusserung überhaupt eine eigene Angabe des Benutzers (Aussage) –
 *     oder nur eine Frage, eine Aufforderung oder ein Fragment?
 *  2. Darf ein bereits gefundener Knoten als belastbare „aktive Erinnerung“ an
 *     den Sprachkontext weitergegeben werden?
 *
 * Kernprinzip: gefunden ≠ belastbar.
 * VERGESSEN ≠ LÖSCHEN – hier wird nichts entfernt und nichts umgeschrieben.
 * Keine KI, keine Netzabfrage, keine Datenbank.
 */

/** Äusserungsart einer Benutzereingabe. */
export type UtteranceKind = "statement" | "question" | "request" | "fragment";

/** Aufforderungen/Anweisungen – keine eigene Tatsachenangabe. */
const REQUEST_RE =
  /^(bitte\b|merk(?:e|st)?\s+dir\b|merk\s|speicher|behalte?\b|vergiss\b|frag\s+mich\b|erzähl|erzaehl|sag\s+mir\b|zeig\s|erkläre|erklaere|hilf\s|nenne?\s|gib\s+mir\b|mach\s|antworte\b|remember\b|tell\s+me\b|show\s+me\b)/i;

/** Fragewörter/Fragezeichen – keine eigene Tatsachenangabe. */
const QUESTION_RE =
  /(\?|^\s*(welche[rnms]?|was|wie|wo|wann|warum|wieso|woher|womit|wer|wen|wem|kannst|kennst|weisst|weißt|hast|habe\s+ich|which|what|how|where|when|who|do\s+you|can\s+you)\b)/i;

/** Sehr einfache Füllwörter – tragen keine eigene Information. */
const FILLER = new Set([
  "ja",
  "nein",
  "ok",
  "okay",
  "gut",
  "danke",
  "hallo",
  "hi",
  "hey",
  "genau",
  "klar",
  "vielleicht",
  "hm",
  "hmm",
  "aha",
  "yes",
  "no",
  "thanks",
]);

/** Wörter, die eine Äusserung als ausdrückliche Korrektur kennzeichnen. */
const CORRECTION_RE =
  /\b(tippfehler|schreibfehler|vertippt|verschrieben|war\s+falsch|ist\s+falsch|stimmt\s+nicht|korrektur|sollte\s+heissen|sollte\s+heißen|meinte\s+ich|typo)\b/i;

/** Bedeutungstragende Wörter einer Äusserung (kurze Füllwörter fallen weg). */
function informativeWords(text: string): string[] {
  return (text ?? "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0 && !FILLER.has(w));
}

/**
 * Äusserungsart. Reihenfolge ist die Begründung: eine Aufforderung bleibt eine
 * Aufforderung, auch wenn sie ein Fragezeichen enthält.
 */
export function utteranceKind(text: string): UtteranceKind {
  const t = (text ?? "").trim();
  if (t.length === 0) return "fragment";
  if (REQUEST_RE.test(t)) return "request";
  if (QUESTION_RE.test(t)) return "question";
  const words = informativeWords(t);
  // Ohne bedeutungstragenden Inhalt liegt keine belastbare Angabe vor.
  if (words.length === 0) return "fragment";
  if (words.length === 1 && words[0]!.length <= 3 && !/\d/.test(t)) return "fragment";
  return "statement";
}

/**
 * Darf diese Äusserung als persönliche Tatsachen-Erinnerung gespeichert werden?
 * Nur echte Aussagen. Die Schwelle 0.35 und die bestehenden Formeln entscheiden
 * danach weiterhin unverändert, OB gespeichert wird.
 */
export function isStorableStatement(text: string): boolean {
  return utteranceKind(text) === "statement";
}

/** Ausdrückliche Korrektur einer früheren Angabe (z. B. „Eier war ein Tippfehler“). */
export function isCorrection(text: string): boolean {
  return CORRECTION_RE.test(text ?? "");
}

/**
 * Das in einer Korrektur benannte falsche Wort, sofern erkennbar.
 * Beispiel: „Eier war ein Tippfehler.“ → „eier“.
 */
export function correctedTerm(text: string): string | null {
  const t = (text ?? "").trim();
  if (!isCorrection(t)) return null;
  const quoted = /[„"'»]([^„"'»«]{2,40})[“"'«]/.exec(t);
  if (quoted?.[1]) return quoted[1].trim().toLowerCase();
  const leading = /^\s*([\p{L}\p{N}-]{3,40})\s+(?:war|ist|sollte)\b/u.exec(t);
  if (leading?.[1] && !FILLER.has(leading[1].toLowerCase())) return leading[1].toLowerCase();
  return null;
}

/**
 * Ist ein gespeicherter Knoteninhalt als belastbare aktive Erinnerung geeignet?
 *
 * Reine Fragen, Aufforderungen und Fragmente bleiben gespeichert (nichts wird
 * gelöscht), gelten aber nicht als bestätigte persönliche Tatsache und gehen
 * deshalb nicht als „Aktive Erinnerung“ in den Sprachkontext.
 */
export function isReliableMemoryContent(content: string): boolean {
  const kind = utteranceKind(content);
  if (kind !== "statement") return false;
  // Eine Korrekturmeldung selbst ist keine Tatsachenangabe über den Benutzer.
  if (isCorrection(content)) return false;
  return true;
}

/**
 * Deterministischer Filter direkt vor der Sprachschicht:
 * Recall → gefundene Knoten → Belastbarkeit → aktive Erinnerungen → LLM.
 *
 * `correctedTerms` stammt aus dem flüchtigen Gesprächskontext: ein vom Benutzer
 * ausdrücklich als Tippfehler benanntes Wort macht betroffene Inhalte für diesen
 * Kontext unbelastbar, ohne sie zu löschen.
 */
export function selectReliableMemories<T extends { content: string }>(
  found: T[],
  correctedTerms: string[] = [],
): T[] {
  const terms = correctedTerms.map((t) => t.toLowerCase()).filter((t) => t.length >= 3);
  return found.filter((f) => {
    if (!isReliableMemoryContent(f.content)) return false;
    const lower = f.content.toLowerCase();
    return !terms.some((t) => lower.includes(t));
  });
}
