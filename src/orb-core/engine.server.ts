/**
 * ORB Core V0.2 – serverseitige Logik des Prototyps (experimenteller Bereich).
 *
 * Ablauf einer Eingabe:
 *   Eingabe → relevanter Teilgraph (Ebene A→B→C) → Zustand → Entscheidung →
 *   KI-Sprache (Deutsch) → Erfahrung bewerten → Knoten/Verbindungen
 *   aktualisieren (ohne Duplikate) → Interessen → Zustand → Messwerte.
 *
 * Das Sprachmodell ist nur Sprach- und Denkschicht. Identität, Zustand,
 * Gedächtnis und Interessen liegen in der Datenbank.
 *
 * Grundsatz: VERGESSEN ≠ LÖSCHEN. Kein Vorgang hier entfernt eine Erinnerung
 * durch Verfall oder durch negatives Feedback.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { OrbImageAttachment } from "@/lib/orb-attachments";

import {
  currentWeight,
  decide,
  isLearningEvent,
  isStrong,
  nextState,
  conversationDecision,
  reactivate,
  recoverEnergy,
  reinforcement,
  scoreImportance,
  shouldPersist,
  type OrbDecision,
  type OrbNodeType,
  type OrbState,
} from "@/orb-core/core";
import {
  applyFeedbackToWeight,
  confidenceFor,
  contentTokens,
  feedbackDelta,
  memoryLevel,
  memoryRelevance,
  nextInterest,
  normKey,
  selectByLevel,
  similarity,
  topicOf,
  topicsOf,
  type InterestRow,
  type MemoryLevel,
  type OrbInfoSource,
} from "@/orb-core/memory";
import {
  CONTEXT_WINDOW_MESSAGES,
  contextWindow,
  detectExplicitLearningRequest,
  formatConversationContext,
  resolveFromContext,
  type ConversationMessage,
} from "@/orb-core/context";
import { questionIntentOf, topicAffinity } from "@/orb-core/recall";
import { correctedTerm, isStorableStatement, selectReliableMemories } from "@/orb-core/eligibility";
import { PROACTIVE_SCOPE, stripFakePauseClaim, type ProactiveMemory } from "@/orb-core/presence";
import { decideConversationMode, type ConversationMode } from "@/orb-core/conversation";

import {
  CURIOSITY_SCOPE,
  decideCuriosity,
  deriveKnowledgeGaps,
  GAP_HINT,
  isAskMeRequest,
  isDuplicateQuestion,
  KNOWLEDGE_GAP_KINDS,
  type AskedQuestion,
  type CuriosityAction,
  type KnowledgeGap,
  type KnowledgeGapKind,
} from "@/orb-core/curiosity";
import { finalAutonomyGate, type OrbAutonomyAttempt } from "@/orb-core/autonomy";
import { detectGaps, type DetectedGap, type GapNode, type TemporalScope } from "@/orb-core/gaps";
import { IMPULSE_SCOPE, decideImpulse, type ImpulseCandidate } from "@/orb-core/impulse";
import {
  GUARDRAIL_SCOPE,
  decideGuardrail,
  detectIntent,
  detectProcessChange,
  parseProcessDecision,
} from "@/orb-core/process";
import { applyProcessDecision, loadProcessContext } from "@/orb-core/process.server";
import {
  CONTINUITY_SCOPE,
  continuityStateShift,
  decideHandling,
  detectContradictions,
  phrasingFor,
  shouldResumeThread,
  styleHint,
  styleTraits,
  threadKnowledgeGaps,
  threadRelevance,
  type Contradiction,
  type Handling,
  type MemoryCertainty,
  type StyleProfile,
  type StyleTraits,
  type ThoughtThread,
} from "@/orb-core/continuity";
import {
  loadStyle,
  loadThreads,
  mapThread,
  noteThreadResume,
  pauseStaleThreads,
  persistContradictions,
  projectThread,
  recordStyle,
  resolveThreadForAnswer,
  syncThreads,
} from "@/orb-core/continuity-store.server";
import { buildSpeakSystemPrompt } from "@/orb-core/llm/prompt.server";
import { generateReply } from "@/orb-core/llm/select.server";
import type { OrbLlmMeta } from "@/orb-core/llm/provider.server";

export type DB = SupabaseClient<Database>;

/** Obergrenze der Eingabe (Kostenschutz). */
export const MAX_INPUT_CHARS = 1000;
/** Wie viele Erinnerungen höchstens in den KI-Kontext gelangen. */
const RECALL_LIMIT = 6;
/** Obergrenze je gezielter Kandidatenabfrage (kein vollständiger Graph). */
const CANDIDATE_LIMIT = 20;
/** Obergrenze für den angezeigten Teilgraphen. */
const GRAPH_LIMIT = 40;

export type OrbNode = {
  id: string;
  type: OrbNodeType;
  content: string;
  importance: number;
  confidence: number;
  source: OrbInfoSource;
  topic: string | null;
  activationCount: number;
  lastAccessedAt: string;
  createdAt: string;
};

export type OrbConnection = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  /** Gespeicherter Ausgangswert W₀. */
  storedWeight: number;
  /** Aktuell berechnetes Gewicht W(t) – inkl. Verfall. */
  weight: number;
  strong: boolean;
  importance: number;
  decayRate: number;
  activationCount: number;
  lastActivatedAt: string;
};

export type OrbInterest = InterestRow & { id: string; lastActivatedAt: string };

export type OrbSuggestion = {
  id: string;
  postId: string;
  topic: string | null;
  reason: string;
  relevance: number;
  status: "pending" | "shown" | "accepted" | "rejected";
  title: string | null;
};

export type OrbPerf = {
  retrievalMs: number;
  relevanceMs: number;
  aiMs: number;
  totalMs: number;
  nodesLoaded: number;
  connectionsLoaded: number;
  dbQueries: number;
};

/** Ansicht eines Gedankenfadens für Oberfläche und Testbereich. */
export type OrbThreadView = {
  id: string;
  title: string;
  topic: string | null;
  status: string;
  known: string[];
  unknown: string[];
  curiosity: number;
  importance: number;
  activationCount: number;
  lastActivationAt: string;
  resolvedAt: string | null;
  /** Relevanz im aktuellen Zusammenhang (berechnet, nicht gespeichert). */
  relevance: number;
};

function toThreadView(thread: ThoughtThread, now: number, relevance: number): OrbThreadView {
  return {
    id: thread.id,
    title: thread.title,
    topic: thread.topic,
    status: thread.status,
    known: thread.known,
    unknown: thread.unknown,
    curiosity: thread.curiosity,
    importance: thread.importance,
    activationCount: thread.activationCount,
    lastActivationAt: new Date(thread.lastActivationAt).toISOString(),
    resolvedAt: thread.resolvedAt === null ? null : new Date(thread.resolvedAt).toISOString(),
    relevance,
  };
}

export type OrbSnapshot = {
  state: OrbState;
  goals: string[];
  cracks: number;
  nodes: OrbNode[];
  connections: OrbConnection[];
  interests: OrbInterest[];
  suggestions: OrbSuggestion[];
  /** Offene Gedankenfäden (Kontinuität) – mit Verfall, ohne Löschung. */
  threads: OrbThreadView[];
  /** Beobachteter Gesprächsstil (erst bei wiederkehrendem Muster wirksam). */
  style: StyleTraits;
  messages: { id: string; role: "user" | "orb"; body: string; decision: string | null }[];
  metrics: {
    nodeCount: number;
    connectionCount: number;
    reactivationCount: number;
    decayComputations: number;
    strongConnections: number;
    weakConnections: number;
    suggestionsAccepted: number;
    suggestionsRejected: number;
  };
  perf: OrbPerf | null;
};

type StateRow = Database["public"]["Tables"]["orb_state"]["Row"];
type NodeRow = Database["public"]["Tables"]["orb_nodes"]["Row"];
type ConnRow = Database["public"]["Tables"]["orb_connections"]["Row"];

/** Zähler der Datenbankabfragen einer Interaktion (Messwert, keine Vermutung). */
export class QueryCounter {
  count = 0;
  /** Supabase-Builder sind PromiseLike – deshalb kein `Promise<T>`. */
  tick<T>(p: PromiseLike<T>): Promise<T> {
    this.count += 1;
    return Promise.resolve(p);
  }
}

function toState(row: StateRow): OrbState {
  return {
    curiosity: row.curiosity,
    joy: row.joy,
    fear: row.fear,
    trust: row.trust,
    uncertainty: row.uncertainty,
    // Zeitbasierte Erholung beim Lesen – der gespeicherte Wert wird dadurch
    // nicht verändert, und das Ergebnis ist unabhängig von der Aufrufzahl.
    energy: recoverEnergy(row.energy, new Date(row.updated_at).getTime(), Date.now()),
  };
}

/** Zustandszeile lesen oder beim ersten Besuch anlegen. */
async function ensureState(db: DB, userId: string, q?: QueryCounter): Promise<StateRow> {
  const read = db.from("orb_state").select("*").eq("user_id", userId).maybeSingle();
  const existing = await (q ? q.tick(read) : read);
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data;

  const create = db.from("orb_state").insert({ user_id: userId }).select("*").single();
  const created = await (q ? q.tick(create) : create);
  if (created.error) throw new Error(created.error.message);
  return created.data;
}

function mapNodes(rows: NodeRow[]): OrbNode[] {
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    content: n.content,
    importance: n.importance,
    confidence: n.confidence,
    source: n.source,
    topic: n.topic,
    activationCount: n.activation_count,
    lastAccessedAt: n.last_accessed_at,
    createdAt: n.created_at,
  }));
}

function mapConnections(rows: ConnRow[], now: number): OrbConnection[] {
  return rows.map((c) => {
    const weight = currentWeight({
      weight: c.weight,
      importance: c.importance,
      decayRate: c.decay_rate,
      lastActivatedAt: new Date(c.last_activated_at).getTime(),
      now,
    });
    return {
      id: c.id,
      sourceNodeId: c.source_node_id,
      targetNodeId: c.target_node_id,
      storedWeight: c.weight,
      weight,
      strong: isStrong(weight),
      importance: c.importance,
      decayRate: c.decay_rate,
      activationCount: c.activation_count,
      lastActivatedAt: c.last_activated_at,
    };
  });
}

function mapInterests(rows: Database["public"]["Tables"]["orb_interests"]["Row"][]): OrbInterest[] {
  return rows.map((i) => ({
    id: i.id,
    topic: i.topic,
    weight: i.weight,
    confidence: i.confidence,
    source: i.source,
    activationCount: i.activation_count,
    lastActivatedAt: i.last_activated_at,
  }));
}

/**
 * Momentaufnahme für Oberfläche, Graph und Testbereich.
 * Es wird nur ein begrenzter Teilgraph geladen – nie der ganze Graph.
 */
