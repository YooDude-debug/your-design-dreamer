/**
 * Reine Berechnungslogik der Interest Engine.
 *
 * Keine Datenbank, kein UI, keine Seiteneffekte – dadurch testbar und
 * beliebig wiederverwendbar (Feed, Werbe-Feed, Empfehlungen, Trends).
 */

import type { EngineConfig } from "./config";
import { pointsKeyFor } from "./config";
import {
  ENGAGEMENT_ACTIONS,
  type ConfidenceRow,
  type ConnectionInfluenceRow,
  type InteractionAction,
  type InterestCategory,
  type InterestProfileEntry,
  type InterestScoreRow,
} from "./types";

const DAY_MS = 86_400_000;

export function isEngagement(action: InteractionAction) {
  return ENGAGEMENT_ACTIONS.includes(action);
}

/** Punkte einer Aktion inkl. optionaler Verweildauer. */
export function pointsForAction(cfg: EngineConfig, action: InteractionAction, dwellMs = 0) {
  const base = cfg[pointsKeyFor(action)] ?? 0;
  const dwell = Math.min(
    cfg["points.dwell_max"],
    (Math.max(0, dwellMs) / 1000) * cfg["points.dwell_per_second"],
  );
  return base + dwell;
}

/**
 * Zeitliches Veralten: nur dynamische Werte verlieren Gewicht,
 * der vom Nutzer gewählte Grundkern bleibt unberührt.
 */
export function decayScore(cfg: EngineConfig, score: number, lastDecayAt: number, now = Date.now()) {
  const halfLife = Math.max(0.001, cfg["decay.half_life_days"]);
  const days = Math.max(0, (now - lastDecayAt) / DAY_MS);
  if (days <= 0) return score;
  const decayed = score * Math.pow(0.5, days / halfLife);
  return decayed < cfg["decay.min_score"] ? 0 : decayed;
}

/** Neuer Confidence-Wert nach einer Aktion. */
export function nextConfidence(
  cfg: EngineConfig,
  row: Pick<ConfidenceRow, "confidence" | "viewCount" | "engageCount" | "distinctDays">,
  action: InteractionAction,
  newDay: boolean,
) {
  const engaged = isEngagement(action);
  const gain = engaged ? cfg["confidence.engage_weight"] : cfg["confidence.view_weight"];
  return {
    confidence: row.confidence + gain,
    viewCount: row.viewCount + (engaged ? 0 : 1),
    engageCount: row.engageCount + (engaged ? 1 : 0),
    distinctDays: row.distinctDays + (newDay ? 1 : 0),
  };
}

/**
 * Ein Interesse wird erst übernommen, wenn Schwellenwert, Mindestanzahl
 * Aktionen und Mindestanzahl unterschiedlicher Tage erreicht sind.
 * Fällt die Confidence deutlich zurück, wird es wieder verworfen.
 */
export function evaluatePromotion(
  cfg: EngineConfig,
  row: Pick<ConfidenceRow, "confidence" | "viewCount" | "engageCount" | "distinctDays" | "promoted">,
) {
  const events = row.viewCount + row.engageCount;
  const qualifies =
    row.confidence >= cfg["confidence.threshold"] &&
    events >= cfg["confidence.min_events"] &&
    row.distinctDays >= cfg["confidence.min_days"];
  if (!row.promoted) return qualifies;
  return row.confidence >= cfg["confidence.threshold"] * cfg["confidence.demote_factor"];
}

/** Confidence normalisiert auf 0..1. */
export function confidenceRatio(cfg: EngineConfig, confidence: number) {
  return clamp01(confidence / Math.max(1, cfg["confidence.threshold"]));
}

/** Interaktionsstärke zu einer Connection – ausschließlich Häufigkeiten. */
export function connectionStrength(cfg: EngineConfig, row: Omit<ConnectionInfluenceRow, "strength" | "peerId">) {
  return (
    row.messageCount * cfg["connection.message_weight"] +
    row.likeCount * cfg["connection.like_weight"] +
    row.commentCount * cfg["connection.comment_weight"] +
    row.sharedInterests * cfg["connection.shared_interest_weight"] +
    row.sharedSlangTags * cfg["connection.shared_tag_weight"]
  );
}

/**
 * Aggregiert den Kategorie-Einfluss aller relevanten Connections.
 * Ergebnis ist pro Kategorie auf 0..1 normiert; die Deckelung auf
 * `weight.connection_max` erfolgt in `buildProfile`.
 */
