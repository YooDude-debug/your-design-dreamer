/**
 * ORB Core – Kontinuität, serverseitige Anbindung (experimenteller Bereich).
 *
 * Diese Datei speichert und liest ausschliesslich, was die reine Logik in
 * `orb-continuity.ts` entscheidet: offene Gedankenfäden und das beobachtete
 * Stilprofil. Es gibt hier keine zweite Entscheidungslogik.
 *
 * Grundsatz: VERGESSEN ≠ LÖSCHEN. Kein Vorgang hier löscht einen Faden;
 * er wird pausiert, abgeschwächt oder als geklärt markiert.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import {
  EMPTY_STYLE,
  THREAD_STATES,
  decayThread,
  observeStyle,
  pauseThread,
  reactivateThread,
  resolveThread,
  threadDraftFrom,
  threadRelevance,
  threadStatusAfter,
  type Contradiction,
  type StyleProfile,
  type ThoughtThread,
  type ThreadState,
} from "@/orb-core/continuity";
import { similarity, type InterestRow } from "@/orb-core/memory";

type DB = SupabaseClient<Database>;
type ThreadRow = Database["public"]["Tables"]["orb_threads"]["Row"];

/** Zähler der Datenbankabfragen (wird von `orb.server.ts` übergeben). */
export type Ticker = { tick<T>(p: PromiseLike<T>): Promise<T> };

/** Wie viele Fäden höchstens geladen werden – keine Vollabfrage. */
export const THREAD_LOAD_LIMIT = 12;
/** Ab dieser Relevanz gilt eine Eingabe als Berührung eines bestehenden Fadens. */
export const THREAD_MATCH_RELEVANCE = 0.3;
/** Ohne gemeinsames Thema braucht eine Zuordnung hohe inhaltliche Nähe. */
export const THREAD_MATCH_SIMILARITY = 0.5;

