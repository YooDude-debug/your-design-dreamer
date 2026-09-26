/**
 * ORB Core – kleiner Context-PoC (rein, deterministisch, ohne Abfragen).
 *
 * PoC 1: wählt aus BEREITS geladenen Daten Gesprächsfenster und passendes
 *        offenes Thema für die Formulierung einer eigenen Frage.
 * PoC 2: beobachtender Drift-Check NACH der Antwort. Erzeugt nur Flags –
 *        keine Formel, kein Score, keine Wirkung auf Antwort, Memory, Graph,
 *        Threads, Curiosity oder Autonomie.
 */

import { contextWindow, formatConversationContext, type ConversationMessage } from "./context";
import type { ThoughtThread } from "./continuity";
import { contentTokens } from "./memory";

/* ------------------------------------------------------------------ PoC 1 */

export type QuestionContext = {
  context: string | null;
  openThreads: { title: string; status: string; unknown: string[] }[];
  /** Nur für Messung: Anzahl Nachrichten im Fenster, gewählter Faden. */
  messages: number;
  threadId: string | null;
};

/**
 * @param recentMessages `orb_messages` wie geladen (neueste zuerst)
 * @param threads bereits projizierte Fäden
 */
export function questionContextFor(input: {
  recentMessages: { role: string; body: string }[];
  threads: ThoughtThread[];
  gap: { nodeId: string | null; topic: string | null };
}): QuestionContext {
  const chronological: ConversationMessage[] = [...input.recentMessages]
    .reverse()
    .map((m) => ({ role: m.role === "user" ? "user" : "orb", body: m.body }));
  const window = contextWindow(chronological);
  const open = input.threads.filter((t) => t.status !== "RESOLVED" && t.unknown.length > 0);
  const byNode = input.gap.nodeId
    ? open.find((t) => t.nodeIds.includes(input.gap.nodeId!))
    : undefined;
  const topic = input.gap.topic?.toLowerCase() ?? null;
  const thread =
    byNode ?? (topic ? open.find((t) => (t.topic ?? "").toLowerCase() === topic) : undefined);
  return {
    context: formatConversationContext(window),
    openThreads: thread
      ? [{ title: thread.title, status: thread.status, unknown: thread.unknown }]
      : [],
    messages: window.length,
    threadId: thread?.id ?? null,
  };
}

/* ------------------------------------------------------------------ PoC 2 */

export type DriftFlags = {
  /** null = nicht prüfbar (kein DIRECT_ANSWER). */
  intent_preserved: boolean | null;
  /** null = keine Erinnerung an den Prompt übergeben. */
  relevant_context_referenced: boolean | null;
  /** null = kein Faden an den Prompt übergeben. */
  active_thread_preserved: boolean | null;
  contradiction_detected: boolean;
  possible_topic_shift: boolean;
  drift_detected: boolean;
  drift_reason: string[];
};

function overlaps(a: string[], b: Set<string>): boolean {
  return a.some((t) => b.has(t));
}

export function driftCheck(input: {
  userText: string;
  mode: string;
  context: string | null;
  memories: string[];
  thread: { title: string; unknown: string[] } | null;
  contradictions: number;
  reply: string;
}): DriftFlags {
  const replyTokens = contentTokens(input.reply);
  const replySet = new Set(replyTokens);
  const userTokens = contentTokens(input.userText);

  const onlyCounterQuestion =
    input.reply.trim().endsWith("?") && !/[.!]\s/.test(input.reply.trim());
  const intent_preserved =
    input.mode === "DIRECT_ANSWER" ? !onlyCounterQuestion || overlaps(userTokens, replySet) : null;

  const relevant_context_referenced =
    input.memories.length === 0
      ? null
      : input.memories.some((m) => overlaps(contentTokens(m), replySet));

  const active_thread_preserved = input.thread
    ? overlaps(contentTokens([input.thread.title, ...input.thread.unknown].join(" ")), replySet)
    : null;

  const known = new Set([
    ...userTokens,
    ...contentTokens(input.context ?? ""),
    ...input.memories.flatMap((m) => contentTokens(m)),
  ]);
  const possible_topic_shift = replyTokens.length >= 3 && !overlaps(replyTokens, known);

  const reasons: string[] = [];
  if (intent_preserved === false) reasons.push("direct_answer_replaced_by_counter_question");
  if (relevant_context_referenced === false) reasons.push("no_prompt_memory_referenced");
  if (active_thread_preserved === false) reasons.push("active_thread_not_referenced");
  if (possible_topic_shift) reasons.push("reply_shares_no_term_with_input_context_memories");
  const contradiction_detected = input.contradictions > 0;

  return {
    intent_preserved,
    relevant_context_referenced,
    active_thread_preserved,
    contradiction_detected,
    possible_topic_shift,
    drift_detected: intent_preserved === false || possible_topic_shift,
    drift_reason: reasons,
  };
}
