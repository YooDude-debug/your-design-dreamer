/**
 * P5-C: Lesender Zugriff auf den vorherigen ORB-Turn und dessen
 * model-visible Memory-IDs. Nur per Nutzer (RLS + expliziter user_id-Filter).
 * Wird aktuell von keiner Entscheidungslogik aufgerufen.
 */
import { findPreviousOrbTurn, type OrbTurnMemoryRef } from "@/orb-core/memory-usage";

type Db = { from: (t: string) => any };

export async function loadPreviousOrbTurnMemoryRef(
  db: Db,
  userId: string,
  before?: string,
): Promise<OrbTurnMemoryRef | null> {
  let query = db
    .from("orb_messages")
    .select("id, role, created_at, state_snapshot")
    .eq("user_id", userId)
    .eq("role", "orb");
  if (before) query = query.lt("created_at", before);
  const res = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1);
  if (res.error) throw new Error(res.error.message);
  return findPreviousOrbTurn(res.data ?? [], before);
}

/**
 * P5-H: ausdrückliche Reply-Referenz serverseitig prüfen.
 * Filter: id + user_id (aus der Serversitzung) + role='orb'. RLS zusätzlich.
 * Fehler oder kein Treffer → ungültige Referenz, Anfrage läuft normal weiter.
 */
export async function loadReplyReference(
  db: Db,
  userId: string,
  replyToOrbMessageId: string | undefined,
): Promise<import("@/orb-core/memory-usage").ReplyReference> {
  const { resolveReplyReference } = await import("@/orb-core/memory-usage");
  if (!replyToOrbMessageId) return resolveReplyReference(undefined, null);
  try {
    const res = await db
      .from("orb_messages")
      .select("id, role, created_at, state_snapshot")
      .eq("id", replyToOrbMessageId)
      .eq("user_id", userId)
      .eq("role", "orb")
      .maybeSingle();
    if (res.error || !res.data) return resolveReplyReference(replyToOrbMessageId, null);
    return resolveReplyReference(replyToOrbMessageId, res.data);
  } catch {
    return resolveReplyReference(replyToOrbMessageId, null);
  }
}