function asStatus(value: string): ThreadState {
  return (THREAD_STATES as readonly string[]).includes(value) ? (value as ThreadState) : "OPEN";
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function mapThread(row: ThreadRow): ThoughtThread {
  return {
    id: row.id,
    title: row.title,
    topic: row.topic,
    status: asStatus(row.status),
    known: asStrings(row.known),
    unknown: asStrings(row.unknown),
    curiosity: row.curiosity,
    importance: row.importance,
    lastActivationAt: new Date(row.last_activation_at).getTime(),
    activationCount: row.activation_count,
    resolvedAt: row.resolved_at === null ? null : new Date(row.resolved_at).getTime(),
    nodeIds: row.node_ids,
  };
}

export type LoadedThread = { thread: ThoughtThread; lastResumeAt: number | null };

/** Gezielt die letzten Fäden laden (nach Aktivität sortiert, begrenzt). */
export async function loadThreads(
  db: DB,
  userId: string,
  q: Ticker,
  limit = THREAD_LOAD_LIMIT,
): Promise<LoadedThread[]> {
  const res = await q.tick(
    db
      .from("orb_threads")
      .select("*")
      .eq("user_id", userId)
      .order("last_activation_at", { ascending: false })
      .limit(limit),
  );
  if (res.error) throw new Error(res.error.message);
  return res.data.map((row) => ({
    thread: mapThread(row),
    lastResumeAt: row.last_resume_at === null ? null : new Date(row.last_resume_at).getTime(),
  }));
}

/** Aktueller Zustand eines Fadens inklusive Verfall – nur berechnet. */
export function projectThread(thread: ThoughtThread, now: number): ThoughtThread {
  return { ...thread, ...decayThread(thread, now), status: threadStatusAfter(thread, now) };
}

async function writeThread(
  db: DB,
  userId: string,
  q: Ticker,
  thread: ThoughtThread,
  extra: { lastResumeAt?: number } = {},
): Promise<void> {
  const res = await q.tick(
    db
      .from("orb_threads")
      .update({
        status: thread.status,
        known: thread.known,
        unknown: thread.unknown,
        curiosity: thread.curiosity,
        importance: thread.importance,
        activation_count: thread.activationCount,
        node_ids: thread.nodeIds,
        last_activation_at: new Date(thread.lastActivationAt).toISOString(),
        resolved_at: thread.resolvedAt === null ? null : new Date(thread.resolvedAt).toISOString(),
        ...(extra.lastResumeAt === undefined
          ? {}
          : { last_resume_at: new Date(extra.lastResumeAt).toISOString() }),
      })
      .eq("id", thread.id)
      .eq("user_id", userId),
  );
  if (res.error) throw new Error(res.error.message);
}

export type ThreadSyncResult = {
  created: ThoughtThread | null;
  reactivated: ThoughtThread | null;
  paused: string[];
};

/**
 * Eine Eingabe auf die Fäden abbilden: passenden Faden verstärken, sonst einen
 * neuen anlegen. Unberührte Fäden pausieren (ohne Löschung).
 */
export async function syncThreads(
  db: DB,
  userId: string,
  q: Ticker,
  input: {
    text: string;
    topic: string | null;
    importance: number;
    focusNodeId: string | null;
    loaded: LoadedThread[];
    conversationTopics: string[];
    interests: InterestRow[];
    now: number;
  },
): Promise<ThreadSyncResult> {
  const now = input.now;
  const result: ThreadSyncResult = { created: null, reactivated: null, paused: [] };

  // 1. Passender bestehender Faden?
  let best: { thread: ThoughtThread; relevance: number } | null = null;
  for (const entry of input.loaded) {
    const thread = projectThread(entry.thread, now);
    if (thread.status === "RESOLVED") continue;
    const relevance = threadRelevance(thread, {
      text: input.text,
      conversationTopics: input.conversationTopics,
      interests: input.interests,
      now,
    });
    // Konservativ wie bei der Erinnerungs-Deduplizierung: bei Unsicherheit
    // entsteht lieber ein eigener Faden als eine falsche Zusammenführung.
    const sameTopic = thread.topic !== null && thread.topic === input.topic;
    const differentTopic =
      thread.topic !== null && input.topic !== null && thread.topic !== input.topic;
    if (differentTopic) continue;
    const textual = similarity(input.text, thread.known.join(" "));
    const matches =
      (sameTopic && relevance >= THREAD_MATCH_RELEVANCE) || textual >= THREAD_MATCH_SIMILARITY;
    if (!matches) continue;
    if (!best || relevance > best.relevance) best = { thread, relevance };
  }

  if (best) {
    const next = reactivateThread(best.thread, { now, known: input.text });
    const nodeIds =
      input.focusNodeId && !next.nodeIds.includes(input.focusNodeId)
        ? [...next.nodeIds, input.focusNodeId]
        : next.nodeIds;
    const updated = { ...next, nodeIds };
    await writeThread(db, userId, q, updated);
    result.reactivated = updated;
    return result;
  }

  // 2. Kein passender Faden – nur bei ausreichender Bedeutung einen neuen.
  if (input.importance < 0.35) return result;
  const draft = threadDraftFrom({
    content: input.text,
    topic: input.topic,
    importance: input.importance,
  });
  if (!draft) return result;

  const row = {
    user_id: userId,
    title: draft.title,
    topic: draft.topic,
    status: "OPEN" as const,
    known: draft.known,
    unknown: draft.unknown,
    curiosity: draft.curiosity,
    importance: draft.importance,
    activation_count: 1,
    node_ids: input.focusNodeId ? [input.focusNodeId] : [],
    last_activation_at: new Date(now).toISOString(),
  };
  const inserted = await q.tick(db.from("orb_threads").insert(row).select("*").single());
  // Gleicher Titel = bereits vorhandener Faden: dann berühren statt anlegen.
  if (inserted.error?.code === "23505") {
    const existing = await q.tick(
      db
        .from("orb_threads")
        .select("*")
        .eq("user_id", userId)
        .ilike("title", draft.title)
        .limit(1)
        .maybeSingle(),
    );
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) {
      const updated = reactivateThread(projectThread(mapThread(existing.data), now), {
        now,
        known: input.text,
      });
      await writeThread(db, userId, q, updated);
      result.reactivated = updated;
    }
    return result;
  }
  if (inserted.error) throw new Error(inserted.error.message);
  result.created = mapThread(inserted.data);
  return result;
}

/** Offene Fäden, die lange nicht berührt wurden, pausieren (kein Löschen). */
export async function pauseStaleThreads(
  db: DB,
  userId: string,
  q: Ticker,
  loaded: LoadedThread[],
  now: number,
): Promise<string[]> {
  const paused: string[] = [];
  for (const entry of loaded) {
    const thread = entry.thread;
    if (thread.status === "RESOLVED" || thread.status === "PAUSED") continue;
    if (threadStatusAfter(thread, now) !== "PAUSED") continue;
    await writeThread(db, userId, q, pauseThread(thread, now));
    paused.push(thread.title);
  }
  return paused;
}