export async function getSnapshot(
  db: DB,
  userId: string,
  perf: OrbPerf | null = null,
): Promise<OrbSnapshot> {
  const stateRow = await ensureState(db, userId);
  const now = Date.now();

  const [nodesRes, connRes, msgRes, interestRes, suggRes, countRes, threadRes, styleRes] =
    await Promise.all([
      db
        .from("orb_nodes")
        .select("*")
        .eq("user_id", userId)
        .order("importance", { ascending: false })
        .order("last_accessed_at", { ascending: false })
        .limit(GRAPH_LIMIT),
      db
        .from("orb_connections")
        .select("*")
        .eq("user_id", userId)
        .order("weight", { ascending: false })
        .order("last_activated_at", { ascending: false })
        .limit(GRAPH_LIMIT),
      db
        .from("orb_messages")
        .select("id, role, body, decision")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(40),
      db
        .from("orb_interests")
        .select("*")
        .eq("user_id", userId)
        .order("weight", { ascending: false })
        .limit(20),
      db
        .from("orb_suggestions")
        .select("id, post_id, topic, reason, relevance, status, posts(title)")
        .eq("user_id", userId)
        .order("relevance", { ascending: false })
        .limit(20),
      db
        .from("orb_suggestions")
        .select("status")
        .eq("user_id", userId)
        .in("status", ["accepted", "rejected"])
        .limit(500),
      // Kontinuität: nur die letzten Fäden und die Zählwerte des Stils.
      db
        .from("orb_threads")
        .select("*")
        .eq("user_id", userId)
        .order("last_activation_at", { ascending: false })
        .limit(12),
      db.from("orb_style").select("*").eq("user_id", userId).maybeSingle(),
    ]);
  if (nodesRes.error) throw new Error(nodesRes.error.message);
  if (threadRes.error) throw new Error(threadRes.error.message);
  if (styleRes.error) throw new Error(styleRes.error.message);
  if (connRes.error) throw new Error(connRes.error.message);
  if (msgRes.error) throw new Error(msgRes.error.message);
  if (interestRes.error) throw new Error(interestRes.error.message);
  if (suggRes.error) throw new Error(suggRes.error.message);
  if (countRes.error) throw new Error(countRes.error.message);

  const connections = mapConnections(connRes.data, now);

  // Jede Momentaufnahme berechnet den Verfall neu – als Kennzahl gezählt,
  // ohne dabei irgendetwas zu entfernen.
  if (connections.length > 0) {
    // Der Zeitstempel der Zeile wird beim Schreiben neu gesetzt. Damit die
    // bereits verstrichene Ruhezeit nicht verfällt, wird der zum Lesezeitpunkt
    // erholte Energiewert mitgeschrieben. Rate und Obergrenze bleiben gleich.
    await db
      .from("orb_state")
      .update({
        decay_computations: stateRow.decay_computations + connections.length,
        energy: toState(stateRow).energy,
      })
      .eq("user_id", userId);
  }

  const suggestions: OrbSuggestion[] = suggRes.data.map((s) => {
    const post = s.posts as { title: string | null } | null;
    return {
      id: s.id,
      postId: s.post_id,
      topic: s.topic,
      reason: s.reason,
      relevance: s.relevance,
      status: s.status,
      title: post?.title ?? null,
    };
  });

  const interests = mapInterests(interestRes.data);
  const conversationTopics = msgRes.data.flatMap((m) => topicsOf(m.body));
  const threads = threadRes.data
    .map((row) => projectThread(mapThread(row), now))
    .map((thread) =>
      toThreadView(thread, now, threadRelevance(thread, { conversationTopics, interests, now })),
    );
  const styleProfile: StyleProfile = styleRes.data
    ? {
        messages: styleRes.data.messages,
        totalLength: styleRes.data.total_length,
        emojiMessages: styleRes.data.emoji_messages,
        questionMessages: styleRes.data.question_messages,
        casualMessages: styleRes.data.casual_messages,
        formalMessages: styleRes.data.formal_messages,
        technicalMessages: styleRes.data.technical_messages,
      }
    : {
        messages: 0,
        totalLength: 0,
        emojiMessages: 0,
        questionMessages: 0,
        casualMessages: 0,
        formalMessages: 0,
        technicalMessages: 0,
      };

  return {
    state: toState(stateRow),
    goals: Array.isArray(stateRow.goals) ? (stateRow.goals as string[]) : ["help_user"],
    cracks: stateRow.cracks,
    nodes: mapNodes(nodesRes.data),
    connections,
    interests,
    suggestions,
    threads,
    style: styleTraits(styleProfile),
    messages: msgRes.data
      .slice()
      .reverse()
      .map((m) => ({
        id: m.id,
        role: m.role === "orb" ? ("orb" as const) : ("user" as const),
        body: m.body,
        decision: m.decision,
      })),
    metrics: {
      nodeCount: nodesRes.data.length,
      connectionCount: connections.length,
      reactivationCount: stateRow.reactivation_count,
      decayComputations: stateRow.decay_computations + connections.length,
      strongConnections: connections.filter((c) => c.strong).length,
      weakConnections: connections.filter((c) => !c.strong).length,
      suggestionsAccepted: countRes.data.filter((s) => s.status === "accepted").length,
      suggestionsRejected: countRes.data.filter((s) => s.status === "rejected").length,
    },
    perf,
  };
}

export type OrbTurn = {
  reply: string;
  decision: OrbDecision;
  decisionReason: string;
  /** Wichtigkeit der Erfahrung (0..1). */
  importance: number;
  learningEvent: boolean;
  /** Es wurde eine bestehende Erinnerung reaktiviert (Gesichtsreaktion). */
  reactivated: boolean;
  /** Es wurde eine neue Erinnerung gebildet (Gesichtsreaktion). */
  learnedNew: boolean;
  topic: string | null;
  recalled: { id: string; content: string; weight: number; level: MemoryLevel }[];
  /** Gesetzt, wenn die Antwort eine eigene Frage des ORB geschlossen hat. */
  answeredQuestion: { question: string; topic: string | null } | null;
  /** Gesetzt, wenn der ORB in dieser Runde selbst eine Frage gestellt hat. */
  selfQuestion: { question: string; topic: string; kind: KnowledgeGapKind; score: number } | null;
  /** Flüchtiger Gesprächskontext dieser Runde – nie automatisch gespeichert. */
  context: {
    /** Anzahl berücksichtigter Nachrichten (hart begrenzt). */
    messages: number;
    limit: number;
    /** Bei ausdrücklicher Merk-Aufforderung aufgelöste Aussage. */
    resolvedFact: string | null;
    resolveReason: string | null;
  };
  /** Kontinuität dieser Runde – nachvollziehbar, ohne Löschung. */
  continuity: {
    handling: Handling;
    handlingReason: string;
    newThread: string | null;
    reactivatedThread: string | null;
    pausedThreads: number;
    resolvedThread: string | null;
    resumedThread: string | null;
    resumeReason: string;
    contradictions: string[];
    contradictionsStored: number;
    style: StyleTraits;
    styleHint: string | null;
    certainty: { content: string; certainty: MemoryCertainty }[];
    stateShift: { curiosity: number; uncertainty: number; trust: number; reason: string };
    scope: string;
    /** Interne Begründung, falls keine eigene Frage entstand – nur Diagnose. */
    internalNote: string | null;
  };

  /** Gesprächsentscheidung des Core vor der Sprachschicht. */
  conversation: {
    mode: ConversationMode;
    reason: string;
    /** Nur die Stränge, die diesen Moment tatsächlich betreffen. */
    relevantStrands: string[];
    focusTopic: string | null;
  };

  snapshot: OrbSnapshot;
  /** Gesetzt, wenn die KI nicht erreichbar war – Gedächtnis arbeitet weiter. */
  aiStatus: "ok" | "quota" | "unavailable";
  /** Diagnose: welche Sprachschicht hat formuliert (OpenAI-Experiment/Fallback). */
  llm: OrbLlmMeta;

  perf: OrbPerf;
};

/**
 * Sprachschicht: erzeugt die deutsche Formulierung aus Zustand, Erinnerungen,
 * Entscheidung. Der System-Prompt entsteht in `@/orb-core/llm/prompt.server`,
 * die Provider-Auswahl (OpenAI-Experiment mit Fallback auf die bestehende
 * Sprachschicht) in `@/orb-core/llm/select.server`. Gedächtnis, Lernen und
 * Entscheidungen bleiben vollständig in diesem Modul – das Sprachmodell ist
 * und bleibt nur Sprach- und Denkschicht.
 */
async function speak(input: {
  text: string;
  state: OrbState;
  goals: string[];
  decision: OrbDecision;
  recalled: string[];
  interests: OrbInterest[];
  /** Sprachliche Sicherheit je Erinnerung – aus echten Gedächtniswerten. */
  phrasings?: { content: string; certainty: MemoryCertainty; hint: string }[];
  /** Stilhinweis – nur bei wiederkehrendem Muster gesetzt. */
  style?: string | null;
  /** Offene Gedankenfäden, die ORB tatsächlich beschäftigen. */
  openThreads?: { title: string; status: string; unknown: string[] }[];
  /** Mögliche Widersprüche – nie auflösen, nur benennen. */
  contradictions?: Contradiction[];
  /** Kurzer, begrenzter Verlauf des laufenden Gesprächs (flüchtig). */
  context?: string | null;
  /** Bildanhänge dieser Anfrage – flüchtiger Kontext, nie Gedächtnis. */
  images?: OrbImageAttachment[];
  /** Gesprächsmodus des Core – bestimmt die Art des Beitrags. */
  mode?: ConversationMode;
  modeReason?: string | null;
}): Promise<{ reply: string; status: "ok" | "quota" | "unavailable"; meta: OrbLlmMeta }> {
  const system = buildSpeakSystemPrompt(input);
  return generateReply({ system, text: input.text, images: input.images });
}

/**
 * Ehrlicher Hinweis: enthielt die Anfrage Bilder, wurden sie aber nicht von der
 * multimodalen Sprachschicht ausgewertet, darf keine Bildanalyse behauptet
 * werden. Der Hinweis wird nur angehängt, nie erfunden.
 */
const IMAGE_NOT_PROCESSED_HINT =
  "Den Bildinhalt konnte ich gerade nicht auswerten – meine Bildschicht ist momentan nicht verfügbar.";

const FALLBACK: Record<"quota" | "unavailable", string> = {
  quota:
    "Meine Sprachschicht ist gerade nicht verfügbar (Guthaben). Ich habe die Erfahrung trotzdem gespeichert.",
  unavailable:
    "Meine Sprachschicht antwortet gerade nicht. Deine Erfahrung ist in meinem Gedächtnis gespeichert.",
};

/* ------------------------------------------------------------------- Abruf */

type Candidate = { node: OrbNode; level: MemoryLevel; score: number; overlap: number };

/**
 * Gezielter Abruf: mehrere begrenzte Abfragen (Schlüssel, Thema, Aktualität,
 * Textsuche) statt einer vollständigen Graphabfrage. Danach Relevanzranking
 * und Auswahl über die Ebenen A → B → C.
 */
