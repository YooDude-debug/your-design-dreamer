/**
 * ORB Core – Phase 9: Cognitive Candidate (passiver Container).
 *
 * Fasst die Ergebnisse der Phasen 2–8 zu einem Objekt zusammen:
 * "Was wissen wir momentan über diesen möglichen Fokus?" – NICHT
 * "Was soll ORB tun?".
 *
 * - Keine Verrechnung, kein Gesamtwert, keine Gewichtung, kein Ranking,
 *   keine Auswahl, keine Normalisierung über Dimensionen.
 * - Fehlende Dimension → null (nie 0/false/Default).
 * - id/topic/description nur aus explizitem Input, sonst null. Keine
 *   ID-Erzeugung, keine Topic-Erkennung.
 * - Quelle wird unverändert (tief kopiert) übernommen; ungültige oder
 *   fehlende Quelle → { type: "unknown" }. Inference bleibt Inference.
 * - Inputs werden tief kopiert und nie mutiert.
 * - Keine Uhr, kein Zufall, keine DB/API/LLM. Von keinem Modul importiert.
 */
import { isInformationSource, type OrbInformationSource } from "@/orb-core/cognitive/foundation";
import type { OrbRelevanceAssessment } from "@/orb-core/cognitive/relevance";
import type { OrbNoveltyAssessment } from "@/orb-core/cognitive/novelty";
import type { OrbUncertaintyAssessment } from "@/orb-core/cognitive/uncertainty";
import type { OrbGoalPressureAssessment } from "@/orb-core/cognitive/goal-pressure";
import type { OrbAttentionAssessment } from "@/orb-core/cognitive/attention";
import type { OrbExperienceAssessment } from "@/orb-core/cognitive/experience";
import type { OrbContradictionResult } from "@/orb-core/cognitive/contradiction";

export type OrbCognitiveCandidate = {
  id: string | null;
  topic: string | null;
  description: string | null;
  source: OrbInformationSource;
  relevance: OrbRelevanceAssessment | null;
  novelty: OrbNoveltyAssessment | null;
  uncertainty: OrbUncertaintyAssessment | null;
  goalPressure: OrbGoalPressureAssessment | null;
  attention: OrbAttentionAssessment | null;
  experience: OrbExperienceAssessment | null;
  contradiction: OrbContradictionResult | null;
};

export type OrbCognitiveCandidateInput = {
  id?: string | null;
  topic?: string | null;
  description?: string | null;
  source?: unknown;
  relevance?: OrbRelevanceAssessment | null;
  novelty?: OrbNoveltyAssessment | null;
  uncertainty?: OrbUncertaintyAssessment | null;
  goalPressure?: OrbGoalPressureAssessment | null;
  attention?: OrbAttentionAssessment | null;
  experience?: OrbExperienceAssessment | null;
  contradiction?: OrbContradictionResult | null;
};

function textOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

function dim<T>(v: T | null | undefined): T | null {
  return v === undefined || v === null ? null : structuredClone(v);
}

export function createCognitiveCandidate(
  input: OrbCognitiveCandidateInput = {},
): OrbCognitiveCandidate {
  return {
    id: textOrNull(input.id),
    topic: textOrNull(input.topic),
    description: textOrNull(input.description),
    source: isInformationSource(input.source)
      ? structuredClone(input.source)
      : { type: "unknown" },
    relevance: dim(input.relevance),
    novelty: dim(input.novelty),
    uncertainty: dim(input.uncertainty),
    goalPressure: dim(input.goalPressure),
    attention: dim(input.attention),
    experience: dim(input.experience),
    contradiction: dim(input.contradiction),
  };
}