/**
 * Antwort auf eine eigene Frage: der passende Faden wird als geklärt markiert.
 * Bekanntes bleibt erhalten, damit der Verlauf nachvollziehbar bleibt.
 */
export async function resolveThreadForAnswer(
  db: DB,
  userId: string,
  q: Ticker,
  input: {
    loaded: LoadedThread[];
    topic: string | null;
    nodeId: string | null;
    answer: string;
    now: number;
  },
): Promise<ThoughtThread | null> {
  const match =
    input.loaded.find(
      (e) =>
        e.thread.status !== "RESOLVED" &&
        ((input.topic !== null && e.thread.topic === input.topic) ||
          (input.nodeId !== null && e.thread.nodeIds.includes(input.nodeId))),
    ) ?? null;
  if (!match) return null;
  const resolved = resolveThread(projectThread(match.thread, input.now), {
    now: input.now,
    answer: input.answer,
  });
  await writeThread(db, userId, q, resolved);
  return resolved;
}

/** Wiederaufnahme eines Fadens protokollieren (Cooldown-Grundlage). */
export async function noteThreadResume(
  db: DB,
  userId: string,
  q: Ticker,
  thread: ThoughtThread,
  now: number,
): Promise<void> {
  await writeThread(db, userId, q, { ...thread, lastActivationAt: now }, { lastResumeAt: now });
}

/* ------------------------------------------------------------ Stilprofil */

export async function loadStyle(
  db: DB,
  userId: string,
  q: Ticker,
): Promise<{ profile: StyleProfile; exists: boolean }> {
  const res = await q.tick(db.from("orb_style").select("*").eq("user_id", userId).maybeSingle());
  if (res.error) throw new Error(res.error.message);
  if (!res.data) return { profile: EMPTY_STYLE, exists: false };
  return {
    exists: true,
    profile: {
      messages: res.data.messages,
      totalLength: res.data.total_length,
      emojiMessages: res.data.emoji_messages,
      questionMessages: res.data.question_messages,
      casualMessages: res.data.casual_messages,
      formalMessages: res.data.formal_messages,
      technicalMessages: res.data.technical_messages,
    },
  };
}

/** Eine Nachricht in das Stilprofil aufnehmen (nur Zählwerte, keine Inhalte). */
export async function recordStyle(
  db: DB,
  userId: string,
  q: Ticker,
  current: { profile: StyleProfile; exists: boolean },
  text: string,
): Promise<StyleProfile> {
  const next = observeStyle(current.profile, text);
  const row = {
    user_id: userId,
    messages: next.messages,
    total_length: next.totalLength,
    emoji_messages: next.emojiMessages,
    question_messages: next.questionMessages,
    casual_messages: next.casualMessages,
    formal_messages: next.formalMessages,
    technical_messages: next.technicalMessages,
  };
  const res = await q.tick(
    current.exists
      ? db.from("orb_style").update(row).eq("user_id", userId)
      : db.from("orb_style").insert(row),
  );
  if (res.error) throw new Error(res.error.message);
  return next;
}

/* --------------------------------------------------------- Widersprüche */

/**
 * Möglichen Widerspruch als offene Beziehung festhalten. Es wird nichts
 * überschrieben und nichts gelöscht – nur eine Verbindung mit Herkunft
 * `potential_contradiction` angelegt oder verstärkt.
 */
export async function persistContradictions(
  db: DB,
  userId: string,
  input: {
    contradictions: Contradiction[];
    focusNodeId: string | null;
    touch: (sourceId: string, targetId: string, origin: string) => Promise<unknown>;
    loaded: LoadedThread[];
    q: Ticker;
    now: number;
  },
): Promise<number> {
  if (!input.focusNodeId || input.contradictions.length === 0) return 0;
  let count = 0;
  for (const c of input.contradictions.slice(0, 2)) {
    await input.touch(c.nodeId, input.focusNodeId, "potential_contradiction");
    count += 1;
    // Der Widerspruch wird als offener Punkt an den passenden Faden gehängt.
    const match = input.loaded.find(
      (e) => e.thread.status !== "RESOLVED" && e.thread.nodeIds.includes(c.nodeId),
    );
    if (match && !match.thread.unknown.includes(c.gap)) {
      await writeThread(db, userId, input.q, {
        ...projectThread(match.thread, input.now),
        unknown: [...match.thread.unknown, c.gap],
        lastActivationAt: input.now,
      });
    }
  }
  return count;
}
