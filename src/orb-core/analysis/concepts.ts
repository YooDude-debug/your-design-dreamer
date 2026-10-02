/**
 * ORB Core – Konzepte und Beziehungen aus der Kontextanalyse (rein, deterministisch).
 *
 * Die bestehende Hintergrund-Auswertung liefert zusätzlich Vorschläge für
 * Begriffe (Konzepte) und Beziehungen. Diese Datei entscheidet ohne KI, was
 * davon gespeichert werden darf:
 *
 *  - Es gibt KEINE feste Themen- oder Begriffsliste. Begriffe entstehen nur aus
 *    dem Gespräch selbst und nur mit wörtlicher Belegstelle aus Benutzertext.
 *  - Füllwörter, Fragewörter und reine Einzelbuchstaben werden nie zu Begriffen.
 *  - Beziehungen haben immer einen Typ, eine Belegstelle und einen
 *    Evidenzstatus. Der Status ist nie „bestätigt“: eine wiederholte Erwähnung
 *    zählt nur als weitere Erwähnung, nicht als sachliche Bestätigung.
 *  - Begriffe sind getrennt von Erinnerungen: eigener Duplikatschlüssel mit
 *    Präfix, damit kein Begriff je eine Erinnerung ersetzt oder überschreibt.
 */

import { contentTokens, normKey } from "@/orb-core/memory";

export const CONCEPT_MAX_COUNT = 5;
export const RELATION_MAX_COUNT = 6;
export const CONCEPT_LABEL_MAX_CHARS = 60;
export const CONCEPT_LABEL_MAX_WORDS = 5;
export const CONCEPT_QUOTE_MAX_CHARS = 200;
export const CONCEPT_MIN_CONFIDENCE = 0.6;
export const RELATION_MIN_CONFIDENCE = 0.6;
/** Höchstzahl gespeicherter Belegstellen je Knoten/Beziehung. */
export const EVIDENCE_MAX_ENTRIES = 5;

/** Präfix des Duplikatschlüssels: Begriffe kollidieren nie mit Erinnerungen. */
export const CONCEPT_KEY_PREFIX = "concept:";
export const CONCEPT_KIND = "concept";
export const CONCEPT_RELATION_KIND = "concept_relation";