async function retrieveCandidates(
  db: DB,
  userId: string,
  text: string,
  q: QueryCounter,
): Promise<{ nodes: OrbNode[]; exact: NodeRow | null }> {
  const key = normKey(text);
  const topic = topicOf(text);
  // Zusätzlicher Kandidatenkreis: der Informationsbereich der Frage. Reine
  // Kandidatensuche – Rangfolge und Auswahl bleiben unverändert.
  const intentTopic = questionIntentOf(text);
  const tokens = contentTokens(text).slice(0, 3);

  const queries: PromiseLike<{ data: NodeRow[] | null; error: { message: string } | null }>[] = [];

  if (key) {
    queries.push(
      q.tick(db.from("orb_nodes").select("*").eq("user_id", userId).eq("norm_key", key).limit(1)),
    );
  }
  if (topic) {
    queries.push(
      q.tick(
        db
          .from("orb_nodes")
          .select("*")
          .eq("user_id", userId)
          .eq("topic", topic)
          .order("importance", { ascending: false })
          .limit(CANDIDATE_LIMIT),
      ),
    );
  }
  if (intentTopic && intentTopic !== topic) {
    // Themenbasierter Kandidat: gleiche Nutzerkennung, nur ein weiterer,
    // begrenzter Kandidatenkreis – keine vollständige Graphabfrage.
    queries.push(
      q.tick(
        db
          .from("orb_nodes")
          .select("*")
          .eq("user_id", userId)
          .eq("topic", intentTopic)
          .order("importance", { ascending: false })
          .limit(CANDIDATE_LIMIT),
      ),
    );
  }
  // Ebene A: aktueller Kontext.
  queries.push(
    q.tick(
      db
        .from("orb_nodes")
        .select("*")
        .eq("user_id", userId)
        .order("last_accessed_at", { ascending: false })
        .limit(CANDIDATE_LIMIT / 2),
    ),
  );
  if (tokens.length > 0) {
    const filter = tokens.map((t) => `content.ilike.%${t}%`).join(",");
    queries.push(
      q.tick(
        db
          .from("orb_nodes")
          .select("*")
          .eq("user_id", userId)
          .or(filter)
          .order("importance", { ascending: false })
          .limit(CANDIDATE_LIMIT),
      ),
    );
  }

  const results = await Promise.all(queries);
  const byId = new Map<string, NodeRow>();
  for (const r of results) {
    if (r.error) throw new Error(r.error.message);
    for (const row of r.data ?? []) byId.set(row.id, row);
  }
  const exact = key ? ([...byId.values()].find((n) => n.norm_key === key) ?? null) : null;
  return { nodes: mapNodes([...byId.values()]), exact };
}

/* -------------------------------------------------------------- Verarbeitung */

async function upsertInterest(
  db: DB,
  userId: string,
  topic: string,
  source: OrbInfoSource,
  importance: number,
  q: QueryCounter,
  delta?: number,
): Promise<void> {
  const existing = await q.tick(
    db.from("orb_interests").select("*").eq("user_id", userId).eq("topic", topic).maybeSingle(),
  );
  if (existing.error) throw new Error(existing.error.message);
  const prev = existing.data
    ? {
        topic: existing.data.topic,
        weight: existing.data.weight,
        confidence: existing.data.confidence,
        source: existing.data.source,
        activationCount: existing.data.activation_count,
      }
    : null;
  const next = nextInterest(prev, {
    topic,
    source,
    importance,
    ...(delta === undefined ? {} : { delta }),
  });
  const row = {
    user_id: userId,
    topic: next.topic,
    weight: next.weight,
    confidence: next.confidence,
    source: next.source,
    activation_count: next.activationCount,
    last_activated_at: new Date().toISOString(),
  };
  const write = existing.data
    ? db.from("orb_interests").update(row).eq("id", existing.data.id)
    : db.from("orb_interests").insert(row);
  const res = await q.tick(write);
  if (res.error) throw new Error(res.error.message);
}

