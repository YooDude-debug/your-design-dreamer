/**
 * ORB Core – B2: kontrollierte Fortsetzung einer abgebrochenen Antwort.
 *
 * Läuft ausschliesslich auf ausdrücklichen Klick des Benutzers. Schutz gegen
 * Doppelgenerierung: Die Nachricht wird VOR dem Modellaufruf atomar von
 * `incomplete` auf `continuing` gesetzt (bedingtes Update). Ein zweiter,
 * gleichzeitiger Klick findet keine passende Zeile mehr und erzeugt keinen
 * Modellaufruf. Keine automatische Wiederholung, keine Gedächtnisänderung.
 */

import type { Json } from "@/integrations/supabase/types";
import { generateReply } from "@/orb-core/llm/select.server";
import {
  MAX_CONTINUATIONS,
  buildContinuationInput,
  buildContinuationSystem,
  continuationBase,
  mergeContinuation,
  readCompletion,
  type ReplyCompletion,
} from "@/orb-core/long-form";
import { extractVisualMarker } from "@/orb-core/visual/intent";
import type { scopedDb } from "@/orb-core/scope";

type DB = ReturnType<typeof scopedDb>;

export type ContinueResult =
  | { status: "ok"; messageId: string; body: string; completion: ReplyCompletion; addedChars: number }
  | { status: "rejected"; reason: "not_found" | "not_incomplete" | "limit_reached" | "busy" }
  | { status: "error"; reason: "quota" | "unavailable"; completion: ReplyCompletion };

export async function continueReply(
  db: DB,
  userId: string,
  messageId: string,
): Promise<ContinueResult> {
  const { data: row, error } = await db
    .from("orb_messages")
    .select("id, role, body, created_at, state_snapshot")
    .eq("user_id", userId)
    .eq("id", messageId)
    .maybeSingle();
  if (error) throw new Error("continuation_load_failed");
  if (!row || row.role !== "orb") return { status: "rejected", reason: "not_found" };
  const completion = readCompletion(row.state_snapshot);
  if (!completion || completion.status !== "incomplete") {
    return { status: "rejected", reason: completion?.status === "continuing" ? "busy" : "not_incomplete" };
  }
  if (completion.continuations >= MAX_CONTINUATIONS) return { status: "rejected", reason: "limit_reached" };

  const baseSnapshot = (row.state_snapshot ?? {}) as Record<string, Json>;
  const withCompletion = (c: ReplyCompletion) =>
    ({ ...baseSnapshot, completion: c as unknown as Json }) as Json;

  // Atomare Sperre: nur wenn der gespeicherte Zustand noch `incomplete` ist.
  const claim = await db
    .from("orb_messages")
    .update({ state_snapshot: withCompletion({ ...completion, status: "continuing" }) })
    .eq("user_id", userId)
    .eq("id", messageId)
    .eq("state_snapshot->completion->>status", "incomplete")
    .select("id");
  if (claim.error) throw new Error("continuation_claim_failed");
  if (!claim.data || claim.data.length !== 1) return { status: "rejected", reason: "busy" };

  // Ursprüngliche Anfrage = unmittelbar vorangehende Benutzernachricht.
  const prev = await db
    .from("orb_messages")
    .select("body")
    .eq("user_id", userId)
    .eq("role", "user")
    .lt("created_at", row.created_at)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  const originalRequest = prev.data?.[0]?.body ?? "";

  // Abgeschnittenes letztes Wort verwerfen; das Modell schreibt es neu.
  const base = continuationBase(row.body);
  let spoken: Awaited<ReturnType<typeof generateReply>>;
  try {
    // Genau ein Modellaufruf.
    spoken = await generateReply({
      system: buildContinuationSystem(),
      text: buildContinuationInput(originalRequest, base),
    });
  } catch {
    spoken = {
      reply: "",
      status: "unavailable",
      meta: { provider: "local", fallbackUsed: false, reason: null },
    };
  }

  const piece = spoken.status === "ok" ? extractVisualMarker(spoken.reply).text : "";
  if (spoken.status !== "ok" || !piece.trim()) {
    // Sperre lösen; Text unverändert, erneuter Versuch nur per Klick.
    const back: ReplyCompletion = { ...completion, status: "incomplete" };
    await db
      .from("orb_messages")
      .update({ state_snapshot: withCompletion(back) })
      .eq("user_id", userId)
      .eq("id", messageId);
    return {
      status: "error",
      reason: spoken.status === "quota" ? "quota" : "unavailable",
      completion: back,
    };
  }

  const { merged, added } = mergeContinuation(base, piece);
  const stillIncomplete = spoken.meta.incomplete ?? null;
  const next: ReplyCompletion = {
    status: stillIncomplete ? "incomplete" : "complete",
    reason: stillIncomplete ?? completion.reason,
    continuations: completion.continuations + 1,
  };
  const saved = await db
    .from("orb_messages")
    .update({ body: merged, state_snapshot: withCompletion(next) })
    .eq("user_id", userId)
    .eq("id", messageId)
    .eq("state_snapshot->completion->>status", "continuing")
    .select("id");
  if (saved.error || !saved.data || saved.data.length !== 1) {
    throw new Error("continuation_save_failed");
  }
  return { status: "ok", messageId, body: merged, completion: next, addedChars: added.length };
}
