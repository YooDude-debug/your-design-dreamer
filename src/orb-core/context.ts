/**
 * ORB Core – Gesprächskontext (privat, innerhalb der Core-Grenze).
 *
 * Diese Datei enthält KEINE Gedächtnislogik: sie berührt weder Wichtigkeit,
 * Relevanz, Verfall, Konfidenz, Neugier noch Schwellen. Sie stellt nur einen
 * kurzen, deterministisch begrenzten Ausschnitt des laufenden Gesprächs bereit
 * und löst eine ausdrückliche Merk-Aufforderung gegen diesen Ausschnitt auf.
 *
 * Trennung (bewusst):
 *  - Gesprächskontext = flüchtig, nie automatisch gespeichert.
 *  - Langzeitgedächtnis = ausschliesslich die bestehende Lern-/Speicherlogik.
 */

import { contentTokens } from "./memory";

/** Harte, deterministische Obergrenze des Kontextfensters (Nachrichten). */
export const CONTEXT_WINDOW_MESSAGES = 8;

export type ConversationMessage = { role: "user" | "orb"; body: string };

/**
 * Letzte Nachrichten in zeitlicher Reihenfolge, hart auf
 * CONTEXT_WINDOW_MESSAGES begrenzt. Kein vollständiger Verlauf.
 */
export function contextWindow(
  messages: ConversationMessage[],
  limit: number = CONTEXT_WINDOW_MESSAGES,
): ConversationMessage[] {
  const clean = messages
    .map((m) => ({ role: m.role, body: (m.body ?? "").trim() }))
    .filter((m) => m.body.length > 0);
  return clean.slice(Math.max(0, clean.length - limit));
}

/** Kurzform für die Sprachschicht; jede Zeile bleibt gekürzt. */
export function formatConversationContext(window: ConversationMessage[]): string | null {
  if (window.length === 0) return null;
  return window
    .map((m) => `${m.role === "user" ? "Benutzer" : "Du"}: ${m.body.slice(0, 160)}`)
    .join(" | ");
}

/* ------------------------------------------- Ausdrückliche Merk-Aufforderung */

const LEARN_REQUEST_RE =
  /\b(merk(?:e|st)?\s+dir|merk\s*es\s*dir|speicher(?:e|st)?\s+dir|speicher(?:e)?\s+das|behalte?\s+dir|vergiss\s+das\s+nicht|remember\s+(?:that|my|this))\b/i;

/** Verweiswörter ohne eigenen Inhalt – zeigen auf die letzte Aussage. */
const PRONOUNS = ["das", "es", "dies", "dieses", "die info", "this", "that", "it"];

const REFERENT_STOPWORDS = new Set([
  "mein",
  "meine",
  "meinen",
  "meinem",
  "meiner",
  "my",
  "the",
  "bitte",
  "gut",
  "ab",
  "nicht",
  "genau",
  "mal",
  "doch",
  "immer",
  "dir",
  "das",
]);

export type ExplicitLearningRequest = {
  /** Worauf sich die Aufforderung bezieht, z. B. „mein lieblingsessen“ oder „das“. */
  referent: string;
  /** true, wenn der Bezug nur ein Verweiswort ist („merke dir das“). */
  pronominal: boolean;
};

/** Erkennt eine ausdrückliche Merk-Aufforderung; keine Bewertung, nur Erkennung. */
export function detectExplicitLearningRequest(text: string): ExplicitLearningRequest | null {
  const t = text.trim();
  const match = LEARN_REQUEST_RE.exec(t);
  if (!match) return null;
  const tail = t
    .slice(match.index + match[0].length)
    .replace(/[.!?]+$/g, "")
    .trim();
  const referent = tail.toLowerCase();
  // Ohne eigenen Inhalt (z. B. „merke dir das gut ab“) gilt der Bezug als
  // Verweis auf die zuletzt genannte Aussage.
  const pronominal =
    referent.length === 0 || PRONOUNS.includes(referent) || referentStems(referent).length === 0;
  return { referent, pronominal };
}

/** Wortstämme des Bezugs; Komposita wie „lieblingsessen“ werden aufgeteilt. */
function referentStems(referent: string): string[] {
  const words = referent
    .toLowerCase()
    .split(/[^a-zäöüß0-9]+/)
    .filter((w) => w.length >= 4 && !REFERENT_STOPWORDS.has(w));
  const stems = new Set<string>();
  for (const w of words) {
    stems.add(w);
    const rest = w.replace(/^lieblings?/, "");
    if (rest.length >= 4 && rest !== w) stems.add(rest);
  }
  return [...stems];
}

/** Prüft, ob ein Stamm im Text vorkommt (Präfixvergleich über 4 Zeichen). */
function mentions(text: string, stem: string): boolean {
  return text.includes(stem.slice(0, 4));
}

export type ResolvedContextFact = {
  /** Die aufgelöste Aussage – unverändert aus dem Gespräch übernommen. */
  fact: string;
  /** Nachvollziehbare Begründung für die Auflösung (Diagnose/Transparenz). */
  reason: string;
};

/**
 * Löst eine Merk-Aufforderung gegen das begrenzte Kontextfenster auf.
 * Vorsichtsprinzip: ohne ausreichenden Beleg wird `null` geliefert – dann darf
 * ORB nachfragen. Es wird nichts erfunden und nichts gespeichert.
 */
export function resolveFromContext(
  request: ExplicitLearningRequest,
  window: ConversationMessage[],
): ResolvedContextFact | null {
  // Nur eigene Aussagen des Benutzers gelten als Beleg, keine Fragen,
  // keine ORB-Antworten und keine weitere Merk-Aufforderung.
  const candidates = window
    .filter((m) => m.role === "user")
    .filter((m) => !m.body.includes("?"))
    .filter((m) => detectExplicitLearningRequest(m.body) === null)
    .filter((m) => contentTokens(m.body).length >= 1 && m.body.trim().split(/\s+/).length >= 3);
  if (candidates.length === 0) return null;

  if (request.pronominal) {
    const last = candidates[candidates.length - 1]!;
    return { fact: last.body, reason: "Verweis auf die zuletzt genannte Aussage im Gespräch." };
  }

  const stems = referentStems(request.referent);
  if (stems.length === 0) return null;

  let best: { fact: string; hits: number } | null = null;
  for (const c of candidates) {
    const lower = c.body.toLowerCase();
    const hits = stems.filter((s) => mentions(lower, s)).length;
    if (hits === 0) continue;
    // Bei Gleichstand gewinnt die jüngere Aussage (Reihenfolge des Fensters).
    if (!best || hits >= best.hits) best = { fact: c.body, hits };
  }
  if (!best) return null;
  return {
    fact: best.fact,
    reason: `Bezug „${request.referent}“ im Gesprächskontext belegt (${best.hits} Treffer).`,
  };
}