/** Verbindung anlegen oder – falls vorhanden – reaktivieren (keine Duplikate). */
export async function touchConnection(
  db: DB,
  userId: string,
  sourceId: string,
  targetId: string,
  input: { delta: number; importance: number; decayRate: number; origin: string },
  q: QueryCounter,
  now: number,
): Promise<"created" | "reactivated"> {
  if (sourceId === targetId) return "reactivated";
  const existing = await q.tick(
    db
      .from("orb_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("source_node_id", sourceId)
      .eq("target_node_id", targetId)
      .maybeSingle(),
  );
  if (existing.error) throw new Error(existing.error.message);

  if (existing.data) {
    const c = existing.data;
    const res = await q.tick(
      db
        .from("orb_connections")
        .update({
          weight: reactivate(
            {
              weight: c.weight,
              importance: c.importance,
              decayRate: c.decay_rate,
              lastActivatedAt: new Date(c.last_activated_at).getTime(),
              now,
            },
            input.delta,
          ),
          last_activated_at: new Date(now).toISOString(),
          activation_count: c.activation_count + 1,
          importance: Math.max(c.importance, input.importance),
          // Eine erkannte Spannung bleibt sichtbar, ohne den ursprünglichen
          // Entstehungsgrund zu überschreiben.
          metadata:
            input.origin === "potential_contradiction"
              ? {
                  ...(typeof c.metadata === "object" &&
                  c.metadata !== null &&
                  !Array.isArray(c.metadata)
                    ? c.metadata
                    : {}),
                  potential_contradiction: true,
                  contradiction_seen_at: new Date(now).toISOString(),
                }
              : c.metadata,
        })
        .eq("id", c.id)
        .eq("user_id", userId),
    );
    if (res.error) throw new Error(res.error.message);
    return "reactivated";
  }

  const res = await q.tick(
    db.from("orb_connections").insert({
      user_id: userId,
      source_node_id: sourceId,
      target_node_id: targetId,
      weight: Math.min(1, 0.35 + input.delta),
      importance: input.importance,
      decay_rate: input.decayRate,
      activation_count: 1,
      last_activated_at: new Date(now).toISOString(),
      metadata: { origin: input.origin },
    }),
  );
  if (res.error) throw new Error(res.error.message);
  return "created";
}

/**
 * Eine Erfahrung verarbeiten. Reaktiviert passende Erinnerungen, vermeidet
 * doppelte Knoten und Verbindungen, pflegt das Interessenmodell und
 * aktualisiert den Zustand.
 */
export async function processInput(
  db: DB,
  userId: string,
  rawText: string,
  options: { source?: OrbInfoSource; images?: OrbImageAttachment[] } = {},
): Promise<OrbTurn> {
  // Bilder sind ausschliesslich flüchtiger Anfragekontext der Sprachschicht.
  // Sie berühren Abruf, Wichtigkeit, Relevanz, Verfall, Verbindungen und
  // Lernereignisse nicht – die bestehende Gedächtnispipeline bleibt unberührt.
  const images = options.images ?? [];
  const startedAt = Date.now();
  const q = new QueryCounter();
  const source: OrbInfoSource = options.source ?? "user_stated";

  const text = rawText.trim().slice(0, MAX_INPUT_CHARS);
  if (!text) throw new Error("empty input");

  const stateRow = await ensureState(db, userId, q);
  const state = toState(stateRow);
  const goals = Array.isArray(stateRow.goals) ? (stateRow.goals as string[]) : ["help_user"];
  const now = Date.now();

  // --- Abruf (Messwert: Zeit, Anzahl geladener Knoten/Verbindungen) --------
  const retrievalStart = Date.now();
  const { nodes: candidateNodes, exact } = await retrieveCandidates(db, userId, text, q);

  let connections: OrbConnection[] = [];
  if (candidateNodes.length > 0) {
    const ids = candidateNodes.map((n) => n.id);
    const connRes = await q.tick(
      db
        .from("orb_connections")
        .select("*")
        .eq("user_id", userId)
        .or(`source_node_id.in.(${ids.join(",")}),target_node_id.in.(${ids.join(",")})`)
        .order("weight", { ascending: false })
        .limit(CANDIDATE_LIMIT * 3),
    );
    if (connRes.error) throw new Error(connRes.error.message);
    connections = mapConnections(connRes.data, now);
  }
  const retrievalMs = Date.now() - retrievalStart;

  // --- Relevanz (Ebenen A → B → C, Top-N) ---------------------------------
  const relevanceStart = Date.now();
  const bestWeight = new Map<string, number>();
  for (const c of connections) {
    for (const id of [c.sourceNodeId, c.targetNodeId]) {
      bestWeight.set(id, Math.max(bestWeight.get(id) ?? 0, c.weight));
    }
  }
  const scored: Candidate[] = candidateNodes
    .map((n) => {
      // Wortüberschneidung bleibt das Hauptmass. Zusätzlich gilt eine
      // Untergrenze, wenn Frage und Erinnerung denselben eindeutig erkannten
      // Informationsbereich haben („Welche Grafikkarte habe ich?“ ↔ „RTX 5070“).
      // Die Relevanzformel selbst bleibt unverändert.
      const overlap = Math.max(similarity(text, n.content), topicAffinity(text, n.content));
      const lastAccessed = new Date(n.lastAccessedAt).getTime();
      return {
        node: n,
        overlap,
        level: memoryLevel(
          {
            importance: n.importance,
            activationCount: n.activationCount,
            lastAccessedAt: lastAccessed,
          },
          now,
        ),
        score: memoryRelevance({
          similarity: overlap,
          weight: bestWeight.get(n.id) ?? 0.5,
          importance: n.importance,
          lastAccessedAt: lastAccessed,
          activationCount: n.activationCount,
          now,
        }),
      };
    })
    .filter((c) => c.overlap > 0);
  const recalled = selectByLevel(scored, RECALL_LIMIT);
  const relevanceMs = Date.now() - relevanceStart;

  const learning = isLearningEvent(text);
  const importance = scoreImportance(text, { isLearningEvent: learning });
  const isQuestion = text.includes("?");
  const topic = topicOf(text);
  const { decision, reason } = decide({
    state,
    recalled: recalled.length,
    isQuestion,
    isLearning: learning,
  });

  // --- Flüchtiger Gesprächskontext (hart begrenzt, keine neue Speicherung) --
  // Genutzt wird die bereits vorhandene Gesprächsablage `orb_messages`; es
  // entsteht keine zweite Verlaufshaltung. Eine Abfrage, festes Fenster.
  const ctxRes = await q.tick(
    db
      .from("orb_messages")
      .select("role, body")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(CONTEXT_WINDOW_MESSAGES),
  );
  if (ctxRes.error) throw new Error(ctxRes.error.message);
  const recentMessages: ConversationMessage[] = contextWindow(
    [...ctxRes.data]
      .reverse()
      .map((m) => ({ role: m.role === "orb" ? "orb" : "user", body: m.body })),
  );
  const conversationContext = formatConversationContext(recentMessages);

  // Ausdrückliche Merk-Aufforderung gegen den Kontext auflösen. Gespeichert
  // wird weiterhin ausschliesslich über die bestehende Lern-/Speicherlogik.
  const learnRequest = detectExplicitLearningRequest(text);
  const resolvedContextFact = learnRequest
    ? resolveFromContext(learnRequest, recentMessages)
    : null;
  /** Inhalt für die bestehende Speicherlogik – nur bei belegter Auflösung ersetzt. */
  const memoryText = resolvedContextFact ? resolvedContextFact.fact : text;
  /**
   * Wichtigkeit der zu speichernden Angabe. Bei einer belegten Merk-Aufforderung
   * wird die aufgelöste Aussage bewertet (nicht der Auftragssatz). Formel und
   * Schwelle (0.35) bleiben unverändert.
   */
  const memoryImportance = resolvedContextFact
    ? scoreImportance(memoryText, { isLearningEvent: learning })
    : importance;
  /** Kontexttext für die Sprachschicht, inklusive Hinweis auf die Auflösung. */
  const speakContext = resolvedContextFact
    ? `${conversationContext ?? ""} || Deine ausdrückliche Merk-Aufforderung bezieht sich auf: „${resolvedContextFact.fact}“. Bestätige knapp, dass du dir diese Angabe merkst; sage nicht, dass es nur für dieses Gespräch gilt, und frage nicht erneut danach.`
    : conversationContext;

  const interestRes = await q.tick(
    db
      .from("orb_interests")
      .select("*")
      .eq("user_id", userId)
      .order("weight", { ascending: false })
      .limit(8),
  );
  if (interestRes.error) throw new Error(interestRes.error.message);
  const interests = mapInterests(interestRes.data);

  // --- Kontinuität: Fäden, Stil, mögliche Widersprüche --------------------
  // Gezielt begrenzt geladen (max. 12 Fäden, eine Stilzeile) – kein Polling.
  const [loadedThreads, styleState] = await Promise.all([
    loadThreads(db, userId, q),
    loadStyle(db, userId, q),
  ]);
  const conversationTopics = topicsOf(text);
  const openThreads = loadedThreads
    .map((e) => projectThread(e.thread, now))
    .filter((t) => t.status !== "RESOLVED" && t.unknown.length > 0)
    .map((t) => ({
      thread: t,
      relevance: threadRelevance(t, { text, conversationTopics, interests, now }),
    }))
    .sort((a, b) => b.relevance - a.relevance);

  // Ein alter Faden wird nur erwähnt, wenn er wirklich relevant ist.
  const resumeCandidate = openThreads[0] ?? null;
  const resumeEntry = resumeCandidate
    ? (loadedThreads.find((e) => e.thread.id === resumeCandidate.thread.id) ?? null)
    : null;
  const resumeVerdict = resumeCandidate
    ? shouldResumeThread({
        thread: resumeCandidate.thread,
        relevance: resumeCandidate.relevance,
        curiosity: state.curiosity,
        lastResumeAt: resumeEntry?.lastResumeAt ?? null,
        now,
      })
    : { resume: false, reason: "Kein offener Gedankenfaden.", relevance: 0 };

  // Mögliche Widersprüche nur gegen bereits geladene Erinnerungen – keine
  // zusätzliche Abfrage, keine Überschreibung bestehender Erinnerungen.
  const contradictions: Contradiction[] = detectContradictions(
    text,
    candidateNodes.map((n) => ({ id: n.id, content: n.content, topic: n.topic })),
  ).slice(0, 2);

  /**
   * Belastbarkeit vor dem Sprachkontext:
   *   Recall → gefundene Knoten → Belastbarkeit → aktive Erinnerungen → LLM.
   *
   * Gefunden ist nicht gleich bestätigt: reine Fragen, Aufforderungen, Fragmente
   * und ausdrücklich als Tippfehler benannte Inhalte gehen nicht als persönliche
   * Tatsache weiter. Die Knoten bleiben unverändert gespeichert (VERGESSEN ≠
   * LÖSCHEN); Abruf, Rangfolge, Wichtigkeit und Konfidenz sind unberührt.
   */
  const correctedTerms = [...recentMessages.map((m) => m.body), text]
    .map((body) => correctedTerm(body))
    .filter((term): term is string => term !== null);
  const reliableRecalled = selectReliableMemories(
    recalled.map((r) => ({ candidate: r, content: r.node.content })),
    correctedTerms,
  ).map((e) => e.candidate);
  const activeMemories = reliableRecalled.map((r) => r.node.content);

  const phrasings = reliableRecalled.map((r) =>
    ((p) => ({ content: r.node.content, certainty: p.certainty, hint: p.hint }))(
      phrasingFor({
        content: r.node.content,
        weight: bestWeight.get(r.node.id) ?? 0.5,
        confidence: r.node.confidence,
        activationCount: r.node.activationCount,
        lastAccessedAt: new Date(r.node.lastAccessedAt).getTime(),
        now,
      }),
    ),
  );

  /**
   * Gesprächsentscheidung: der Core bestimmt die ART des Beitrags, bevor die
   * Sprachschicht formuliert. Verwendet werden nur bereits berechnete Werte
   * (Recall-Rang, Konfidenz, Themen, Zustand, offener Faden). Es entstehen
   * keine neuen Gedächtnisformeln und keine zusätzliche Abfrage.
   */
  const conversationStrands = reliableRecalled.map((r) => ({
    content: r.node.content,
    topic: r.node.topic,
    relevance: r.score,
    confidence: r.node.confidence,
  }));
  const resumeThreadForMode =
    resumeVerdict.resume && resumeCandidate
      ? { title: resumeCandidate.thread.title, unknown: resumeCandidate.thread.unknown }
      : null;
  const conversationBase = {
    text,
    conversationTopics,
    strands: conversationStrands,
    curiosity: state.curiosity,
    energy: state.energy,
    contextMessages: recentMessages.length,
    resumeThread: resumeThreadForMode,
    explicitLearning: resolvedContextFact !== null,
  };
  let conversationPlan = decideConversationMode({ ...conversationBase, impulseAllowed: false });

  /**
   * Kontextreduktion für die Sprachschicht: bei einer konkreten Frage bleibt der
   * bestehende Abruf (max. 6 belastbare Erinnerungen) erhalten, weil er zur
   * Antwort gebraucht wird. In allen anderen Modi gehen nur die Stränge mit,
   * die diesen Gesprächsmoment tatsächlich betreffen. Es werden weiterhin keine
   * IDs, Gewichte, Formeln, Tabellen oder Daten anderer Nutzer übertragen.
   */
  const promptMemories = (plan: typeof conversationPlan): string[] =>
    plan.mode === "DIRECT_ANSWER" ? activeMemories : plan.relevantStrands;
  const promptPhrasings = (plan: typeof conversationPlan) => {
    const allowed = new Set(promptMemories(plan));
    return phrasings.filter((p) => allowed.has(p.content));
  };

  /**
   * Prozesskontinuität („digitaler Hippocampus“): passt die aktuelle Handlung
   * noch zum bekannten Prozesszustand? Der Hinweis informiert nur, blockiert
   * nie und gibt die Entscheidung an den Nutzer zurück. Geladen wird der
   * Prozesszustand ausschliesslich bei erkannter Handlungsabsicht.
   */
  const intent = detectIntent(text);
  const processCtx = intent ? await loadProcessContext(db, userId, (p) => q.tick(p)) : null;
  const processChange = detectProcessChange(text);
  let guardrailApplied: { updated: string[]; blockedReason: string | null } | null = null;
  if (processCtx) {
    const userDecision = parseProcessDecision(text);
    if (userDecision) {
      guardrailApplied = await applyProcessDecision(db, userId, (p) => q.tick(p), {
        text,
        decision: userDecision,
        pending: processCtx.pending,
        steps: processCtx.steps,
        now,
      });
    }
  }
  const guardrail =
    processCtx && guardrailApplied === null
      ? decideGuardrail({
          steps: processCtx.steps,
          intent,
          lastGuardrailAt: processCtx.lastGuardrailAt,
          acknowledgedStepIds: processCtx.acknowledgedStepIds,
          now,
        })
      : null;

  const aiStart = Date.now();
  let spoken: { reply: string; status: "ok" | "quota" | "unavailable"; meta: OrbLlmMeta };
  let selfQuestion: { question: string; gap: KnowledgeGap; score: number; reason: string } | null =
    null;
  /** Interne Begründung – nur Diagnose, nie Antworttext. */
  let internalNote: string | null = null;

  if (isAskMeRequest(text)) {
    // Ausdrückliche Aufforderung ist kein Freifahrtschein: der Curiosity Core
    // entscheidet genauso wie bei einer eigenen, unaufgeforderten Frage.
    const ctx = await loadCuriosityContext(db, userId, q, now);
    const verdict = decideCuriosity({
      curiosity: ctx.state.curiosity,
      energy: ctx.state.energy,
      gaps: ctx.gaps,
      lastQuestionAt: ctx.lastQuestionAt,
      openQuestion: ctx.openQuestion !== null,
      now,
    });
    let blocked = verdict.reason;
    if (verdict.action === "ASK" && verdict.gap) {
      const formulated = await formulateQuestion(ctx, verdict.gap);
      if (formulated.status !== "ok" || !formulated.question) {
        blocked = "Meine Sprachschicht antwortet gerade nicht.";
      } else if (
        isDuplicateQuestion(
          formulated.question,
          ctx.questions.map((row) => row.question),
        )
      ) {
        blocked = "Diese Frage habe ich dir in ähnlicher Form schon gestellt.";
      } else {
        selfQuestion = {
          question: formulated.question,
          gap: verdict.gap,
          score: verdict.score,
          reason: verdict.reason,
        };
      }
    }
    if (selfQuestion) {
      // Echter, vom bestehenden Curiosity Core freigegebener eigener Impuls:
      // diese Entscheidung erreicht sichtbar die Sprachschicht. Cooldowns und
      // Schwellen wurden dabei unverändert von `decideCuriosity` geprüft.
      conversationPlan = decideConversationMode({ ...conversationBase, impulseAllowed: true });
      internalNote = verdict.reason;
      spoken = {
        reply: selfQuestion.question,
        status: "ok",
        meta: { provider: "local", fallbackUsed: false, reason: "interne Frage ohne Sprachaufruf" },
      };
    } else {
      // Kein innerer Grund für eine eigene Frage: interne Begründung bleibt
      // intern (Diagnose), die Eingabe wird normal beantwortet.
      internalNote = blocked;
      spoken = await speak({
        text,
        state,
        goals,
        decision: "answer",
        recalled: promptMemories(conversationPlan),
        interests,
        context: speakContext,
        phrasings: promptPhrasings(conversationPlan),
        style: styleHint(styleState.profile),
        openThreads: [],
        contradictions,
        images,
        mode: conversationPlan.mode,
        modeReason: conversationPlan.reason,
      });
    }
  } else {
    // Nutzereingabe hat Vorrang: interne Steuerwerte blockieren das Gespräch nie.
    // Die Art des Beitrags bestimmt der Core (conversationPlan), nicht das LLM.
    internalNote = conversationPlan.reason;
    spoken = await speak({
      text,
      state,
      goals,
      decision: conversationDecision(decision).decision,
      recalled: promptMemories(conversationPlan),
      interests,
      context: speakContext,
      phrasings: promptPhrasings(conversationPlan),
      style: styleHint(styleState.profile),
      openThreads:
        conversationPlan.mode === "FOLLOW_UP" && resumeVerdict.resume && resumeCandidate
          ? [
              {
                title: resumeCandidate.thread.title,
                status: resumeCandidate.thread.status,
                unknown: resumeCandidate.thread.unknown,
              },
            ]
          : [],
      contradictions,
      images,
      mode: conversationPlan.mode,
      modeReason: conversationPlan.reason,
    });
  }
  const aiMs = Date.now() - aiStart;
  const spokenReply =
    spoken.status === "ok" ? stripFakePauseClaim(spoken.reply) : FALLBACK[spoken.status];
  // Bildkontext vorhanden, aber nicht ausgewertet → ausdrücklich benennen.
  const baseReply =
    images.length > 0 && !spoken.meta.imageContextProcessed
      ? `${spokenReply} ${IMAGE_NOT_PROCESSED_HINT}`.trim()
      : spokenReply;
  // Der Prozesshinweis steht vor der Antwort: verlorener Kontext zuerst,
  // danach die normale Antwort. Es wird nichts unterdrückt oder blockiert.
  const reply = [
    guardrail?.action === "ASK" ? guardrail.message : null,
    processChange.changed && !processChange.scopeKnown ? processChange.question : null,
    baseReply,
  ]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join("\n\n");

  if (selfQuestion) {
    const row = await q.tick(
      db.from("orb_questions").insert({
        user_id: userId,
        question: selfQuestion.question,
        topic: selfQuestion.gap.topic,
        knowledge_gap: selfQuestion.gap.gap,
        gap_kind: selfQuestion.gap.kind,
        source_memory_ids: [selfQuestion.gap.nodeId],
        score: selfQuestion.score,
        reason: `Ausdrücklich angefragt, innerer Grund: ${selfQuestion.reason}`,
        asked_at: new Date(now).toISOString(),
      }),
    );
    if (row.error) throw new Error(row.error.message);
  }

  // --- Gedächtnis aktualisieren -------------------------------------------
  let reactivations = 0;
  let learnedNew = false;
  const delta = reinforcement(importance);

  // 1. Abgerufene Erinnerungen reaktivieren (kein Löschen, nur Aufwertung).
  for (const r of recalled) {
    const node = r.node;
    const res = await q.tick(
      db
        .from("orb_nodes")
        .update({
          activation_count: node.activationCount + 1,
          last_accessed_at: new Date(now).toISOString(),
          importance: Math.max(node.importance, importance * 0.8),
        })
        .eq("id", node.id)
        .eq("user_id", userId),
    );
    if (res.error) throw new Error(res.error.message);
    reactivations += 1;
  }

  // 1b. Ausdrückliche Korrektur des Benutzers („Eier war ein Tippfehler“):
  // die betroffene Erinnerung wird über die BESTEHENDE Rückmeldelogik
  // abgeschwächt. Kein Löschen, kein neues Feld, keine zweite Mechanik.
  const currentCorrection = correctedTerm(text);
  if (currentCorrection) {
    for (const r of recalled) {
      if (!r.node.content.toLowerCase().includes(currentCorrection)) continue;
      await recordFeedback(db, userId, { nodeId: r.node.id, kind: "negative" });
    }
  }

  // Eine Antwort auf eine eigene Frage ist immer ein Lernereignis: sie wird
  // gespeichert, auch wenn die Aussage für sich genommen unauffällig wäre.
  const openQuestionRow = isAskMeRequest(text) ? null : await findOpenQuestion(db, userId, q, now);
  const answeringQuestion = openQuestionRow !== null;

  // 2. Knoten: bestehende gleiche Erfahrung verstärken statt duplizieren.
  let focusNodeId: string | null = null;
  if (exact) {
    focusNodeId = exact.id;
    const res = await q.tick(
      db
        .from("orb_nodes")
        .update({
          activation_count: exact.activation_count + 1,
          last_accessed_at: new Date(now).toISOString(),
          importance: Math.max(exact.importance, importance),
          confidence: Math.max(exact.confidence, confidenceFor(source, exact.activation_count + 1)),
        })
        .eq("id", exact.id)
        .eq("user_id", userId),
    );
    if (res.error) throw new Error(res.error.message);
    reactivations += 1;
    // Ausnahmen wie bisher fallbezogen (nicht global): Antwort auf eine eigene
    // Frage – und neu eine ausdrücklich belegte Merk-Aufforderung des Benutzers.
    // Eingangskontrolle der Äusserungsart: nur eine eigene Aussage des Benutzers
    // kann eine persönliche Tatsachen-Erinnerung werden. Bei einer belegten
    // Merk-Aufforderung gilt die aufgelöste Aussage, nicht der Auftragssatz.
    // Schwelle 0.35 und alle Formeln bleiben unverändert.
  } else if (
    isStorableStatement(memoryText) &&
    (shouldPersist(importance) ||
      shouldPersist(memoryImportance) ||
      answeringQuestion ||
      resolvedContextFact !== null)
  ) {
    const type: OrbNodeType = learning ? "decision" : isQuestion ? "perception" : "memory";
    const row = {
      user_id: userId,
      type,
      // Bei einer belegten Merk-Aufforderung wird die aufgelöste Aussage
      // gespeichert statt des Auftrags. Wichtigkeits-, Konfidenz- und
      // Quellenformeln sowie die Schwelle 0.35 bleiben unverändert.
      content: memoryText,
      importance: memoryImportance,
      confidence: learning ? 0.9 : confidenceFor(source),
      source,
      norm_key: normKey(memoryText) || null,
      topic: resolvedContextFact ? topicOf(memoryText) : topic,
      activation_count: 1,
      metadata: { learning_event: learning, decision },
    };
    let inserted = await q.tick(db.from("orb_nodes").insert(row).select("id").single());
    // Schlüsselkonflikt = Unsicherheit: niemals zusammenführen, sondern
    // als eigenen Knoten ohne Schlüssel speichern.
    if (inserted.error?.code === "23505" && row.norm_key) {
      inserted = await q.tick(
        db
          .from("orb_nodes")
          .insert({ ...row, norm_key: null })
          .select("id")
          .single(),
      );
    }
    if (inserted.error) throw new Error(inserted.error.message);
    focusNodeId = inserted.data.id;
    learnedNew = true;
  }

  // 3. Verbindungen: bestehende verstärken, sonst anlegen (keine Duplikate).
  if (focusNodeId) {
    for (const r of recalled) {
      if (r.node.id === focusNodeId) continue;
      const result = await touchConnection(
        db,
        userId,
        r.node.id,
        focusNodeId,
        {
          delta,
          importance,
          decayRate: learning ? 0.02 : 0.05,
          origin: "experience",
        },
        q,
        now,
      );
      if (result === "reactivated") reactivations += 1;
    }
  }

  // 4. Interessenmodell fortschreiben.
  if (topic && (importance >= 0.35 || exact)) {
    await upsertInterest(db, userId, topic, source, importance, q);
  }

  // 5. Antwort auf eine eigene Frage: Frage schliessen, Erinnerung verstärken,
  //    Antwort mit der auslösenden Erinnerung verbinden (Lernereignis).
  //    Eine Aufforderung („frag mich“) ist nie eine Antwort auf eine Frage.
  let answeredQuestion: { question: string; topic: string | null } | null = null;
  if (openQuestionRow) {
    answeredQuestion = await closeOpenQuestion(
      db,
      userId,
      { answerText: text, answerNodeId: focusNodeId, importance },
      openQuestionRow,
      q,
      now,
    );
    if (answeredQuestion) reactivations += 1;
  }

  // --- 6. Kontinuität fortschreiben ---------------------------------------
  // Gedankenfäden: passenden Faden verstärken, sonst einen neuen öffnen.
  const threadSync = await syncThreads(db, userId, q, {
    text,
    topic,
    importance,
    focusNodeId,
    loaded: loadedThreads,
    conversationTopics,
    interests,
    now,
  });
  // Lange unberührte Fäden pausieren – sie werden nie gelöscht.
  const pausedThreads = await pauseStaleThreads(db, userId, q, loadedThreads, now);

  // Antwort auf eine eigene Frage kann einen Faden klären.
  const resolvedThread = answeredQuestion
    ? await resolveThreadForAnswer(db, userId, q, {
        loaded: loadedThreads,
        topic: answeredQuestion.topic,
        nodeId: openQuestionRow?.source_memory_ids[0] ?? null,
        answer: text,
        now,
      })
    : null;

  // Wurde ein alter Faden erwähnt, wird die Wiederaufnahme protokolliert.
  if (resumeVerdict.resume && resumeCandidate) {
    await noteThreadResume(db, userId, q, resumeCandidate.thread, now);
  }

  // Möglicher Widerspruch: offene Beziehung, kein Überschreiben.
  const contradictionsStored = await persistContradictions(db, userId, {
    contradictions,
    focusNodeId,
    loaded: loadedThreads,
    q,
    now,
    touch: (sourceId, targetId, origin) =>
      touchConnection(
        db,
        userId,
        sourceId,
        targetId,
        { delta: 0.1, importance: Math.max(0.5, importance), decayRate: 0.02, origin },
        q,
        now,
      ),
  });

  // Gesprächsstil: nur Zählwerte, Wirkung erst bei wiederkehrendem Muster.
  const styleProfile = await recordStyle(db, userId, q, styleState, text);

  // Umgang mit der neuen Information – benennbar, nicht automatisch fragen.
  const handling = decideHandling({
    importance,
    curiosity: state.curiosity,
    hasGap: (threadSync.created ?? threadSync.reactivated) !== null,
    cooldownActive: false,
    openQuestion: openQuestionRow !== null,
    contradiction: contradictions.length > 0,
  });

  const shift = continuityStateShift({
    newThread: threadSync.created !== null,
    reactivatedThread: threadSync.reactivated !== null,
    resolvedThread: resolvedThread !== null,
    contradictions: contradictionsStored,
  });

  // --- Zustand aktualisieren ---------------------------------------------
  const base = nextState(state, {
    importance,
    isQuestion,
    isLearning: learning,
    recalled: recalled.length,
  });
  // Kontinuitätsereignisse verschieben den Zustand nachvollziehbar mit.
  const updated: OrbState = {
    ...base,
    curiosity: Math.min(1, Math.max(0, base.curiosity + shift.curiosity)),
    uncertainty: Math.min(1, Math.max(0, base.uncertainty + shift.uncertainty)),
    trust: Math.min(1, Math.max(0, base.trust + shift.trust)),
  };
  const stateUpdate = await q.tick(
    db
      .from("orb_state")
      .update({
        curiosity: updated.curiosity,
        joy: updated.joy,
        fear: updated.fear,
        trust: updated.trust,
        uncertainty: updated.uncertainty,
        energy: updated.energy,
        cracks: stateRow.cracks + (learning && importance >= 0.7 ? 1 : 0),
        reactivation_count: stateRow.reactivation_count + reactivations,
      })
      .eq("user_id", userId),
  );
  if (stateUpdate.error) throw new Error(stateUpdate.error.message);

  // Beide Zeilen entstehen im selben Aufruf: der Zeitstempel wird bewusst
  // gesetzt, damit die Reihenfolge Eingabe → Antwort eindeutig bleibt.
  const msgInsert = await q.tick(
    db.from("orb_messages").insert([
      {
        user_id: userId,
        role: "user",
        body: text,
        state_snapshot: {},
        created_at: new Date(now).toISOString(),
      },
      {
        user_id: userId,
        role: "orb",
        body: reply,
        decision,
        state_snapshot: {
          ...updated,
          importance,
          recalled: recalled.length,
          // Offener Prozesshinweis: nur Diagnose und Wiedererkennung der
          // Rückfrage, keine zweite Prozessablage.
          ...(guardrail?.action === "ASK"
            ? {
                guardrail: {
                  kind: guardrail.kind,
                  score: guardrail.score,
                  step_ids: guardrail.steps.map((s) => s.nodeId),
                  scope: GUARDRAIL_SCOPE,
                },
              }
            : {}),
        },
        created_at: new Date(now + 1).toISOString(),
      },
    ]),
  );
  if (msgInsert.error) throw new Error(msgInsert.error.message);

  const perf: OrbPerf = {
    retrievalMs,
    relevanceMs,
    aiMs,
    totalMs: Date.now() - startedAt,
    nodesLoaded: candidateNodes.length,
    connectionsLoaded: connections.length,
    dbQueries: q.count,
  };
  await db.from("orb_metrics").insert({
    user_id: userId,
    kind: "turn",
    retrieval_ms: perf.retrievalMs,
    relevance_ms: perf.relevanceMs,
    ai_ms: perf.aiMs,
    total_ms: perf.totalMs,
    nodes_loaded: perf.nodesLoaded,
    connections_loaded: perf.connectionsLoaded,
    db_queries: perf.dbQueries,
  });

  return {
    reply,
    decision,
    decisionReason: reason,
    importance,
    learningEvent: learning,
    reactivated: reactivations > 0,
    learnedNew,
    topic,
    recalled: recalled.map((r) => ({
      id: r.node.id,
      content: r.node.content,
      weight: bestWeight.get(r.node.id) ?? 0,
      level: r.level,
    })),
    answeredQuestion,
    context: {
      messages: recentMessages.length,
      limit: CONTEXT_WINDOW_MESSAGES,
      resolvedFact: resolvedContextFact?.fact ?? null,
      resolveReason: resolvedContextFact?.reason ?? null,
    },
    selfQuestion: selfQuestion
      ? {
          question: selfQuestion.question,
          topic: selfQuestion.gap.topic,
          kind: selfQuestion.gap.kind,
          score: selfQuestion.score,
        }
      : null,
    continuity: {
      handling: handling.handling,
      handlingReason: handling.reason,
      newThread: threadSync.created?.title ?? null,
      reactivatedThread: threadSync.reactivated?.title ?? null,
      pausedThreads: pausedThreads.length,
      resolvedThread: resolvedThread?.title ?? null,
      resumedThread: resumeVerdict.resume && resumeCandidate ? resumeCandidate.thread.title : null,
      resumeReason: resumeVerdict.reason,
      contradictions: contradictions.map((c) => c.memory),
      contradictionsStored,
      style: styleTraits(styleProfile),
      styleHint: styleHint(styleProfile),
      certainty: phrasings.map((p) => ({ content: p.content, certainty: p.certainty })),
      stateShift: { ...shift, reason: shift.reason.join(" ") },
      scope: CONTINUITY_SCOPE,
      internalNote,
    },
    conversation: {
      mode: conversationPlan.mode,
      reason: conversationPlan.reason,
      relevantStrands: conversationPlan.relevantStrands,
      focusTopic: conversationPlan.focusTopic,
    },
    snapshot: await getSnapshot(db, userId, perf),
    aiStatus: spoken.status,
    llm: spoken.meta,
    perf,
  };
}

/**
 * Ausdrückliches Lernereignis („Riss“): wird mit hoher Wichtigkeit gespeichert
 * und beeinflusst künftige Entscheidungen. Nachvollziehbar protokolliert.
 */
export async function recordLearning(db: DB, userId: string, lesson: string): Promise<OrbSnapshot> {
  const text = lesson.trim().slice(0, MAX_INPUT_CHARS);
  if (!text) throw new Error("empty lesson");
  // Eingangskontrolle vor dem hohen Wichtigkeitswert (0.95 bleibt unverändert):
  // nur eine belastbare eigene Aussage darf diesen Weg benutzen. Fragen,
  // Aufforderungen und Fragmente werden abgelehnt, statt dauerhaft als
  // hochgewichtete Tatsache zu entstehen.
  if (!isStorableStatement(text)) {
    throw new Error("lesson is not a reliable statement");
  }
  const stateRow = await ensureState(db, userId);
  const q = new QueryCounter();
  const now = Date.now();
  const key = normKey(text) || null;

  const existing = key
    ? await db.from("orb_nodes").select("*").eq("user_id", userId).eq("norm_key", key).maybeSingle()
    : { data: null, error: null };
  if (existing.error) throw new Error(existing.error.message);

  let nodeId: string;
  if (existing.data) {
    nodeId = existing.data.id;
    await db
      .from("orb_nodes")
      .update({
        importance: Math.max(existing.data.importance, 0.95),
        activation_count: existing.data.activation_count + 1,
        last_accessed_at: new Date(now).toISOString(),
      })
      .eq("id", nodeId)
      .eq("user_id", userId);
  } else {
    const row = {
      user_id: userId,
      type: "decision" as const,
      content: text,
      importance: 0.95,
      confidence: 0.9,
      source: "user_stated" as const,
      norm_key: key,
      topic: topicOf(text),
      activation_count: 1,
      metadata: { learning_event: true, crack: true },
    };
    let node = await db.from("orb_nodes").insert(row).select("id").single();
    // Schlüsselkonflikt = Unsicherheit: kein Merge, eigener Knoten ohne Schlüssel.
    if (node.error?.code === "23505" && row.norm_key) {
      node = await db
        .from("orb_nodes")
        .insert({ ...row, norm_key: null })
        .select("id")
        .single();
    }
    if (node.error) throw new Error(node.error.message);
    nodeId = node.data.id;
  }

  const goalNode = await db
    .from("orb_nodes")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "goal")
    .limit(1)
    .maybeSingle();
  if (goalNode.error) throw new Error(goalNode.error.message);

  const goalId =
    goalNode.data?.id ??
    (
      await db
        .from("orb_nodes")
        .insert({
          user_id: userId,
          type: "goal",
          content: "Dem Benutzer helfen",
          importance: 0.9,
          confidence: 0.9,
          source: "user_stated",
          norm_key: "ziel-helf",
          topic: "ziele",
        })
        .select("id")
        .single()
    ).data?.id;

  if (goalId) {
    await touchConnection(
      db,
      userId,
      nodeId,
      goalId,
      { delta: 0.3, importance: 0.95, decayRate: 0.01, origin: "learning_event" },
      q,
      now,
    );
  }

  await db
    .from("orb_state")
    .update({
      cracks: stateRow.cracks + 1,
      fear: Math.min(1, stateRow.fear + 0.1),
      uncertainty: Math.min(1, stateRow.uncertainty + 0.05),
      // Zeitstempel wird neu gesetzt: bereits erholte Energie mitschreiben,
      // damit die Ruhezeit nicht verloren geht (Rate/Obergrenze unverändert).
      energy: toState(stateRow).energy,
    })
    .eq("user_id", userId);

  return getSnapshot(db, userId);
}

