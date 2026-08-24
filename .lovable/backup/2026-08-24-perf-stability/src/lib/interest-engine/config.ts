/**
 * Konfiguration der Interest Engine.
 *
 * Sämtliche Punktwerte, Schwellen und Gewichte liegen in der Tabelle
 * `interest_engine_config` und sind damit ohne Code-Änderung anpassbar.
 * Die hier hinterlegten Defaults dienen nur als Fallback, falls ein
 * Schlüssel (noch) nicht in der Datenbank existiert.
 */

import type { InteractionAction } from "./types";

export const CONFIG_DEFAULTS = {
  "points.post_view": 2,
  "points.post_view_complete": 5,
  "points.post_like": 5,
  "points.post_comment": 8,
  "points.post_share": 6,
  "points.post_save": 7,
  "points.slangtag_play": 4,
  "points.slangtag_use": 10,
  "points.slangtag_save": 12,
  "points.profile_visit": 3,
  "points.search": 4,
  "points.message": 15,
  "points.connection": 20,
  "points.dwell_per_second": 0.5,
  "points.dwell_max": 15,
  "weight.base": 0.8,
  "weight.dynamic": 0.2,
  "weight.connection_max": 0.2,
  "confidence.threshold": 100,
  "confidence.min_events": 15,
  "confidence.min_days": 3,
  "confidence.view_weight": 1,
  "confidence.engage_weight": 4,
  "confidence.demote_factor": 0.5,
  "decay.half_life_days": 21,
  "decay.min_score": 0.5,
  "connection.message_weight": 1,
  "connection.like_weight": 2,
  "connection.comment_weight": 3,
  "connection.shared_interest_weight": 4,
  "connection.shared_tag_weight": 2,
  "connection.min_strength": 10,
  "cache.profile_ttl_seconds": 300,
  "recommend.default_limit": 20,
} as const;

export type ConfigKey = keyof typeof CONFIG_DEFAULTS;

export type EngineConfig = Record<ConfigKey, number>;

/** Baut eine vollständige Konfiguration aus DB-Werten + Defaults. */
export function buildConfig(rows: { key: string; value: number | string }[] = []): EngineConfig {
  const cfg = { ...CONFIG_DEFAULTS } as Record<string, number>;
  for (const row of rows) {
    const value = typeof row.value === "string" ? Number(row.value) : row.value;
    if (row.key in cfg && Number.isFinite(value)) cfg[row.key] = value;
  }
  return cfg as EngineConfig;
}

/** Punkte-Schlüssel je Aktion – keine festen Werte im Code. */
export function pointsKeyFor(action: InteractionAction): ConfigKey {
  return `points.${action}` as ConfigKey;
}
