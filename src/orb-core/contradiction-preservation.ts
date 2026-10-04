/**
 * ORB Digital Brain – Phase 2D: Contradiction Preservation (reine Entscheidung).
 *
 * Beantwortet: "Wie wird eine neue Aussage gegenüber einer bestehenden
 * Erinnerung behandelt?" – ohne zu entscheiden, welche wahr ist.
 *
 * - Erkennung strukturell über detectContradiction (gleiches Subject +
 *   Predicate, anderer Value). Wortähnlichkeit allein ist nie ein Widerspruch.
 * - Bestehende Erinnerungen werden nie überschrieben (overwriteExisting=false).
 * - Zeitliche Veränderung nur bei ausdrücklichem Zeitmarker der neuen Aussage.
 * - Eine Vermutung (inferred/observed) überschreibt oder verdrängt nie eine
 *   vom Nutzer mitgeteilte Aussage.
 *
 * Keine DB, keine Seiteneffekte, keine Uhr, kein Zufall. Noch von keinem
 * Schreibpfad importiert (persistente Integration offen).
 */
import { detectContradiction, type OrbStatement } from "@/orb-core/cognitive/contradiction";
import type { OrbInfoSource } from "@/orb-core/memory";

export type PreservationStatement = {
  id?: string | null;
  subject: string;
  predicate: string;
  value: string;
  source: OrbInfoSource;
  /** Reines Metadatum (ISO); nie zur Wahrheitsentscheidung verwendet. */
  observedAt: string | null;
  /** Originaltext der Aussage – nur für Zeit-/Ergänzungsmarker. */
  text?: string;
};

export type PreservationKind =
  | "duplicate" // gleicher Wert
  | "supplement" // gleicher Bezug, ausdrücklich zusätzlich
  | "temporal_change" // gleicher Bezug, ausdrückliche Veränderung über Zeit
  | "contradiction" // gleicher Bezug, anderer Wert, kein Marker
  | "unrelated" // anderer Bezug
  | "unknown"; // unvollständige Struktur

export type PreservationRelation = "supplements" | "supersedes_in_time" | "contradicts";

export type KnowledgeClass = "confirmed" | "inferred";

export type PreservationPlan = {
  kind: PreservationKind;
  /** Immer false – alte Erinnerung bleibt unverändert erhalten. */
  overwriteExisting: false;
  /** Neue Aussage als eigene Erinnerung behalten. */
  keepNew: boolean;
  /** Verknüpfung neu → bestehend (null = keine). */
  relation: PreservationRelation | null;
  /** Welche Aussage ist aktuell? Nur bei temporal_change, sonst null (keine Wahrheitsentscheidung). */
  current: "existing" | "new" | null;
  existingClass: KnowledgeClass;
  newClass: KnowledgeClass;
  /** Grund (technisch, ohne Inhalte). */
  reason:
    | "same_value"
    | "explicit_addition"
    | "explicit_time_change"
    | "inference_cannot_supersede_confirmed"
    | "conflicting_values_kept"
    | "different_reference"
    | "incomplete_statement";
};

const TIME_CHANGE_RE =
  /\b(jetzt|inzwischen|mittlerweile|nicht mehr|seit (?:kurzem|neuestem|letzte[mnr]?|diese[mnr]?)|neuerdings|ab sofort|früher|vorher|nun)\b/i;
const ADDITION_RE = /\b(auch|außerdem|ausserdem|zusätzlich|ebenfalls|daneben)\b/i;

export function knowledgeClassOf(source: OrbInfoSource): KnowledgeClass {
  return source === "user_stated" ? "confirmed" : "inferred";
}

function toStatement(s: PreservationStatement): OrbStatement {
  return { id: s.id ?? null, subject: s.subject, predicate: s.predicate, value: s.value };
}

function norm(v: string): string {
  return v.trim().toLocaleLowerCase("de-DE");
}

export function planContradiction(
  existing: PreservationStatement,
  incoming: PreservationStatement,
): PreservationPlan {
  const base = {
    overwriteExisting: false as const,
    existingClass: knowledgeClassOf(existing.source),
    newClass: knowledgeClassOf(incoming.source),
  };
  const det = detectContradiction(toStatement(existing), toStatement(incoming));
  if (det.type === "unknown") {
    return {
      ...base,
      kind: "unknown",
      keepNew: false,
      relation: null,
      current: null,
      reason: "incomplete_statement",
    };
  }
  const sameRef =
    norm(existing.subject) === norm(incoming.subject) &&
    norm(existing.predicate) === norm(incoming.predicate);
  if (!sameRef) {
    return {
      ...base,
      kind: "unrelated",
      keepNew: true,
      relation: null,
      current: null,
      reason: "different_reference",
    };
  }
  if (!det.detected) {
    return {
      ...base,
      kind: "duplicate",
      keepNew: false,
      relation: null,
      current: null,
      reason: "same_value",
    };
  }
  const text = incoming.text ?? "";
  if (ADDITION_RE.test(text) && !TIME_CHANGE_RE.test(text)) {
    return {
      ...base,
      kind: "supplement",
      keepNew: true,
      relation: "supplements",
      current: null,
      reason: "explicit_addition",
    };
  }
  const inferenceVsConfirmed = base.newClass === "inferred" && base.existingClass === "confirmed";
  if (TIME_CHANGE_RE.test(text) && !inferenceVsConfirmed) {
    return {
      ...base,
      kind: "temporal_change",
      keepNew: true,
      relation: "supersedes_in_time",
      current: "new",
      reason: "explicit_time_change",
    };
  }
  return {
    ...base,
    kind: "contradiction",
    keepNew: true,
    relation: "contradicts",
    current: null,
    reason: inferenceVsConfirmed
      ? "inference_cannot_supersede_confirmed"
      : "conflicting_values_kept",
  };
}