/** Beziehungstypen (Art der Verbindung, keine Themenkategorien). */
export const RELATION_TYPES = [
  "related_to",
  "part_of",
  "instance_of",
  "uses",
  "alternative_to",
  "contrasts_with",
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

/** Grundlage laut Analyse: ausdrücklich gesagt oder nur abgeleitet. */
export const RELATION_BASES = ["explicit", "inferred"] as const;
export type RelationBasis = (typeof RELATION_BASES)[number];

/**
 * Evidenzstatus. Bewusst ohne „confirmed“: ORB kann eine Beziehung aus
 * Gesprächen nicht sachlich bestätigen, nur ihre Herkunft belegen.
 *  - stated_by_user: Benutzer hat die Beziehung selbst ausgesprochen.
 *  - inferred: aus dem Benutzertext abgeleitet, unbestätigt.
 *  - co_mentioned: Begriff kommt in einer gespeicherten Erinnerung vor.
 */
export type EvidenceStatus = "stated_by_user" | "inferred" | "co_mentioned";

export type ConceptProposal = { label: string; key: string; quote: string; confidence: number };
export type RelationProposal = {
  fromKey: string;
  toKey: string;
  relation: RelationType;
  basis: RelationBasis;
  status: EvidenceStatus;
  quote: string;
  confidence: number;
};
export type ConceptRejection = { kind: "concept" | "relation"; reason: string };

export type ConceptValidation = {
  concepts: ConceptProposal[];
  relations: RelationProposal[];
  rejected: ConceptRejection[];
};

/** Wörter, die als Begriff allein nichts benennen (zusätzlich zu den Füllwörtern). */
const NON_CONCEPT_WORDS = new Set([
  "ja",
  "nein",
  "doch",
  "okay",
  "ok",
  "genau",
  "richtig",
  "falsch",
  "gleich",
  "denke",
  "glaube",
  "wäre",
  "würde",
  "könnte",
  "sollte",
  "letzte",
  "letzten",
  "erste",
  "ding",
  "sache",
  "sachen",
  "etwas",
  "thema",
  "frage",
  "antwort",
  "idee",
  "yes",
  "no",
  "thing",
  "stuff",
  "something",
]);

const QUESTION_WORDS = new Set([
  "wie",
  "was",
  "wer",
  "wann",
  "warum",
  "wieso",
  "weshalb",
  "wo",
  "welche",
  "welcher",
  "welches",
]);

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function clamp01(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Vergleichsform: Kleinschreibung, Satzzeichen zu Leerzeichen. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Duplikatschlüssel eines Begriffs (leer = kein gültiger Begriff). */
export function conceptKey(label: string): string {
  const k = normKey(label);
  return k ? `${CONCEPT_KEY_PREFIX}${k}` : "";
}

/** Ist dieser Text als eigenständiger Begriff zulässig? Grund oder null. */
export function conceptLabelProblem(label: string): string | null {
  if (label.length < 2) return "label_too_short";
  const words = fold(label).split(" ").filter(Boolean);
  if (words.length === 0) return "label_empty";
  if (words.length > CONCEPT_LABEL_MAX_WORDS) return "label_too_long";
  if (words.every((w) => NON_CONCEPT_WORDS.has(w) || QUESTION_WORDS.has(w))) {
    return "filler_word";
  }
  if (contentTokens(label).length === 0) return "filler_word";
  if (!conceptKey(label)) return "no_key";
  return null;
}

/** Belegstelle muss wörtlich in einer Benutzerzeile stehen. */
export function quoteInUserText(quote: string, userTexts: string[]): boolean {
  const q = fold(quote);
  if (q.length < 3) return false;
  return userTexts.some((t) => fold(t).includes(q));
}

/** Begriff muss in der Belegstelle vorkommen (mindestens ein Inhaltswort). */
export function labelGroundedInQuote(label: string, quote: string): boolean {
  const qTokens = new Set(contentTokens(quote));
  const lTokens = contentTokens(label);
  if (lTokens.length === 0) return false;
  return lTokens.some(
    (t) => qTokens.has(t) || [...qTokens].some((q) => q.startsWith(t) || t.startsWith(q)),
  );
}

function listOf(raw: unknown, field: string): unknown[] {
  const v = (raw as Record<string, unknown> | null)?.[field];
  return Array.isArray(v) ? v : [];
}

/**
 * Rohvorschläge → zulässige Begriffe und Beziehungen. Unzulässiges wird
 * verworfen (nie geraten, nie ergänzt). Nur Gründe, keine Inhalte im Ergebnis
 * der Ablehnungen.
 */
export function validateConcepts(raw: unknown, userTexts: string[]): ConceptValidation {
  const rejected: ConceptRejection[] = [];
  const concepts: ConceptProposal[] = [];
  const byKey = new Map<string, ConceptProposal>();
  const labelToKey = new Map<string, string>();

  for (const entry of listOf(raw, "concepts")) {
    if (concepts.length >= CONCEPT_MAX_COUNT) break;
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const label = clean(e["label"], CONCEPT_LABEL_MAX_CHARS);
    const quote = clean(e["evidence_quote"], CONCEPT_QUOTE_MAX_CHARS);
    const confidence = clamp01(e["confidence"]);
    const problem = conceptLabelProblem(label);
    if (problem) {
      rejected.push({ kind: "concept", reason: problem });
      continue;
    }
    if (confidence < CONCEPT_MIN_CONFIDENCE) {
      rejected.push({ kind: "concept", reason: "low_confidence" });
      continue;
    }
    if (!quoteInUserText(quote, userTexts)) {
      rejected.push({ kind: "concept", reason: "quote_not_in_user_text" });
      continue;
    }
    if (!labelGroundedInQuote(label, quote)) {
      rejected.push({ kind: "concept", reason: "label_not_in_quote" });
      continue;
    }
    const key = conceptKey(label);
    labelToKey.set(fold(label), key);
    if (byKey.has(key)) continue;
    const c = { label, key, quote, confidence };
    byKey.set(key, c);
    concepts.push(c);
  }

  const relations: RelationProposal[] = [];
  const seenPairs = new Set<string>();
  for (const entry of listOf(raw, "relations")) {
    if (relations.length >= RELATION_MAX_COUNT) break;
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const fromLabel = clean(e["from"], CONCEPT_LABEL_MAX_CHARS);
    const toLabel = clean(e["to"], CONCEPT_LABEL_MAX_CHARS);
    const fromKey = labelToKey.get(fold(fromLabel)) ?? conceptKey(fromLabel);
    const toKey = labelToKey.get(fold(toLabel)) ?? conceptKey(toLabel);
    const relation = e["relation"] as RelationType;
    const basis = e["basis"] as RelationBasis;
    const quote = clean(e["evidence_quote"], CONCEPT_QUOTE_MAX_CHARS);
    const confidence = clamp01(e["confidence"]);

    if (!byKey.has(fromKey) || !byKey.has(toKey)) {
      rejected.push({ kind: "relation", reason: "unknown_concept" });
      continue;
    }
    if (fromKey === toKey) {
      rejected.push({ kind: "relation", reason: "self_relation" });
      continue;
    }
    if (!(RELATION_TYPES as readonly string[]).includes(relation)) {
      rejected.push({ kind: "relation", reason: "unknown_relation_type" });
      continue;
    }
    if (!(RELATION_BASES as readonly string[]).includes(basis)) {
      rejected.push({ kind: "relation", reason: "unknown_basis" });
      continue;
    }
    if (confidence < RELATION_MIN_CONFIDENCE) {
      rejected.push({ kind: "relation", reason: "low_confidence" });
      continue;
    }
    if (!quoteInUserText(quote, userTexts)) {
      rejected.push({ kind: "relation", reason: "quote_not_in_user_text" });
      continue;
    }
    // Beide Enden müssen in derselben Belegstelle vorkommen – sonst wäre die
    // Verbindung nur behauptet, nicht belegt.
    if (
      !labelGroundedInQuote(byKey.get(fromKey)!.label, quote) ||
      !labelGroundedInQuote(byKey.get(toKey)!.label, quote)
    ) {
      rejected.push({ kind: "relation", reason: "ends_not_in_quote" });
      continue;
    }
    const pair = [fromKey, toKey].sort().join("|");
    if (seenPairs.has(pair)) continue;
    seenPairs.add(pair);
    relations.push({
      fromKey,
      toKey,
      relation,
      basis,
      status: basis === "explicit" ? "stated_by_user" : "inferred",
      quote,
      confidence,
    });
  }

  return { concepts, relations, rejected };
}

/** Kommt der Begriff in einem Erinnerungstext vor? (für „co_mentioned“) */
export function conceptMentionedIn(label: string, text: string): boolean {
  return labelGroundedInQuote(label, text);
}

export type EvidenceEntry = { quote: string; at: string; run: string };

/** Belegstelle anfügen (ohne Doppelte, begrenzt). */
export function appendEvidence(existing: unknown, entry: EvidenceEntry): EvidenceEntry[] {
  const list = Array.isArray(existing)
    ? (existing.filter(
        (e) => e && typeof e === "object" && typeof (e as EvidenceEntry).quote === "string",
      ) as EvidenceEntry[])
    : [];
  if (list.some((e) => fold(e.quote) === fold(entry.quote))) return list;
  return [...list, entry].slice(-EVIDENCE_MAX_ENTRIES);
}

/**
 * Bestehende Beziehung mit neuer Erwähnung zusammenführen. Der Evidenzstatus
 * wird NIE durch Wiederholung angehoben; ein abweichender Typ überschreibt den
 * gespeicherten Typ nicht, sondern wird als möglicher Konflikt vermerkt.
 */
export function mergeRelationMetadata(
  current: Record<string, unknown>,
  incoming: RelationProposal,
  evidence: EvidenceEntry,
): { metadata: Record<string, unknown>; conflict: boolean } {
  const storedType = current["relation"];
  const conflict = typeof storedType === "string" && storedType !== incoming.relation;
  const mentions = typeof current["mentions"] === "number" ? current["mentions"] : 1;
  const metadata: Record<string, unknown> = {
    ...current,
    mentions: mentions + 1,
    evidence: appendEvidence(current["evidence"], evidence),
  };
  if (conflict) {
    const prev = Array.isArray(current["conflicting_relations"])
      ? (current["conflicting_relations"] as unknown[])
      : [];
    metadata["potential_conflict"] = true;
    metadata["conflicting_relations"] = [
      ...prev,
      { relation: incoming.relation, quote: evidence.quote, at: evidence.at },
    ].slice(-EVIDENCE_MAX_ENTRIES);
  }
  return { metadata, conflict };
}

/** Ist eine Knotenzeile ein Begriff (und keine Erinnerung)? */
export function isConceptRow(row: { metadata?: unknown; norm_key?: string | null }): boolean {
  if (typeof row.norm_key === "string" && row.norm_key.startsWith(CONCEPT_KEY_PREFIX)) return true;
  const m = row.metadata;
  return !!m && typeof m === "object" && (m as Record<string, unknown>)["kind"] === CONCEPT_KIND;
}
