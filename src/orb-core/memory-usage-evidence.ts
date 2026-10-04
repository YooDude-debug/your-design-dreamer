/**
 * ORB Digital Brain – Phase 2E: Memory Usage Evidence.
 *
 * Reine Entscheidungsregel, isoliert: kein DB-Zugriff, keine Persistenz,
 * keine KI, nicht in den laufenden Chat eingebunden.
 *
 * Stufen (getrennt, nie vermischt):
 *  - retrieved:   gefunden, aber dem Modell nicht bereitgestellt
 *  - supplied:    dem Modell bereitgestellt, Beitrag nicht belegt
 *  - contributed: nachweisbarer Beitrag (alle Kriterien erfüllt)
 *  - unknown:     Beitrag nicht zuverlässig feststellbar
 *
 * „contributed" verlangt ALLE Kriterien:
 *  1. Erinnerung war dem Modell bereitgestellt (supplied).
 *  2. Ein unterscheidungskräftiges Merkmal (Ziffer oder ≥ 6 Zeichen) der
 *     Erinnerung steht wörtlich in der Antwort.
 *  3. Dieses Merkmal steht NICHT in der Nutzernachricht (sonst Echo).
 *  4. Das Merkmal gehört keiner anderen bereitgestellten Erinnerung (exklusiv).
 *  5. Die Erinnerung steht in keinem offenen Widerspruch, dessen Gegenseite
 *     ebenfalls in der Antwort belegt ist (sonst Zuordnung unklar → unknown).
 * Thematische Nähe, Retrieval oder Prompt-Aufnahme allein belegen nie Nutzung.
 */
import { distinctiveTokens } from "@/orb-core/memory-evaluation";

export type UsageEvidenceStatus = "retrieved" | "supplied" | "contributed" | "unknown";

export type UsageEvidenceReason =
  | "not_supplied"
  | "no_distinctive_token"
  | "no_reference_in_reply"
  | "reference_echoes_user_input"
  | "reference_shared_with_other_memory"
  | "contradiction_both_referenced"
  | "exclusive_verbatim_reference";

export interface UsageEvidenceMemory {
  id: string;
  content: string;
}

export interface UsageEvidenceInput {
  retrieved: readonly UsageEvidenceMemory[];
  suppliedIds: readonly string[];
  userText: string;
  replyText: string;
  /** Paare offener Widersprüche (IDs), z. B. aus Phase 2D. */
  contradictions?: readonly (readonly [string, string])[];
}

export interface UsageEvidenceEntry {
  id: string;
  status: UsageEvidenceStatus;
  reason: UsageEvidenceReason;
}

function has(haystack: string, token: string): boolean {
  const e = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${e}($|[^\\p{L}\\p{N}])`, "u").test(haystack);
}

/** Exklusive, in der Antwort belegte Merkmale einer bereitgestellten Erinnerung. */
function evidenceTokens(
  m: UsageEvidenceMemory,
  others: UsageEvidenceMemory[],
  user: string,
  reply: string,
): { tokens: string[]; reason: UsageEvidenceReason } {
  const own = distinctiveTokens(m.content);
  if (own.length === 0) return { tokens: [], reason: "no_distinctive_token" };
  const inReply = own.filter((t) => has(reply, t));
  if (inReply.length === 0) return { tokens: [], reason: "no_reference_in_reply" };
  const notEcho = inReply.filter((t) => !has(user, t));
  if (notEcho.length === 0) return { tokens: [], reason: "reference_echoes_user_input" };
  const otherTokens = new Set(others.flatMap((o) => distinctiveTokens(o.content)));
  const exclusive = notEcho.filter((t) => !otherTokens.has(t));
  if (exclusive.length === 0) return { tokens: [], reason: "reference_shared_with_other_memory" };
  return { tokens: exclusive, reason: "exclusive_verbatim_reference" };
}

export function evaluateUsageEvidence(input: UsageEvidenceInput): UsageEvidenceEntry[] {
  const supplied = new Set(input.suppliedIds);
  const user = input.userText.toLowerCase();
  const reply = input.replyText.toLowerCase();
  const suppliedMems = input.retrieved.filter((m) => supplied.has(m.id));

  const pre = new Map<string, UsageEvidenceReason>();
  for (const m of suppliedMems) {
    const others = suppliedMems.filter((o) => o.id !== m.id);
    pre.set(m.id, evidenceTokens(m, others, user, reply).reason);
  }
  const proven = (id: string) => pre.get(id) === "exclusive_verbatim_reference";

  return input.retrieved.map((m): UsageEvidenceEntry => {
    if (!supplied.has(m.id)) return { id: m.id, status: "retrieved", reason: "not_supplied" };
    const reason = pre.get(m.id)!;
    if (reason !== "exclusive_verbatim_reference") {
      // Kein Merkmal / kein Bezug → bereitgestellt, Beitrag nicht belegt.
      // Echo, geteilte Merkmale → Beitrag möglich, aber nicht zuordenbar.
      const status: UsageEvidenceStatus =
        reason === "no_distinctive_token" || reason === "no_reference_in_reply" ? "supplied" : "unknown";
      return { id: m.id, status, reason };
    }
    const conflicted = (input.contradictions ?? []).some(
      ([a, b]) => (a === m.id && proven(b)) || (b === m.id && proven(a)),
    );
    if (conflicted) return { id: m.id, status: "unknown", reason: "contradiction_both_referenced" };
    return { id: m.id, status: "contributed", reason };
  });
}
