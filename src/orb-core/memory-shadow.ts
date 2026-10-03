/**
 * ORB P14 S3 – Shadow-Bewertung (rein, isoliert, standardmäßig AUS).
 *
 * Vergleicht die bestehende Auswahl (Baseline: welche abgerufenen Erinnerungen
 * dem Modell sichtbar waren, Rang nach Abruf-Relevanz) mit einer alternativen
 * Bewertung auf Basis der S2-Werte (Relevanz, Wichtigkeit, Nutzung).
 *
 * Grenzen: kein DB-/Netz-/KI-Zugriff, keine Persistenz, Ergebnis fließt nie in
 * Retrieval, Ranking, Antwort oder Lebenszyklus zurück. Nicht belegbare Werte
 * bleiben `unknown`. Gleiche Eingabe → gleiches Ergebnis.
 */
import type { MemoryEvaluation, UsageStatus } from "@/orb-core/memory-evaluation";
import type { OrbDataScope } from "@/orb-core/scope-values";

/** Hauptschalter. Bewusst `false`; keine automatische Aktivierung. */
export const ORB_SHADOW_EVAL_ENABLED = false as const;

/** Gewichte der Alternativbewertung (Simulation, kein Produktivwert). */
export const SHADOW_WEIGHTS = { relevance: 0.6, importance: 0.3, usage: 0.1 } as const;

export type ShadowDeviation = "none" | "would_include" | "would_exclude" | "rank_shift" | "unknown";

export type ShadowCause =
  | "same_decision"
  | "importance_outweighs_relevance"
  | "relevance_outweighs_importance"
  | "usage_candidate_bonus"
  | "invalid_input_value"
  | "rank_tie_break_by_id";

export interface ShadowEntry {
  id: string;
  baseline_included: boolean;
  baseline_rank: number | null;
  shadow_score: number | null;
  shadow_rank: number | null;
  shadow_included: boolean | null;
  usage: UsageStatus;
  deviation: ShadowDeviation;
  cause: ShadowCause;
}

export interface ShadowEvaluation {
  kind: "orb.memory_shadow";
  version: 1;
  scope: OrbDataScope;
  baseline_included_count: number;
  deviations: number;
  unknown: number;
  entries: ShadowEntry[];
  dropped_out_of_scope: number;
}

const isUnit = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function shadowScore(e: {
  relevance: number;
  importance: number;
  usage: UsageStatus;
}): number | null {
  if (!isUnit(e.relevance) || !isUnit(e.importance)) return null;
  const u = e.usage === "usage_candidate" ? 1 : 0; // unknown trägt nie bei
  return round(
    SHADOW_WEIGHTS.relevance * e.relevance +
      SHADOW_WEIGHTS.importance * e.importance +
      SHADOW_WEIGHTS.usage * u,
  );
}

/**
 * Reine Vergleichsfunktion. `evaluation` = S2-Ergebnis desselben Gesprächsschritts.
 * `modelVisibleIds` = bestehende Auswahl (nur gelesen).
 */
export function compareShadow(input: {
  evaluation: MemoryEvaluation;
  modelVisibleIds: readonly string[];
  /** Optionaler Bereich je Eintrag; abweichende werden verworfen. */
  entryScopes?: Readonly<Record<string, OrbDataScope>>;
}): ShadowEvaluation {
  const { evaluation } = input;
  const scope = evaluation.scope;
  const all = evaluation.entries;
  const inScope = all.filter((e) => {
    const s = input.entryScopes?.[e.id];
    return s === undefined || s === scope;
  });
  const visible = new Set(input.modelVisibleIds);

  // Baseline-Rang: bestehende Relevanz absteigend, id als Tie-Breaker.
  const baselineOrder = [...inScope].sort((a, b) =>
    b.relevance !== a.relevance ? b.relevance - a.relevance : byId(a, b),
  );
  const baselineRank = new Map(baselineOrder.map((e, i) => [e.id, i + 1]));
  const k = inScope.filter((e) => visible.has(e.id)).length;

  const scored = inScope.map((e) => ({ e, score: shadowScore(e) }));
  const valid = scored.filter((s) => s.score !== null) as { e: (typeof inScope)[number]; score: number }[];
  const shadowOrder = [...valid].sort((a, b) =>
    b.score !== a.score ? b.score - a.score : byId(a.e, b.e),
  );
  const shadowRank = new Map(shadowOrder.map((s, i) => [s.e.id, i + 1]));
  const tied = new Set<string>();
  for (let i = 1; i < shadowOrder.length; i++)
    if (shadowOrder[i]!.score === shadowOrder[i - 1]!.score) {
      tied.add(shadowOrder[i]!.e.id);
      tied.add(shadowOrder[i - 1]!.e.id);
    }

  const entries = scored
    .map(({ e, score }): ShadowEntry => {
      const baseline_included = visible.has(e.id);
      const base = {
        id: e.id,
        baseline_included,
        baseline_rank: baselineRank.get(e.id) ?? null,
        usage: e.usage,
      };
      if (score === null)
        return {
          ...base,
          shadow_score: null,
          shadow_rank: null,
          shadow_included: null,
          deviation: "unknown",
          cause: "invalid_input_value",
        };
      const rank = shadowRank.get(e.id)!;
      const shadow_included = rank <= k;
      let deviation: ShadowDeviation = "none";
      if (shadow_included && !baseline_included) deviation = "would_include";
      else if (!shadow_included && baseline_included) deviation = "would_exclude";
      else if (rank !== base.baseline_rank) deviation = "rank_shift";
      let cause: ShadowCause = "same_decision";
      if (deviation !== "none") {
        if (tied.has(e.id)) cause = "rank_tie_break_by_id";
        else if (e.usage === "usage_candidate" && deviation !== "would_exclude")
          cause = "usage_candidate_bonus";
        else if (deviation === "would_exclude" ? e.importance < e.relevance : e.importance > e.relevance)
          cause = "importance_outweighs_relevance";
        else cause = "relevance_outweighs_importance";
      }
      return { ...base, shadow_score: score, shadow_rank: rank, shadow_included, deviation, cause };
    })
    .sort(byId);

  return {
    kind: "orb.memory_shadow",
    version: 1,
    scope,
    baseline_included_count: k,
    deviations: entries.filter((e) => e.deviation !== "none" && e.deviation !== "unknown").length,
    unknown: entries.filter((e) => e.deviation === "unknown").length,
    entries,
    dropped_out_of_scope: all.length - inScope.length + evaluation.dropped_out_of_scope,
  };
}

/**
 * Abgeschirmter Einstieg: liefert nur bei aktivem Schalter ein Ergebnis,
 * wirft nie. Rückgabe ist ausschließlich für Protokoll/Tests gedacht.
 */
export function runShadowEvaluation(
  input: Parameters<typeof compareShadow>[0],
  enabled: boolean = ORB_SHADOW_EVAL_ENABLED,
): ShadowEvaluation | null {
  if (!enabled) return null;
  try {
    return compareShadow(input);
  } catch {
    return null;
  }
}
