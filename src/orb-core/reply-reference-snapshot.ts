/**
 * C1: persistente Reply-Referenz. Rein, ohne DB, ohne Semantik.
 *
 * Speichert ausschliesslich die serverseitig geprüfte ID des ORB-Turns, auf
 * den sich die neue Nutzerzeile bezieht. Keine Bestätigungs-, Aktivierungs-,
 * Wichtigkeits- oder Sicherheitswirkung. Keine PII, keine Memory-, Prompt-
 * oder Antwortinhalte.
 */
import type { ReplyReference } from "@/orb-core/memory-usage";

/** Einziges Feld, das C1 in `state_snapshot` der USER-Zeile schreibt. */
export const REPLY_REF_KEY = "reply_to_orb_message_id" as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True nur für eine kanonische UUID-Zeichenkette. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * `state_snapshot` der USER-Zeile.
 *
 * - gültige, serverseitig bestätigte Referenz → `{ reply_to_orb_message_id }`
 * - sonst → `{}` (unverändertes bisheriges Verhalten)
 *
 * Es wird ausschliesslich `referencedOrbTurnId` verwendet, also die ID, die
 * `loadReplyReference` bereits gegen id + user_id + role='orb' geprüft hat.
 * Eine vom Client gemeldete, aber nicht bestätigte ID wird nie gespeichert.
 */
export function userReplySnapshot(
  reference: ReplyReference | null | undefined,
): Record<string, string> {
  const id = reference?.referencedOrbTurnId;
  if (!isUuid(id)) return {};
  return { [REPLY_REF_KEY]: id };
}
