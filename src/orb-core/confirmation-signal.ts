/**
 * P5-B2: rein diagnostische Erkennung reiner Zustimmungssätze.
 *
 * Diese Datei hat KEINE Wirkung auf Memories: sie liest keine Datenbank,
 * schreibt nichts, wählt keine Memory-ID aus, verändert weder
 * activation_count, importance, safety, last_accessed_at noch Memory-Inhalte.
 * Sie ersetzt keine bestehende Lernlogik; bestehende Pfade bleiben unberührt.
 */

/** Signal einer Äußerung. Es existiert absichtlich kein Negativ-Signal. */
export type ConfirmationSignal = "NONE" | "POSITIVE_CONFIRMATION";

/** Diagnosestufe. "CANDIDATE" bedeutet ausdrücklich: NOCH KEINE WIRKUNG. */
export type ConfirmationDiagnosis = "NONE" | "CONFIRMED_SINGLE_CANDIDATE" | "AMBIGUOUS_CANDIDATE";

/** Abschliessende Liste erlaubter reiner Zustimmungsformen (normalisiert). */
export const PURE_CONFIRMATIONS = [
  "ja",
  "stimmt",
  "genau",
  "richtig",
  "das stimmt",
  "ja genau",
  "ja das stimmt",
] as const;

const PURE_SET = new Set<string>(PURE_CONFIRMATIONS);

/**
 * Normalisierung: Kleinschreibung, übliche Satzzeichen entfernen,
 * Leerraum zusammenfassen. Es werden keine Wörter entfernt oder ersetzt,
 * damit inhaltstragende Sätze niemals auf eine Zustimmungsform verkürzt werden.
 */
export function normalizeUtterance(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,;:!?…"“”„'’\-–—()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Liefert POSITIVE_CONFIRMATION ausschliesslich für eine der erlaubten
 * reinen Zustimmungsformen. Jede zusätzliche Aussage ("Ja, ich bin Koch"),
 * jede Verneinung ("Nein", "Das stimmt nicht") und jeder andere Satz
 * ergeben NONE.
 */
export function detectConfirmationSignal(text: string | null | undefined): ConfirmationSignal {
  if (typeof text !== "string") return "NONE";
  const normalized = normalizeUtterance(text);
  if (normalized.length === 0) return "NONE";
  return PURE_SET.has(normalized) ? "POSITIVE_CONFIRMATION" : "NONE";
}

/**
 * Rein diagnostische Zuordnungsstufe. Die sichtbaren IDs stammen
 * unverändert aus der C1-Kette (referenzierte ORB-Zeile →
 * `model_visible_memory_ids`). Bei mehreren IDs wird KEINE ID ausgewählt.
 */
export function diagnoseConfirmation(
  signal: ConfirmationSignal,
  visibleMemoryIds: readonly string[] | null | undefined,
): ConfirmationDiagnosis {
  if (signal !== "POSITIVE_CONFIRMATION") return "NONE";
  const ids = visibleMemoryIds ?? [];
  if (ids.length === 0) return "NONE";
  if (ids.length === 1) return "CONFIRMED_SINGLE_CANDIDATE";
  return "AMBIGUOUS_CANDIDATE";
}

/**
 * P5-B3: rein diagnostischer Turn-Befund. Nutzt ausschliesslich die bereits
 * validierte C1-Referenz (referencedOrbTurnId → model_visible_memory_ids).
 * Enthält NUR technische Felder – keinen User-Text, keinen Memory-Inhalt.
 * candidate_memory_id wird nur bei genau einer sichtbaren ID gesetzt.
 */
export type ConfirmationTurnDiagnostic = {
  confirmation_signal: ConfirmationSignal;
  confirmation_diagnosis: ConfirmationDiagnosis;
  visible_memory_count: number;
  referenced_orb_message_id: string | null;
  candidate_memory_id: string | null;
};

export function confirmationTurnDiagnostic(
  userText: string | null | undefined,
  ref: {
    referencedOrbTurnId: string | null;
    referencedModelVisibleMemoryIds: readonly string[] | null;
  } | null | undefined,
): ConfirmationTurnDiagnostic {
  const signal = detectConfirmationSignal(userText);
  const validRef = ref?.referencedOrbTurnId ?? null;
  const ids = validRef ? (ref?.referencedModelVisibleMemoryIds ?? []) : [];
  const diagnosis = diagnoseConfirmation(signal, ids);
  return {
    confirmation_signal: signal,
    confirmation_diagnosis: diagnosis,
    visible_memory_count: ids.length,
    referenced_orb_message_id: validRef,
    candidate_memory_id: diagnosis === "CONFIRMED_SINGLE_CANDIDATE" ? ids[0] : null,
  };
}
