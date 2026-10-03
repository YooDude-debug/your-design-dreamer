/**
 * ORB P14 S2 – Passive Memory Evaluation.
 *
 * Rein beobachtend: berechnet Relevanz, Wichtigkeit und Nutzung getrennt und
 * liefert ein Protokoll (nur IDs, Zahlen, Status). Kein DB-Zugriff, keine
 * Persistenz, keine Wirkung auf Retrieval, Ranking, Auswahl oder Lebenszyklus.
 *
 * Nutzung: Standard `unknown`. Gefunden, ausgewählt, im Prompt oder verfügbar
 * zählt NIE als Nutzung. `usage_candidate` nur bei einer eindeutigen,
 * wörtlich belegbaren Referenz im Antworttext. Das beweist keine interne
 * Verwendung durch das Sprachmodell – es ist ein Kandidat, kein Nachweis.
 */
import type { OrbDataScope } from "@/orb-core/scope-values";

export type UsageStatus = "unknown" | "usage_candidate";

export type UsageReason =
  | "not_model_visible"
  | "no_reference_in_reply"
  | "reference_also_in_user_input"
  | "reference_ambiguous"
  | "no_distinctive_token"
  | "verbatim_reference_in_reply";

export interface EvaluationInputMemory {
  id: string;
  /** Kontextrelevanz aus dem bestehenden Retrieval (memoryRelevance) – nur gelesen. */
  relevance: number;
  /** Gespeicherte Wichtigkeit (orb_nodes.importance) – nur gelesen. */
  importance: number;
  /** Nur für die Referenzprüfung im Arbeitsspeicher; wird nie protokolliert. */
  content: string;
}

export interface MemoryEvaluationEntry {
  id: string;
  relevance: number;
  importance: number;
  usage: UsageStatus;
  usage_reason: UsageReason;
}

export interface MemoryEvaluation {
  kind: "orb.memory_evaluation";
  version: 1;
  scope: OrbDataScope;
  entries: MemoryEvaluationEntry[];
  /** Einträge außerhalb des Sitzungsbereichs (sollte immer 0 sein). */
  dropped_out_of_scope: number;
}

const TOKEN_RE = /[\p{L}\p{N}][\p{L}\p{N}._-]*[\p{L}\p{N}]|\p{N}/gu;

/**
 * Unterscheidungskräftige Zeichenfolgen eines Memory-Inhalts: enthalten eine
 * Ziffer (z. B. „5070“, „RTX5070“) oder sind ≥ 6 Zeichen lang. Kurze
 * Allerweltswörter würden falsche Zuordnungen erzeugen.
 */
export function distinctiveTokens(content: string): string[] {
  const out = new Set<string>();
  for (const m of content.toLowerCase().matchAll(TOKEN_RE)) {
    const t = m[0];
    if ((/\p{N}/u.test(t) && t.length >= 2) || t.length >= 6) out.add(t);
  }
  return [...out];
}

function containsToken(haystack: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(haystack);
}

/**
 * Passive Bewertung. Reine Funktion: gleiche Eingabe → gleiches Ergebnis.
 */
export function evaluateMemories(input: {
  scope: OrbDataScope;
  memories: (EvaluationInputMemory & { scope?: OrbDataScope })[];
  modelVisibleIds: readonly string[];
  replyText: string;
  userText: string;
}): MemoryEvaluation {
  const reply = input.replyText.toLowerCase();
  const user = input.userText.toLowerCase();
  const visible = new Set(input.modelVisibleIds);
  const inScope = input.memories.filter((m) => m.scope === undefined || m.scope === input.scope);

  // Token → Memories, die es enthalten (für Eindeutigkeit).
  const tokensById = new Map<string, string[]>();
  const owners = new Map<string, Set<string>>();
  for (const m of inScope) {
    const tokens = distinctiveTokens(m.content);
    tokensById.set(m.id, tokens);
    for (const t of tokens) {
      if (!owners.has(t)) owners.set(t, new Set());
      owners.get(t)!.add(m.id);
    }
  }

  const entries = [...inScope]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((m): MemoryEvaluationEntry => {
      const base = { id: m.id, relevance: m.relevance, importance: m.importance };
      if (!visible.has(m.id))
        return { ...base, usage: "unknown", usage_reason: "not_model_visible" };
      const tokens = tokensById.get(m.id) ?? [];
      if (tokens.length === 0)
        return { ...base, usage: "unknown", usage_reason: "no_distinctive_token" };
      const inReply = tokens.filter((t) => containsToken(reply, t));
      if (inReply.length === 0)
        return { ...base, usage: "unknown", usage_reason: "no_reference_in_reply" };
      const notFromUser = inReply.filter((t) => !containsToken(user, t));
      if (notFromUser.length === 0)
        return { ...base, usage: "unknown", usage_reason: "reference_also_in_user_input" };
      const unique = notFromUser.filter((t) => owners.get(t)?.size === 1);
      if (unique.length === 0)
        return { ...base, usage: "unknown", usage_reason: "reference_ambiguous" };
      return { ...base, usage: "usage_candidate", usage_reason: "verbatim_reference_in_reply" };
    });

  return {
    kind: "orb.memory_evaluation",
    version: 1,
    scope: input.scope,
    entries,
    dropped_out_of_scope: input.memories.length - inScope.length,
  };
}
