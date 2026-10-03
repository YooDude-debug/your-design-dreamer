/**
 * ORB Core – P7 Gesprächskontinuität (reine Logik, keine DB, kein Modellaufruf).
 *
 * - Herkunft: Erinnerungen, die erst in diesem Gespräch entstanden sind,
 *   werden nicht als „früher erwähnt“ dargestellt.
 * - Beantwortet: eine Frage gilt als beantwortet, wenn eine Benutzernachricht
 *   im Gesprächsfenster ihren Inhalt bereits abdeckt (Wortstämme, nicht Wortlaut).
 * - Mehrdeutigkeit: mehrere offene ORB-Fragen ⇒ Kurzantwort nicht raten.
 * - Zuordnung und Spekulation: kurze, deterministische Prompt-Hinweise.
 */
import { contentTokens } from "@/orb-core/memory";

/** Immer aktive Gesprächsregeln (Phase 2, Punkte 1–8). */
export const CONVERSATION_CONTINUITY_RULE = [
  "Gesprächskontinuität: Aussagen aus der aktuellen Nachricht und diesem Gespräch haben Vorrang vor älteren Erinnerungen; widerspricht eine ältere Erinnerung, nenne den Unterschied kurz statt die alte Angabe zu wiederholen.",
  "Frage nichts erneut, was der Benutzer in diesem Gespräch schon beantwortet hat – auch nicht in anderen Worten; eine genannte Vorliebe wird nicht direkt wieder abgefragt.",
  "Eine neue Frage muss das Gespräch erkennbar weiterbringen; eine passende Aussage ohne Rückfrage ist ausdrücklich erlaubt.",
  "Ist unklar, worauf oder auf wen sich etwas bezieht, frage kurz nach, statt einen Bezug zu behaupten.",
  "Sage nur dann „du hattest einmal erwähnt“, wenn es eine ältere Erinnerung ist; was gerade in diesem Gespräch gesagt wurde, benenne als gerade gesagt.",
  "Trenne Fakten, Annahmen und Spekulation; Einschätzungen zu Marktwert, Vergleichen oder Verdienst sind Möglichkeiten, keine Prognosen.",
].join(" ");

const MIN_SHARED = 2;

function stemMatch(a: string, b: string): boolean {
  if (a === b) return true;
  return a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a));
}

/**
 * Deckt eine Benutzernachricht des Fensters den Inhalt der Frage bereits ab?
 * Bezug: mindestens zwei gemeinsame Inhaltsstämme (bzw. alle, wenn die Frage
 * nur einen hat). Namen zählen nicht.
 */
export function isAnsweredInConversation(
  question: string,
  messages: readonly { role: string; body: string }[],
  nameTokens: readonly string[] = [],
): boolean {
  const names = new Set(nameTokens);
  const q = contentTokens(question).filter((t) => !names.has(t));
  if (q.length === 0) return false;
  const need = Math.min(MIN_SHARED, q.length);
  return messages.some((m) => {
    if (m.role !== "user") return false;
    const u = contentTokens(m.body).filter((t) => !names.has(t));
    const shared = q.filter((t) => u.some((x) => stemMatch(t, x))).length;
    return shared >= need;
  });
}

/** Alle Fragesätze der neuesten Nachricht, falls sie von ORB stammt. */
export function pendingOrbQuestions(messages: readonly { role: string; body: string }[]): string[] {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "orb" || !last.body.includes("?")) return [];
  return (last.body.match(/[^.!?]*\?/g) ?? []).map((s) => s.trim().slice(0, 300)).filter(Boolean);
}

/** Mehrere offene Fragen ⇒ eine Kurzantwort wie „Ja“ ist nicht eindeutig. */
export function ambiguousReplyHint(questions: readonly string[]): string {
  if (questions.length < 2) return "";
  return `Die kurze Eingabe antwortet auf eine Nachricht mit ${questions.length} Fragen (${questions
    .map((q) => `„${q}“`)
    .join(
      ", ",
    )}). Es ist nicht eindeutig, welche gemeint ist: frage kurz nach, statt eine Zustimmung zu einer bestimmten Frage anzunehmen.`;
}

/** Inhalte, die erst innerhalb des aktuellen Gesprächsfensters entstanden sind. */
export function conversationOriginContents(
  recalled: readonly { content: string; createdAt: string | null }[],
  windowStart: string | null,
): string[] {
  if (!windowStart) return [];
  const start = Date.parse(windowStart);
  if (!Number.isFinite(start)) return [];
  return recalled
    .filter((r) => r.createdAt && Date.parse(r.createdAt) >= start)
    .map((r) => r.content);
}

const OTHER_PERSON_RE =
  /\b(meine?|mein)\s+(frau|mann|freundin|freund|partnerin|partner|tochter|sohn|kinder|kind|mutter|vater|schwester|bruder|chefin|chef|kollegin|kollege)\b/i;

/** „Meine Frau mag …“ ⇒ Hinweis, dass die Aussage nicht den Benutzer betrifft. */
export function attributionHint(text: string): string {
  const m = OTHER_PERSON_RE.exec(text ?? "");
  if (!m) return "";
  const person = m[2]!.toLowerCase();
  return `Zuordnung: Die aktuelle Nachricht nennt „${m[1]!.toLowerCase()} ${person}“ – ordne Vorlieben und Angaben darin dieser Person zu, nicht dem Benutzer, sofern er es nicht ausdrücklich über sich sagt.`;
}

const SPECULATIVE_RE =
  /\b(verdien\w*|umsatz\w*|einnahm\w*|gewinn\w*|marktwert|bewertung|wert\s+sein|reich\s+werden|monetaris\w*|geld\s+(?:machen|verdienen))\b/i;

export function isSpeculativeQuestion(text: string): boolean {
  return SPECULATIVE_RE.test(text ?? "");
}

export function speculationHint(text: string): string {
  if (!isSpeculativeQuestion(text)) return "";
  return "Spekulation: Es gibt dazu keine belastbaren Daten. Antworte mit klar gekennzeichneten theoretischen Szenarien und ihren Annahmen, nenne keine Zahl als Prognose und keine erfundenen Marktdaten.";
}