/* ------------------------------------------------------------- Feedback */

/**
 * Rückmeldung zu einer Erinnerung: positiv verstärkt, negativ schwächt ab.
 * Gelöscht wird nichts – das Gewicht bleibt mindestens bei W_MIN.
 */
export async function recordFeedback(
  db: DB,
  userId: string,
  input: { nodeId: string; kind: "positive" | "negative" },
): Promise<OrbSnapshot> {
  const node = await db
    .from("orb_nodes")
    .select("*")
    .eq("user_id", userId)
    .eq("id", input.nodeId)
    .maybeSingle();
  if (node.error) throw new Error(node.error.message);
  if (!node.data) throw new Error("unknown node");

  const delta = feedbackDelta(input.kind, node.data.importance);
  const now = Date.now();
  const q = new QueryCounter();

  const conns = await db
    .from("orb_connections")
    .select("*")
    .eq("user_id", userId)
    .or(`source_node_id.eq.${input.nodeId},target_node_id.eq.${input.nodeId}`)
    .limit(50);
  if (conns.error) throw new Error(conns.error.message);

  for (const c of conns.data) {
    const live = currentWeight({
      weight: c.weight,
      importance: c.importance,
      decayRate: c.decay_rate,
      lastActivatedAt: new Date(c.last_activated_at).getTime(),
      now,
    });
    await db
      .from("orb_connections")
      .update({
        weight: applyFeedbackToWeight(live, delta),
        last_activated_at: new Date(now).toISOString(),
        activation_count: c.activation_count + 1,
        metadata: { ...(c.metadata as Record<string, unknown>), last_feedback: input.kind },
      })
      .eq("id", c.id)
      .eq("user_id", userId);
  }

  if (node.data.topic) {
    await upsertInterest(
      db,
      userId,
      node.data.topic,
      node.data.source,
      node.data.importance,
      q,
      delta,
    );
  }

  await db
    .from("orb_nodes")
    .update({
      last_accessed_at: new Date(now).toISOString(),
      activation_count: node.data.activation_count + 1,
      metadata: { ...(node.data.metadata as Record<string, unknown>), last_feedback: input.kind },
    })
    .eq("id", input.nodeId)
    .eq("user_id", userId);

  return getSnapshot(db, userId);
}

