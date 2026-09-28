/**
 * ORB Core – Phase 2: Cognitive Relevance (reine ASSESSMENT LAYER).
 *
 * Wird von KEINEM bestehenden ORB-Pfad importiert. Keine DB, keine LLM-/API-
 * Aufrufe, keine Aktionen, keine Mutation von Eingaben.
 *
 * Abgrenzung (bestehende Scores bleiben unverändert und unbenannt):
 *   - memory.ts `memoryRelevance`      → Retrieval-Ranking
 *   - core.ts `relevanceScore`         → Gewicht/Importance/Overlap
 *   - continuity.ts `threadRelevance`  → Thread-Wiederaufnahme
 *   - memory.ts `feedRelevance`        → Feed-Matching
 * Cognitive Relevance ≠ Memory Importance ≠ Retrieval Score ≠ Curiosity ≠ Autonomy.
 * Sie beschreibt nur: "Wie stark sollte dieses Objekt im aktuellen kognitiven
 * Zustand berücksichtigt werden?" – kontextabhängig, momentan.
 *
 * Bewusst KEINE Gewichtung und KEIN Gesamtwert (spätere Phase).
 * Fehlende Daten = null (unbestimmt), niemals implizit 0.
 */
import {
  isInformationSource,
  unitOrNull,
  type OrbInformationSource,
} from "@/orb-core/cognitive/foundation";

export const RELEVANCE_FACTOR_KEYS = [
  "context",
  "goals",
  "knowledgeGap",
  "task",
  "recency",
  "experience",
  "userSignal",
] as const;

export type OrbRelevanceFactorKey = (typeof RELEVANCE_FACTOR_KEYS)[number];

/** Jeder Faktor ∈ [0,1] oder null (= nicht bestimmbar / unavailable). */
export type OrbRelevanceFactors = Record<OrbRelevanceFactorKey, number | null>;

export type OrbRelevanceAssessment = {
  factors: OrbRelevanceFactors;
  /** Datenabdeckung: Anteil bestimmter Faktoren (keine Relevanzgewichtung). */
  confidence: number;
  /** Unveränderte Kopie der Herkunft des bewerteten Objekts. */
  provenance: OrbInformationSource[];
  /** Faktoren, die null sind (fehlend oder ungültig). */
  unknownFactors: OrbRelevanceFactorKey[];
  /** Faktoren, deren Eingabe ungültig war (NaN/Infinity/Nicht-Zahl). */
  invalidFactors: OrbRelevanceFactorKey[];
};

export type OrbRelevanceFactorSpec = {
  meaning: string;
  allowedData: string;
  increases: string;
  decreases: string;
  unknownWhen: string;
  persistable: boolean;
  dynamic: boolean;
};

/** Dokumentation der Faktoren (Abschnitt 7 der Spezifikation). */
export const RELEVANCE_FACTOR_SPEC: Readonly<
  Record<OrbRelevanceFactorKey, OrbRelevanceFactorSpec>