export function aggregateConnectionInfluence(
  cfg: EngineConfig,
  connections: ConnectionInfluenceRow[],
  peerCategories: Record<string, { categoryId: string; score: number }[]>,
): Record<string, number> {
  const relevant = connections.filter((c) => c.strength >= cfg["connection.min_strength"]);
  if (relevant.length === 0) return {};
  const totalStrength = relevant.reduce((sum, c) => sum + c.strength, 0) || 1;

  const out: Record<string, number> = {};
  for (const conn of relevant) {
    const cats = peerCategories[conn.peerId] ?? [];
    const peerMax = Math.max(1, ...cats.map((c) => c.score));
    const share = conn.strength / totalStrength;
    for (const cat of cats) {
      out[cat.categoryId] = (out[cat.categoryId] ?? 0) + share * clamp01(cat.score / peerMax);
    }
  }
  for (const key of Object.keys(out)) out[key] = clamp01(out[key]);
  return out;
}

export type BuildProfileInput = {
  cfg: EngineConfig;
  categories: InterestCategory[];
  baseInterests: { categoryId: string; baseScore: number }[];
  dynamicScores: InterestScoreRow[];
  confidences: ConfidenceRow[];
  connectionInfluence: Record<string, number>;
  now?: number;
};

/**
 * Endgültiges Interessenprofil:
 * 80 % Grundinteressen + 20 % dynamische Interessen,
 * Connections mit maximal `weight.connection_max` Einfluss.
 * Nicht übernommene (unsichere) Kategorien fließen nur mit ihrer
 * Confidence gewichtet ein.
 */
export function buildProfile(input: BuildProfileInput): InterestProfileEntry[] {
  const { cfg, categories, baseInterests, dynamicScores, confidences, connectionInfluence } = input;
  const now = input.now ?? Date.now();

  const byId = new Map(categories.map((c) => [c.id, c]));
  const baseMap = new Map(baseInterests.map((b) => [b.categoryId, b.baseScore]));
  const confMap = new Map(confidences.map((c) => [c.categoryId, c]));

  const decayed = new Map<string, number>();
  for (const row of dynamicScores) {
    decayed.set(row.categoryId, decayScore(cfg, row.dynamicScore, row.lastDecayAt, now));
  }
  const maxDynamic = Math.max(1, ...decayed.values());

  const maxBase = Math.max(1, ...baseMap.values());
  const ids = new Set<string>([
    ...baseMap.keys(),
    ...decayed.keys(),
    ...Object.keys(connectionInfluence),
  ]);

  const entries: InterestProfileEntry[] = [];
  for (const id of ids) {
    const category = byId.get(id);
    if (!category || !category.active) continue;

    const baseScore = baseMap.get(id) ?? 0;
    const dynamicScore = decayed.get(id) ?? 0;
    const conf = confMap.get(id);
    const promoted = conf?.promoted ?? false;
    const ratio = confidenceRatio(cfg, conf?.confidence ?? 0);

    const baseNorm = clamp01(baseScore / maxBase);
    const dynamicNorm = clamp01(dynamicScore / maxDynamic) * (promoted ? 1 : ratio);
    const connectionNorm = clamp01(connectionInfluence[id] ?? 0);

    const score =
      100 *
      clamp01(
        cfg["weight.base"] * baseNorm +
          cfg["weight.dynamic"] * dynamicNorm +
          cfg["weight.connection_max"] * connectionNorm,
      );

    entries.push({
      categoryId: id,
      slug: category.slug,
      name: category.name,
      kind: category.kind,
      baseScore,
      dynamicScore,
      connectionScore: connectionNorm,
      confidence: ratio,
      promoted,
      score,
    });
  }

  return entries.sort((a, b) => b.score - a.score);
}

/** Bewertet einen Inhalt anhand seiner Kategorien gegen ein Interessenprofil. */
export function scoreContent(
  entries: InterestProfileEntry[],
  contentCategories: { categoryId: string; weight: number }[],
) {
  if (contentCategories.length === 0) return { score: 0, matchedCategoryIds: [] as string[] };
  const map = new Map(entries.map((e) => [e.categoryId, e.score]));
  let total = 0;
  let weightSum = 0;
  const matched: string[] = [];
  for (const cat of contentCategories) {
    const value = map.get(cat.categoryId);
    weightSum += cat.weight;
    if (value === undefined) continue;
    total += value * cat.weight;
    matched.push(cat.categoryId);
  }
  return { score: weightSum > 0 ? total / weightSum : 0, matchedCategoryIds: matched };
}

export function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function isSameUtcDay(a: number, b: number) {
  return Math.floor(a / DAY_MS) === Math.floor(b / DAY_MS);
}