/* -------------------------------------------------- Curiosity Core (Fragen) */

export type OrbCuriosityGap = {
  nodeId: string;
  memory: string;
  topic: string;
  kind: KnowledgeGapKind;
  gap: string;
  score: number;
  relevance: number;
  novelty: number;
  conversationalFit: number;
  reason: string;
};

export type OrbProactiveResult = {
  asked: boolean;
  /** Entscheidung des Curiosity Core: DO_NOTHING | WAIT | ASK. */
  action: CuriosityAction;
  /** Begründung der Entscheidung (auch wenn der ORB still bleibt). */
  reason: string;
  question: string | null;
  topic: string | null;
  kind: KnowledgeGapKind | null;
  score: number;
  snapshot: OrbSnapshot | null;
  perf: OrbPerf | null;
  /** Interner Versuchsnachweis (auch bei Ablehnung) – keine neue Tabelle. */
  attempt: OrbAutonomyAttempt | null;
};

/** Read-only Einblick für den Testbereich – schreibt nichts. */
export type OrbCuriosityInsight = {
  curiosity: number;
  energy: number;
  action: CuriosityAction;
  reason: string;
  score: number;
  band: string;
  gaps: OrbCuriosityGap[];
  openQuestion: string | null;
  lastQuestion: { question: string; reason: string; answered: boolean; askedAt: string } | null;
  cooldownMs: number;
  scope: typeof CURIOSITY_SCOPE;
};

