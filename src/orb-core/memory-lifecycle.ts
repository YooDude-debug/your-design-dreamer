/**
 * ORB Memory-Lebenszyklus (P14 S1) – reiner, zustandsloser Baustein.
 *
 * Enthält ausschließlich die bisherigen Regeln, unverändert aus
 * analysis/validate.ts (lifecycleFor) und analysis/apply.server.ts
 * (LIFECYCLE_ORDER, weaken, Fortschreibung je Knoten) ausgelagert.
 * Keine DB, keine Seiteneffekte, kein Scope-Wissen. „Vergessen“ heißt
 * Stufenverlust – niemals Löschen. Keine Dormant-/Pruning-/Reaktivierungslogik.
 */
import type { OrbTemporalScope } from "@/orb-core/analysis/schema";

export type Lifecycle = "active" | "weak" | "stale" | "archived" | "forgotten";

export const LIFECYCLE_ORDER: readonly Lifecycle[] = [
  "active",
  "weak",
  "stale",
  "archived",
  "forgotten",
];

const DAY = 86_400_000;

/** Lebenszyklus eines Knotens aus Zeitbezug und Ruhezeit. */
export function lifecycleFor(input: {
  temporalScope: OrbTemporalScope;
  ageMs: number;
  lastAccessedAgeMs: number;
  forgotten?: boolean;
}): Lifecycle {
  if (input.forgotten) return "forgotten";
  if (input.temporalScope === "persistent") return "active";
  const idleDays = input.lastAccessedAgeMs / DAY;
  if (input.temporalScope === "one_time") {
    if (idleDays >= 7) return "archived";
    if (idleDays >= 1) return "stale";
    return "active";
  }
  if (input.temporalScope === "temporary") {
    if (idleDays >= 30) return "archived";
    if (idleDays >= 7) return "stale";
    if (idleDays >= 2) return "weak";
    return "active";
  }
  // long_term
  if (idleDays >= 180) return "stale";
  if (idleDays >= 60) return "weak";
  return "active";
}

/** Eine Stufe schwächer – niemals löschen, niemals überspringen. */
export function weaken(current: Lifecycle): Lifecycle {
  const index = LIFECYCLE_ORDER.indexOf(current);
  return LIFECYCLE_ORDER[Math.min(LIFECYCLE_ORDER.length - 1, index + 1)]!;
}

/**
 * Fortschreibung eines geladenen Knotens am Ende eines Analyse-Laufs.
 * Liefert den neuen Zustand oder null, wenn sich nichts ändert.
 */
export function analysisLifecycleUpdate(
  row: { temporal_scope: string; created_at: string; last_accessed_at: string; lifecycle: string },
  now: number,
): Lifecycle | null {
  const next = lifecycleFor({
    temporalScope: row.temporal_scope as OrbTemporalScope,
    ageMs: now - new Date(row.created_at).getTime(),
    lastAccessedAgeMs: now - new Date(row.last_accessed_at).getTime(),
    forgotten: row.lifecycle === "forgotten",
  });
  return next === row.lifecycle ? null : next;
}