> = Object.freeze({
  context: {
    meaning: "Bezug des Objekts zum aktuellen Gesprächskontext.",
    allowedData: "Nachrichten des aktuellen Gesprächsfensters, offener Thread.",
    increases: "Direkte thematische Überschneidung mit aktuellen Nachrichten.",
    decreases: "Kein Bezug zum aktuellen Gespräch, klarer Themenwechsel.",
    unknownWhen: "Kein aktueller Gesprächskontext vorhanden.",
    persistable: false,
    dynamic: true,
  },
  goals: {
    meaning: "Bezug zu einem explizit vom Benutzer gesetzten aktiven Ziel.",
    allowedData: "Nur OrbGoal mit status 'active', vom Benutzer gesetzt.",
    increases: "Objekt unterstützt ein aktives Benutzerziel.",
    decreases: "Objekt steht in keinem Bezug zu aktiven Zielen.",
    unknownWhen: "Kein aktives, explizit gesetztes Ziel vorhanden.",
    persistable: false,
    dynamic: true,
  },
  knowledgeGap: {
    meaning: "Wie stark das Objekt eine aktuell bestehende Wissenslücke reduziert.",
    allowedData: "Bestehende, bereits erkannte Wissenslücken.",
    increases: "Objekt adressiert eine offene Lücke direkt.",
    decreases: "Lücke bereits geschlossen oder kein Bezug.",
    unknownWhen: "Keine erkannte Wissenslücke vorhanden.",
    persistable: false,
    dynamic: true,
  },
  task: {
    meaning: "Unterstützung der aktuell erkennbaren Aufgabe.",
    allowedData: "Explizit erkennbare aktuelle Aufgabe im Gespräch.",
    increases: "Objekt ist für die Aufgabe nötig oder hilfreich.",
    decreases: "Objekt ist für die Aufgabe irrelevant.",
    unknownWhen: "Keine Aufgabe erkennbar.",
    persistable: false,
    dynamic: true,
  },
  recency: {
    meaning: "Aktualität des Bezugs.",
    allowedData: "Vorhandene Zeitstempel (letzter Zugriff/Erwähnung).",
    increases: "Kürzlich erwähnt oder genutzt.",
    decreases: "Lange nicht erwähnt.",
    unknownWhen: "Kein verlässlicher Zeitstempel vorhanden.",
    persistable: false,
    dynamic: true,
  },
  experience: {
    meaning: "Frühere tatsächliche Erfahrung zur Relevanz dieses Objekts/Themas.",
    allowedData: "Nur real vorhandene OrbExperience-Daten; keine erfundenen Werte.",
    increases: "Belegte frühere Nützlichkeit.",
    decreases: "Belegte frühere Nicht-Nützlichkeit.",
    unknownWhen: "Keine Experience-Daten vorhanden.",
    persistable: true,
    dynamic: false,
  },
  userSignal: {
    meaning: "Direktes Signal des Benutzers, das Relevanz erhöht oder senkt.",
    allowedData: "Explizite Benutzeräußerung zum Objekt/Thema.",
    increases: "Benutzer betont das Thema.",
    decreases: "Benutzer lehnt das Thema ab / will es nicht.",
    unknownWhen: "Kein direktes Benutzersignal vorhanden.",
    persistable: false,
    dynamic: true,
  },
});

export type OrbRelevanceInput = {
  factors?: Partial<Record<OrbRelevanceFactorKey, unknown>>;
  provenance?: readonly unknown[];
};

function cloneSource(s: OrbInformationSource): OrbInformationSource {
  return s.type === "inference" ? { type: "inference", sourceIds: [...s.sourceIds] } : { ...s };
}

/**
 * Reine Bewertung. Fehlend → null. Ungültig (NaN/Infinity/Nicht-Zahl) → null
 * und in invalidFactors. Außerhalb [0,1] → begrenzt. Keine Mutation der Eingabe.
 */
export function assessCognitiveRelevance(input: OrbRelevanceInput = {}): OrbRelevanceAssessment {
  const raw = input.factors ?? {};
  const factors = {} as OrbRelevanceFactors;
  const unknownFactors: OrbRelevanceFactorKey[] = [];
  const invalidFactors: OrbRelevanceFactorKey[] = [];
  for (const key of RELEVANCE_FACTOR_KEYS) {
    const v = raw[key];
    if (v === undefined || v === null) {
      factors[key] = null;
      unknownFactors.push(key);
      continue;
    }
    const n = unitOrNull(v);
    factors[key] = n;
    if (n === null) {
      unknownFactors.push(key);
      invalidFactors.push(key);
    }
  }
  const known = RELEVANCE_FACTOR_KEYS.length - unknownFactors.length;
  const provenance = (input.provenance ?? []).filter(isInformationSource).map(cloneSource);
  return {
    factors,
    confidence: known / RELEVANCE_FACTOR_KEYS.length,
    provenance: provenance.length > 0 ? provenance : [{ type: "unknown" }],
    unknownFactors,
    invalidFactors,
  };
}

export function isRelevanceFactors(value: unknown): value is OrbRelevanceFactors {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return RELEVANCE_FACTOR_KEYS.every((k) => {
    const x = v[k];
    return x === null || (typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1);
  });
}