type QuestionRow = Database["public"]["Tables"]["orb_questions"]["Row"];

function asGapKind(value: string): KnowledgeGapKind | null {
  return (KNOWLEDGE_GAP_KINDS as readonly string[]).includes(value)
    ? (value as KnowledgeGapKind)
    : null;
}

/** Wie viele vergangene eigene Fragen für Duplikatprüfung geladen werden. */
const QUESTION_HISTORY_LIMIT = 30;
/** Nach dieser Zeit gilt eine offene Frage als nicht mehr beantwortbar. */
const ANSWER_WINDOW_MS = 30 * 60_000;

type CuriosityContext = {
  stateRow: Database["public"]["Tables"]["orb_state"]["Row"];
  state: OrbState;
  memories: ProactiveMemory[];
  interests: OrbInterest[];
  questions: QuestionRow[];
  asked: AskedQuestion[];
  conversationTopics: string[];
  lastQuestionAt: number | null;
  openQuestion: QuestionRow | null;
  gaps: KnowledgeGap[];
  /** Lücken aus dem Spiderweb (Proactive Intent) – rein lesend erkannt. */
  detectedGaps: DetectedGap[];
  /** Letzte Nutzertexte – für Abbruch-/Freigabe-Erkennung. */
  recentUserTexts: string[];
  nodesLoaded: number;
  connectionsLoaded: number;
  retrievalMs: number;
  relevanceMs: number;
};

/**
 * Lädt den begrenzten Kontext des Curiosity Core: wenige Erinnerungen,
 * Interessen, letzte Nachrichten und die eigene Fragenhistorie.
 * Keine Vollabfrage, kein Polling – dieser Aufruf erfolgt nur ereignisbasiert.
 */
async function loadCuriosityContext(
  db: DB,
  userId: string,
  q: QueryCounter,
  now: number,
): Promise<CuriosityContext> {
  const stateRow = await ensureState(db, userId, q);
  const state = toState(stateRow);

  const retrievalStart = Date.now();
  const [nodeRes, interestRes, msgRes, questionRes, connRes] = await Promise.all([
    q.tick(
      db
        .from("orb_nodes")
        .select("*")
        .eq("user_id", userId)
        .not("topic", "is", null)
        .order("importance", { ascending: false })
        .order("last_accessed_at", { ascending: false })
        .limit(12),
    ),
    q.tick(
      db
        .from("orb_interests")
        .select("*")
        .eq("user_id", userId)
        .order("weight", { ascending: false })
        .limit(8),
    ),
    q.tick(
      db
        .from("orb_messages")
        .select("body, role")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8),
    ),
    q.tick(
      db
        .from("orb_questions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(QUESTION_HISTORY_LIMIT),
    ),
    // Verbindungen für die Lückensuche im Spiderweb – begrenzt, nur lesend.
    q.tick(
      db
        .from("orb_connections")
        .select("source_node_id, target_node_id, weight")
        .eq("user_id", userId)
        .order("weight", { ascending: false })
        .limit(60),
    ),
  ]);
  if (nodeRes.error) throw new Error(nodeRes.error.message);
  if (interestRes.error) throw new Error(interestRes.error.message);
  if (msgRes.error) throw new Error(msgRes.error.message);
  if (questionRes.error) throw new Error(questionRes.error.message);
  if (connRes.error) throw new Error(connRes.error.message);
  const retrievalMs = Date.now() - retrievalStart;

  const questions = questionRes.data;
  const asked: AskedQuestion[] = questions.map((row) => ({
    nodeId: row.source_memory_ids[0] ?? null,
    topic: row.topic,
    kind: asGapKind(row.gap_kind),
    question: row.question,
    answered: row.answered,
  }));

  const conversationTopics = msgRes.data.flatMap((m) => topicsOf(m.body));
  const memories: ProactiveMemory[] = mapNodes(nodeRes.data).map((n) => ({
    id: n.id,
    content: n.content,
    topic: n.topic,
    importance: n.importance,
    confidence: n.confidence,
    activationCount: n.activationCount,
    lastAccessedAt: new Date(n.lastAccessedAt).getTime(),
  }));

  const relevanceStart = Date.now();
  const gaps = deriveKnowledgeGaps({
    memories,
    interests: mapInterests(interestRes.data),
    asked,
    conversationTopics,
    curiosity: state.curiosity,
    now,
  });
  // Offene Gedankenfäden liefern zusätzliche Lücken – gleicher Weg, kein
  // vollständiger Graph-Scan.
  const threadEntries = await loadThreads(db, userId, q);
  const threadGaps = threadKnowledgeGaps(
    threadEntries.map((e) => projectThread(e.thread, now)),
    {
      curiosity: state.curiosity,
      conversationTopics,
      interests: mapInterests(interestRes.data),
      now,
    },
  );
  const mergedGaps = [...gaps, ...threadGaps].sort((a, b) => b.score - a.score).slice(0, 12);

  // Proactive Intent: Lücken im Spiderweb (Beziehungen, Widersprüche, offene
  // Entscheidungen). Rein rechnend aus den bereits geladenen Zeilen.
  const gapNodes: GapNode[] = nodeRes.data.map((row) => {
    const extra = row as unknown as {
      long_term_value?: number | null;
      temporal_scope?: string | null;
      category?: string | null;
    };
    return {
      id: row.id,
      content: row.content,
      topic: row.topic,
      importance: row.importance,
      confidence: row.confidence,
      longTermValue: extra.long_term_value ?? null,
      temporalScope: (extra.temporal_scope as TemporalScope | null) ?? null,
      category: extra.category ?? null,
      activationCount: row.activation_count,
      lastAccessedAt: new Date(row.last_accessed_at).getTime(),
    };
  });
  const detectedGaps = detectGaps({
    nodes: gapNodes,
    connections: connRes.data.map((c) => ({
      sourceNodeId: c.source_node_id,
      targetNodeId: c.target_node_id,
      weight: c.weight,
    })),
    conversationTopics,
    now,
  });
  const relevanceMs = Date.now() - relevanceStart;

  const askedRows = questions.filter((row) => row.asked_at !== null);
  const lastQuestionAt = askedRows[0]?.asked_at ? new Date(askedRows[0].asked_at).getTime() : null;
  const openQuestion =
    askedRows.find(
      (row) =>
        !row.answered &&
        row.asked_at !== null &&
        now - new Date(row.asked_at).getTime() < ANSWER_WINDOW_MS,
    ) ?? null;

  return {
    stateRow,
    state,
    memories,
    interests: mapInterests(interestRes.data),
    questions,
    asked,
    conversationTopics,
    lastQuestionAt,
    openQuestion,
    gaps: mergedGaps,
    detectedGaps,
    recentUserTexts: msgRes.data.filter((m) => m.role === "user").map((m) => m.body),
    nodesLoaded: nodeRes.data.length,
    connectionsLoaded: connRes.data.length,
    retrievalMs,
    relevanceMs,
  };
}

function toInsight(ctx: CuriosityContext, now: number): OrbCuriosityInsight {
  const decision = decideCuriosity({
    curiosity: ctx.state.curiosity,
    energy: ctx.state.energy,
    gaps: ctx.gaps,
    lastQuestionAt: ctx.lastQuestionAt,
    openQuestion: ctx.openQuestion !== null,
    now,
  });
  const last = ctx.questions.find((row) => row.asked_at !== null) ?? null;
  return {
    curiosity: ctx.state.curiosity,
    energy: ctx.state.energy,
    action: decision.action,
    reason: decision.reason,
    score: decision.score,
    band: decision.band,
    gaps: ctx.gaps.slice(0, 5).map((g) => ({
      nodeId: g.nodeId,
      memory: g.memory,
      topic: g.topic,
      kind: g.kind,
      gap: g.gap,
      score: g.score,
      relevance: g.relevance,
      novelty: g.novelty,
      conversationalFit: g.conversationalFit,
      reason: g.reason,
    })),
    openQuestion: ctx.openQuestion?.question ?? null,
    lastQuestion:
      last && last.asked_at
        ? {
            question: last.question,
            reason: last.reason,
            answered: last.answered,
            askedAt: last.asked_at,
          }
        : null,
    cooldownMs: ctx.lastQuestionAt === null ? 0 : Math.max(0, now - ctx.lastQuestionAt),
    scope: CURIOSITY_SCOPE,
  };
}

/** Testbereich: aktuelle Neugier, offene Lücken und Entscheidung – nur lesend. */
export async function inspectCuriosity(db: DB, userId: string): Promise<OrbCuriosityInsight> {
  const q = new QueryCounter();
  const now = Date.now();
  const ctx = await loadCuriosityContext(db, userId, q, now);
  return toInsight(ctx, now);
}

/**
 * Wandelt einen erkannten Impuls in die bestehende Lückenform um, damit der
 * vorhandene Fragen-, Duplikat- und Antwortpfad unverändert weiterläuft.
 */
function gapFromImpulse(candidate: ImpulseCandidate, ctx: CuriosityContext): KnowledgeGap {
  const gap = candidate.gap;
  const memory =
    ctx.memories.find((m) => gap.relatedNodes.includes(m.id))?.content ?? gap.suggestedQuestion;
  return {
    id: gap.id,
    nodeId: gap.relatedNodes[0] ?? "",
    memory,
    topic: gap.topic ?? "kontext",
    kind: "kontext",
    gap: gap.reason,
    importance: gap.importance,
    confidence: gap.confidence,
    interestWeight: gap.futureRelevance,
    relevance: gap.futureRelevance,
    novelty: 1,
    conversationalFit: gap.topic && ctx.conversationTopics.includes(gap.topic) ? 1 : 0.6,
    score: candidate.score,
    reason: candidate.reason,
  };
}

/** Formuliert die Frage zur gewählten Wissenslücke (Sprachschicht). */
async function formulateQuestion(
  ctx: CuriosityContext,
  gap: KnowledgeGap,
  impulseCandidate: ImpulseCandidate | null = null,
): Promise<{ question: string; status: "ok" | "quota" | "unavailable" }> {
  const impulse = impulseCandidate
    ? [
        impulseCandidate.gap.form === "observation"
          ? "Du teilst eine kurze, sachliche Beobachtung zu einem Zusammenhang, der dir aufgefallen ist."
          : "Du möchtest aus eigenem Interesse genau eine offene Stelle klären.",
        `Bekannter Zusammenhang: „${gap.memory}“.`,
        `Deine offene Stelle: ${impulseCandidate.gap.reason}`,
        `Inhaltliche Richtung: ${impulseCandidate.gap.suggestedQuestion}`,
        impulseCandidate.gap.form === "observation"
          ? "Formuliere genau einen kurzen Satz auf Deutsch, ohne Frage."
          : "Formuliere genau eine kurze, konkrete Frage auf Deutsch.",
        "Keine Begrüssung, keine Einleitung, keine allgemeine Floskel.",
        "Behaupte nichts, was du nicht sicher weisst, und spekuliere nicht.",
      ].join(" ")
    : [
        `Du möchtest aus eigener Neugier etwas über das Thema „${gap.topic}“ wissen.`,
        `Bekannte Erinnerung: „${gap.memory}“.`,
        `Deine Wissenslücke: ${gap.gap}`,
        GAP_HINT[gap.kind],
        "Formuliere genau eine kurze, konkrete Frage auf Deutsch, die sich sichtbar auf diese Erinnerung bezieht.",
        "Keine Begrüssung, keine Einleitung, keine allgemeine Floskel wie „Wie geht es dir?“.",
        "Behaupte nichts, was du nicht sicher weisst.",
      ].join(" ");
  const spoken = await speak({
    text: impulse,
    state: ctx.state,
    goals: Array.isArray(ctx.stateRow.goals) ? (ctx.stateRow.goals as string[]) : ["help_user"],
    decision: "ask",
    recalled: [gap.memory],
    interests: ctx.interests,
  });
  return { question: spoken.reply.trim().slice(0, 600), status: spoken.status };
}

