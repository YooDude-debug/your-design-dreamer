/**
 * P5-B4: Bestätigungswirkung – ausschliesslich für CONFIRMED_SINGLE_CANDIDATE.
 *
 * Wirkung auf genau EINE bestehende Memory: activation_count +1 und
 * last_accessed_at = jetzt. Nichts sonst: keine Änderung an safety,
 * importance, confidence, content, norm_key; keine neue Memory; keine
 * andere Memory. AMBIGUOUS_CANDIDATE und NONE haben nie eine Wirkung.
 */
import type { ConfirmationTurnDiagnostic } from "@/orb-core/confirmation-signal";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any };

export type ConfirmationEffect = "NONE" | "ACTIVATED_SINGLE";

/**
 * Liefert die einzige ID, die bestätigt werden darf – oder null.
 * `alreadyActivated`: IDs, die in diesem Zug bereits aktiviert werden
 * (Recall-Pfad bzw. exakter Treffer). Diese erhalten KEINE zweite Aktivierung.
 */
export function confirmationEffectTarget(
  diag: ConfirmationTurnDiagnostic,
  alreadyActivated: ReadonlySet<string>,
): string | null {
  if (diag.confirmation_signal !== "POSITIVE_CONFIRMATION") return null;
  if (diag.confirmation_diagnosis !== "CONFIRMED_SINGLE_CANDIDATE") return null;
  if (!diag.referenced_orb_message_id) return null;
  if (diag.visible_memory_count !== 1) return null;
  const id = diag.candidate_memory_id;
  if (typeof id !== "string" || id.length === 0) return null;
  if (alreadyActivated.has(id)) return null;
  return id;
}

/**
 * Wendet die Bestätigung auf genau eine Zeile an. Serverseitige Prüfung:
 * die Zeile muss für diesen Benutzer existieren. Ein einziger UPDATE-Befehl
 * (atomar), gebunden an id + user_id + gelesenen activation_count, damit
 * nie mehr als +1 entsteht. Jeder Fehler → keine Wirkung, Turn läuft weiter.
 */
export async function applyConfirmationEffect(
  db: Db,
  userId: string,
  memoryId: string,
  nowMs: number,
  tick: <T>(p: PromiseLike<T>) => Promise<T> = (p) => Promise.resolve(p),
): Promise<ConfirmationEffect> {
  try {
    const found = await tick(
      db
        .from("orb_nodes")
        .select("id, activation_count")
        .eq("id", memoryId)
        .eq("user_id", userId)
        .maybeSingle(),
    );
    const row = (
      found as { data?: { id?: string; activation_count?: number } | null; error?: unknown }
    )?.data;
    if ((found as { error?: unknown })?.error || !row || row.id !== memoryId) return "NONE";
    if (typeof row.activation_count !== "number") return "NONE";
    const upd = await tick(
      db
        .from("orb_nodes")
        .update({
          activation_count: row.activation_count + 1,
          last_accessed_at: new Date(nowMs).toISOString(),
        })
        .eq("id", memoryId)
        .eq("user_id", userId)
        .eq("activation_count", row.activation_count)
        .select("id"),
    );
    const u = upd as { data?: unknown[] | null; error?: unknown };
    if (u?.error || !Array.isArray(u?.data) || u.data.length !== 1) return "NONE";
    return "ACTIVATED_SINGLE";
  } catch {
    return "NONE";
  }
}
