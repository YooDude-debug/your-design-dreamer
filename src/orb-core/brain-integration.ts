/**
 * ORB Digital Brain – Phase 3: gemeinsame, rein entscheidende Anbindung der
 * Phase-2-Regeln an den bestehenden Ablauf. Keine DB, keine KI, kein Schreiben.
 *
 * Reihenfolge je Erinnerung: Aufnahme/Bewertung (bestehende Analyse) →
 * Wissensklasse (bestätigt/abgeleitet) → Widerspruch (2D) → Abruf (2A) →
 * Nutzungsnachweis (2E) → Lebenszyklus+Schutz (2F/2G). Jede Eigenschaft hat
 * genau eine Quelle.
 */
import type { MemoryCandidate } from "@/orb-core/analysis/schema";
import { planContradiction, type PreservationPlan } from "@/orb-core/contradiction-preservation";
import type { ProtectionCategory } from "@/orb-core/reversible-lifecycle";

/**
 * Schutzgruppen-Kandidat aus der bestehenden Analyse (Kategorie + Zeitbezug).
 * Immer `confirmed: false`: Eine Analyse-Ableitung ist nie automatisch
 * bestätigte dauerhafte Information; Schutz verlangt Nutzerbestätigung.
 */
export function protectionGroupCandidate(c: Pick<MemoryCandidate, "category" | "temporalScope">): {
  group: ProtectionCategory | null;
  confirmed: false;
} {
  const lasting = c.temporalScope === "persistent" || c.temporalScope === "long_term";
  let group: ProtectionCategory | null = null;
  if (c.category === "identity") group = "identity";
  else if (!lasting) group = null;
  else if (c.category === "preference" || c.category === "address_preference")
    group = "long_term_preference";
  else if (c.category === "project" || c.category === "goal") group = "long_term_project";
  else if (c.category === "decision") group = "important_decision";
  return { group, confirmed: false };
}

/**
 * 2D-Entscheidung für eine Analyse-Korrektur gegenüber dem bestehenden Knoten.
 * Bestand gilt konservativ als bestätigt; neu nur mit wörtlichem Beleg als
 * Nutzeraussage, sonst Vermutung (verdrängt nie Bestätigtes).
 */
export function planCandidateContradiction(
  existing: { id: string; content: string },
  c: Pick<MemoryCandidate, "key" | "value" | "sourceReference">,
): PreservationPlan {
  return planContradiction(
    {
      id: existing.id,
      subject: "user",
      predicate: c.key,
      value: existing.content,
      source: "user_stated",
      observedAt: null,
    },
    {
      subject: "user",
      predicate: c.key,
      value: c.value,
      source: c.sourceReference ? "user_stated" : "inferred",
      observedAt: null,
      text: c.sourceReference || c.value,
    },
  );
}
