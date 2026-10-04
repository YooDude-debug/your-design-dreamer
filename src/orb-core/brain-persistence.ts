/**
 * ORB Digital Brain – Phase 4A: Persistenz-Vorbereitung (rein, kein Schreiben).
 *
 * Übersetzt die Entscheidungen aus 2D/2E/2F-2G in geplante Schreibsätze für
 * die spätere Aktivierung (Phase 4B). Nichts hier greift auf die DB zu.
 *
 * Feldzuordnung (bestehend wiederverwendet, sonst „neu, Phase 4B"):
 *  - Lebenszyklus        → orb_nodes.lifecycle (Enum braucht dormant/expired/protected – neu)
 *  - Schutzgruppe        → orb_nodes.protection_group (neu, nullable)
 *  - Beginn Ruhephase    → orb_nodes.dormant_since (neu, nullable)
 *  - letzter Beitrag     → orb_nodes.last_contributed_at (neu, nullable)
 *  - Herkunft/Bestätigung→ orb_nodes.source (bestehend: user_stated=bestätigt)
 *  - Verknüpfungsart     → orb_connections.metadata.relation (bestehend, jsonb)
 */
import type { PreservationPlan } from "@/orb-core/contradiction-preservation";
import type { UsageEvidenceEntry } from "@/orb-core/memory-usage-evidence";
import type {
  BrainState,
  LifecycleDecision,
  ProtectionCategory,
} from "@/orb-core/reversible-lifecycle";

export type MemoryWritePlan =
  | { kind: "reinforce_existing"; existingId: string }
  | {
      kind: "insert_new";
      source: "user_stated" | "inferred";
      link: { targetId: string; relation: NonNullable<PreservationPlan["relation"]> } | null;
      /** Bestehende Erinnerung bleibt inhaltlich unverändert. */
      existingUnchanged: true;
    }
  | { kind: "skip"; reason: "unknown_structure" };

/** 2D → geplanter Schreibvorgang. Überschreibt nie, Historie bleibt unberührt. */
export function planMemoryWrite(existingId: string, plan: PreservationPlan): MemoryWritePlan {
  if (plan.kind === "duplicate") return { kind: "reinforce_existing", existingId };
  if (plan.kind === "unknown") return { kind: "skip", reason: "unknown_structure" };
  return {
    kind: "insert_new",
    source: plan.newClass === "confirmed" ? "user_stated" : "inferred",
    link: plan.relation ? { targetId: existingId, relation: plan.relation } : null,
    existingUnchanged: true,
  };
}

/** 2E → nur IDs + Zeitpunkt für tatsächlich belegte Beiträge. Keine Inhalte. */
export function planUsageWrites(
  entries: readonly UsageEvidenceEntry[],
  nowIso: string,
): { id: string; last_contributed_at: string }[] {
  return entries
    .filter((e) => e.status === "contributed")
    .map((e) => ({ id: e.id, last_contributed_at: nowIso }));
}

export type LifecyclePatch = {
  lifecycle: BrainState;
  dormant_since?: string | null;
  protection_group?: ProtectionCategory | null;
};

/** 2F/2G → Feldänderung; null = nichts schreiben. */
export function planLifecycleWrite(
  decision: LifecycleDecision,
  nowIso: string,
  group?: ProtectionCategory | null,
): LifecyclePatch | null {
  if (!decision.changed) return null;
  const patch: LifecyclePatch = { lifecycle: decision.next };
  if (decision.next === "dormant") patch.dormant_since = nowIso;
  if (decision.next === "active") patch.dormant_since = null;
  if (decision.next === "protected" && group) patch.protection_group = group;
  if (decision.reason === "protection_withdrawn") patch.protection_group = null;
  return patch;
}
