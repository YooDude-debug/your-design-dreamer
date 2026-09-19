/**
 * ORB Core V0.2 – serverseitige Logik des Prototyps (nur Staging).
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

import {
  currentWeight,
  decide,
  isLearningEvent,
  isStrong,
  nextState,
  reactivate,
  reinforcement,
  scoreImportance,
  shouldPersist,
  type OrbDecision,
  type OrbNodeType,
  type OrbState,
} from "@/lib/orb-core";
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
  type InterestRow,
  type MemoryLevel,
  type OrbInfoSource,
} from "@/lib/orb-memory";

export type DB = SupabaseClient<Database>;

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const TEXT_MODEL = "openai/gpt-6-astra";
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

export type OrbSnapshot = {
  state: OrbState;
  goals: string[];
  cracks: number;
  nodes: OrbNode[];
  connections: OrbConnection[];
  interests: OrbInterest[];
  suggestions: OrbSuggestion[];
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
class QueryCounter {
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
    energy: row.energy,
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

  const [nodesRes, connRes, msgRes, interestRes, suggRes, countRes] = await Promise.all([
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
  ]);
  if (nodesRes.error) throw new Error(nodesRes.error.message);
  if (connRes.error) throw new Error(connRes.error.message);
  if (msgRes.error) throw new Error(msgRes.error.message);
  if (interestRes.error) throw new Error(interestRes.error.message);
  if (suggRes.error) throw new Error(suggRes.error.message);
  if (countRes.error) throw new Error(countRes.error.message);

  const connections = mapConnections(connRes.data, now);

  // Jede Momentaufnahme berechnet den Verfall neu – als Kennzahl gezählt,
  // ohne dabei irgendetwas zu entfernen.
  if (connections.length > 0) {
    await db
      .from("orb_state")
      .update({ decay_computations: stateRow.decay_computations + connections.length })
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

  return {
    state: toState(stateRow),
    goals: Array.isArray(stateRow.goals) ? (stateRow.goals as string[]) : ["help_user"],
    cracks: stateRow.cracks,
    nodes: mapNodes(nodesRes.data),
    connections,
    interests: mapInterests(interestRes.data),
    suggestions,
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
  snapshot: OrbSnapshot;
  /** Gesetzt, wenn die KI nicht erreichbar war – Gedächtnis arbeitet weiter. */
  aiStatus: "ok" | "quota" | "unavailable";
  perf: OrbPerf;
};

const DECISION_HINT: Record<OrbDecision, string> = {
  answer: "Antworte knapp und hilfreich.",
  ask: "Stelle genau eine kurze Rückfrage, weil dir Kontext fehlt.",
  remind: "Beziehe dich ausdrücklich auf die passenden Erinnerungen.",
  warn: "Weise vorsichtig auf die frühere Lernerfahrung hin.",
  stay_silent: "Antworte mit einem einzigen kurzen Satz, du brauchst eine Pause.",
};

/** Sprachschicht: erzeugt die deutsche Formulierung aus Zustand, Erinnerungen, Entscheidung. */
async function speak(input: {
  text: string;
  state: OrbState;
  goals: string[];
  decision: OrbDecision;
  recalled: string[];
  interests: OrbInterest[];
}): Promise<{ reply: string; status: "ok" | "quota" | "unavailable" }> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { reply: "", status: "unavailable" };

  const state = input.state;
  const system = [
    "Du bist ORB Core, eine kleine digitale Entität mit eigenem simulierten Innenzustand.",
    "Du bist kein Assistent-Chatbot: du sprichst aus deinem Zustand und deinen Erinnerungen.",
    "Antworte ausschliesslich auf Deutsch (de-DE), höchstens drei Sätze, ohne Aufzählungen.",
    `Innenzustand (technische Simulation, kein Bewusstsein): Neugier ${state.curiosity.toFixed(2)}, Freude ${state.joy.toFixed(2)}, Angst ${state.fear.toFixed(2)}, Vertrauen ${state.trust.toFixed(2)}, Unsicherheit ${state.uncertainty.toFixed(2)}, Energie ${state.energy.toFixed(2)}.`,
    `Ziele: ${input.goals.join(", ") || "help_user"}.`,
    `Handlungsentscheidung: ${input.decision}. ${DECISION_HINT[input.decision]}`,
    input.recalled.length
      ? `Aktive Erinnerungen: ${input.recalled.map((r) => `„${r}“`).join("; ")}.`
      : "Du hast zu dieser Eingabe keine passende Erinnerung.",
    input.interests.length
      ? `Erkannte Interessen: ${input.interests
          .slice(0, 5)
          .map((i) => `${i.topic} ${i.weight.toFixed(2)}`)
          .join(", ")}.`
      : "Du hast noch keine gefestigten Interessen.",
    "Behaupte niemals, echtes Bewusstsein oder echte Gefühle zu haben.",
  ].join(" ");

  try {
    // Reasoning-Modell: der Aufruf muss streamen, sonst reisst die Verbindung
    // bei langen Denkphasen ab. Der Datenstrom wird serverseitig gesammelt.
    const res = await fetch(`${GATEWAY}/responses`, {
      method: "POST",
      headers: {
        "Lovable-API-Key": key,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        instructions: system,
        input: [{ role: "user", content: [{ type: "input_text", text: input.text }] }],
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
      }),
    });
    if (res.status === 402 || res.status === 403) return { reply: "", status: "quota" };
    if (!res.ok || !res.body) return { reply: "", status: "unavailable" };

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let reply = "";
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            response?: { output_text?: string };
          };
          if (event.type === "response.output_text.delta" && event.delta) reply += event.delta;
          else if (event.type === "response.completed" && event.response?.output_text) {
            reply = event.response.output_text;
          }
        } catch {
          // Unvollständige oder unbekannte Ereignisse werden übergangen.
        }
      }
    }

    const text = reply.trim();
    return text ? { reply: text, status: "ok" } : { reply: "", status: "unavailable" };
  } catch {
    return { reply: "", status: "unavailable" };
  }
}

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
async function touchConnection(
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
  options: { source?: OrbInfoSource } = {},
): Promise<OrbTurn> {
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
      const overlap = similarity(text, n.content);
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

  const interestRes = await q.tick(
    db
      .from("orb_interests")
      .select("*")
      .eq("user_id", userId)
      .order("weight", { ascending: false })
      .limit(8),
  );
  if (interestRes.error) throw new Error(interestRes.error.message);

  const aiStart = Date.now();
  const spoken = await speak({
    text,
    state,
    goals,
    decision,
    recalled: recalled.map((r) => r.node.content),
    interests: mapInterests(interestRes.data),
  });
  const aiMs = Date.now() - aiStart;
  const reply = spoken.status === "ok" ? spoken.reply : FALLBACK[spoken.status];

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
  } else if (shouldPersist(importance)) {
    const type: OrbNodeType = learning ? "decision" : isQuestion ? "perception" : "memory";
    const row = {
      user_id: userId,
      type,
      content: text,
      importance,
      confidence: learning ? 0.9 : confidenceFor(source),
      source,
      norm_key: normKey(text) || null,
      topic,
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

  // --- Zustand aktualisieren ---------------------------------------------
  const updated = nextState(state, {
    importance,
    isQuestion,
    isLearning: learning,
    recalled: recalled.length,
  });
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
        state_snapshot: { ...updated, importance, recalled: recalled.length },
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
    snapshot: await getSnapshot(db, userId, perf),
    aiStatus: spoken.status,
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