/**
 * Eigene Frage aus dem Curiosity Core – ausschliesslich im ORB-Core-Chat.
 *
 * Aufruf erfolgt nur ereignisbasiert (Leerlauf-Beobachter im Browser oder
 * ausdrückliche Aufforderung). Der Server prüft Wissenslücke, Neugier,
 * Cooldown und Duplikate erneut und bleibt ohne inneren Grund still.
 */
export async function askProactively(
  db: DB,
  userId: string,
  options: { explicit?: boolean } = {},
): Promise<OrbProactiveResult> {
  const startedAt = Date.now();
  const q = new QueryCounter();
  const now = Date.now();
  const ctx = await loadCuriosityContext(db, userId, q, now);

  const decision = decideCuriosity({
    curiosity: ctx.state.curiosity,
    energy: ctx.state.energy,
    gaps: ctx.gaps,
    lastQuestionAt: ctx.lastQuestionAt,
    openQuestion: ctx.openQuestion !== null,
    now,
  });

  // Proactive Intent: eigener Impuls aus erkannten Lücken im Spiderweb.
  // Er ersetzt die bestehende Neugier-Entscheidung nicht, sondern wird ihr
  // vorgeschaltet und nutzt danach denselben Fragen- und Antwortpfad.
  const impulseDecision = decideImpulse({
    gaps: ctx.detectedGaps,
    curiosity: ctx.state.curiosity,
    conversationTopics: ctx.conversationTopics,
    recentUserTexts: ctx.recentUserTexts,
    previousImpulses: ctx.questions.map((row) => row.question),
    knownAnswers: ctx.memories.map((m) => m.content),
    openQuestion: ctx.openQuestion !== null,
    lastImpulseAt: ctx.lastQuestionAt,
    now,
  });
  const impulse = impulseDecision.action === "SPEAK" ? impulseDecision.impulse : null;

  // Endgültige Freigabe: Energie ist eine gemeinsame Ressource. Ein Impuls darf
  // eine aktive Energiesperre nicht überstimmen. Die Prüfung liegt VOR der
  // Formulierung – eine nicht gestellte Frage kostet weder Energie noch Neugier
  // und erzeugt weder Question- noch Message-Datensatz.
  const gateDecision = finalAutonomyGate({
    energy: ctx.state.energy,
    curiosity: decision,
    impulse: impulseDecision,
  });

  /** Ein Versuchsnachweis je Serveraufruf – zurückgegeben und einmal geloggt. */
  const attemptOf = (
    over: Partial<OrbAutonomyAttempt> & Pick<OrbAutonomyAttempt, "result" | "gate" | "reason">,
  ): OrbAutonomyAttempt => ({
    at: new Date(now).toISOString(),
    curiosityAction: decision.action,
    impulseAction: impulseDecision.action,
    energy: ctx.state.energy,
    curiosity: ctx.state.curiosity,
    score: impulse ? impulse.score : decision.score,
    source: gateDecision.source,
    duplicate: null,
    topic: impulse ? (impulse.gap.topic ?? null) : (decision.gap?.topic ?? null),
    ...over,
  });

  const silent = (reason: string, over?: Partial<OrbAutonomyAttempt>): OrbProactiveResult => {
    const attempt = attemptOf({
      result: "silent",
      gate: gateDecision.gate,
      reason,
      ...over,
    });
    // Genau eine Zeile je tatsächlichem Versuch – kein Takt-Logging.
    console.info("[orb.autonomy]", JSON.stringify({ userId, ...attempt }));
    return {
      asked: false,
      action: gateDecision.allowed
        ? "WAIT"
        : gateDecision.action === "ASK"
          ? "WAIT"
          : gateDecision.action,
      reason,
      question: null,
      topic: decision.gap?.topic ?? null,
      kind: decision.gap?.kind ?? null,
      score: decision.score,
      snapshot: null,
      perf: null,
      attempt,
    };
  };

  if (!gateDecision.allowed) return silent(gateDecision.reason);
  const gap = impulse ? gapFromImpulse(impulse, ctx) : decision.gap!;

  const impulseScoreValue = impulse ? impulse.score : decision.score;
  const impulseReason = impulse ? impulse.reason : decision.reason;

  const aiStart = Date.now();
  const spoken = await formulateQuestion(ctx, gap, impulse);
  const aiMs = Date.now() - aiStart;
  if (spoken.status !== "ok" || !spoken.question) {
    return silent("Sprachschicht nicht verfügbar – ORB bleibt still.", { gate: "formulation" });
  }

  // Semantische Duplikatprüfung gegen die eigenen früheren Fragen.
  if (
    isDuplicateQuestion(
      spoken.question,
      ctx.questions.map((row) => row.question),
    )
  ) {
    return silent("Diese Frage hat ORB in ähnlicher Form schon gestellt.", {
      gate: "duplicate",
      duplicate: true,
    });
  }

  const questionRow = await q.tick(
    db
      .from("orb_questions")
      .insert({
        user_id: userId,
        question: spoken.question,
        topic: gap.topic,
        knowledge_gap: gap.gap,
        gap_kind: gap.kind,
        source_memory_ids: [gap.nodeId],
        score: impulseScoreValue,
        reason: impulseReason,
        asked_at: new Date(now).toISOString(),
      })
      .select("id")
      .single(),
  );
  if (questionRow.error) throw new Error(questionRow.error.message);

  const msg = await q.tick(
    db.from("orb_messages").insert({
      user_id: userId,
      role: "orb",
      body: spoken.question,
      decision: "ask",
      state_snapshot: {
        ...ctx.state,
        proactive: true,
        explicit: options.explicit === true,
        scope: PROACTIVE_SCOPE,
        curiosity_scope: CURIOSITY_SCOPE,
        topic: gap.topic,
        gap_kind: gap.kind,
        knowledge_gap: gap.gap,
        score: impulseScoreValue,
        question_id: questionRow.data.id,
        impulse: impulse
          ? { type: impulse.gap.type, priority: impulse.priority, form: impulse.gap.form }
          : null,
        impulse_scope: IMPULSE_SCOPE,
      },
      created_at: new Date(now).toISOString(),
    }),
  );
  if (msg.error) throw new Error(msg.error.message);

  // Eine gestellte Frage senkt die Neugier leicht und kostet Energie.
  const stateUpdate = await q.tick(
    db
      .from("orb_state")
      .update({
        curiosity: Math.max(0, ctx.state.curiosity - 0.06),
        energy: Math.max(0, ctx.state.energy - 0.03),
      })
      .eq("user_id", userId),
  );
  if (stateUpdate.error) throw new Error(stateUpdate.error.message);

  const perf: OrbPerf = {
    retrievalMs: ctx.retrievalMs,
    relevanceMs: ctx.relevanceMs,
    aiMs,
    totalMs: Date.now() - startedAt,
    nodesLoaded: ctx.nodesLoaded,
    connectionsLoaded: ctx.connectionsLoaded,
    dbQueries: q.count,
  };
  await db.from("orb_metrics").insert({
    user_id: userId,
    kind: "proactive",
    retrieval_ms: perf.retrievalMs,
    relevance_ms: perf.relevanceMs,
    ai_ms: perf.aiMs,
    total_ms: perf.totalMs,
    nodes_loaded: perf.nodesLoaded,
    connections_loaded: perf.connectionsLoaded,
    db_queries: perf.dbQueries,
  });

  return {
    asked: true,
    action: "ASK",
    reason: impulseReason,
    question: spoken.question,
    topic: gap.topic,
    kind: gap.kind,
    score: impulseScoreValue,
    snapshot: await getSnapshot(db, userId, perf),
    perf,
  };
}

/**
 * Antwort auf eine eigene Frage erkennen und daraus lernen. Die Frage wird
 * geschlossen, die auslösende Erinnerung verstärkt und mit der Antwort
 * verbunden. Nichts wird gelöscht.
 */
/**
 * Sucht die letzte eigene Frage, die noch offen ist und im Antwortfenster
 * liegt. Nur lesend – daraus entsteht die Bewertung „das ist eine Antwort“.
 */
async function findOpenQuestion(
  db: DB,
  userId: string,
  q: QueryCounter,
  now: number,
): Promise<QuestionRow | null> {
  const open = await q.tick(
    db
      .from("orb_questions")
      .select("*")
      .eq("user_id", userId)
      .eq("answered", false)
      .not("asked_at", "is", null)
      .order("asked_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  if (open.error) throw new Error(open.error.message);
  const row = open.data;
  if (!row || !row.asked_at) return null;
  if (now - new Date(row.asked_at).getTime() > ANSWER_WINDOW_MS) return null;
  return row;
}

async function closeOpenQuestion(
  db: DB,
  userId: string,
  input: { answerText: string; answerNodeId: string | null; importance: number },
  row: QuestionRow,
  q: QueryCounter,
  now: number,
): Promise<{ question: string; topic: string | null } | null> {
  const update = await q.tick(
    db
      .from("orb_questions")
      .update({
        answered: true,
        answer_received: input.answerText.slice(0, MAX_INPUT_CHARS),
        answered_at: new Date(now).toISOString(),
      })
      .eq("id", row.id)
      .eq("user_id", userId),
  );
  if (update.error) throw new Error(update.error.message);

  // Die Antwort verknüpft sich mit der Erinnerung, aus der die Frage entstand.
  const sourceId = row.source_memory_ids[0] ?? null;
  if (sourceId && input.answerNodeId) {
    await touchConnection(
      db,
      userId,
      sourceId,
      input.answerNodeId,
      {
        delta: reinforcement(Math.max(0.6, input.importance)),
        importance: Math.max(0.6, input.importance),
        decayRate: 0.02,
        origin: "curiosity_answer",
      },
      q,
      now,
    );
  }
  if (row.topic) {
    await upsertInterest(db, userId, row.topic, "user_stated", Math.max(0.6, input.importance), q);
  }

  return { question: row.question, topic: row.topic };
}

/** Ausdrückliche Aufforderung („frag mich“) – läuft durch dieselbe Prüfung. */
export async function requestQuestion(db: DB, userId: string): Promise<OrbProactiveResult> {
  return askProactively(db, userId, { explicit: true });
}

export { isAskMeRequest };
