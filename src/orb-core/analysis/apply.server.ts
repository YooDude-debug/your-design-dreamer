/**
 * ORB Core – Kontextanalyse anwenden (serverseitig, innerhalb der Core-Grenze).
 *
 * Ablauf: verfügbarer Gesprächskontext → Analyse (KI) → Kandidaten →
 * Validierung/Deduplizierung → Spiderweb (Knoten, Beziehungen, Historie).
 *
 * Grundsätze:
 *  - Hintergrundprozess: erzeugt keine sichtbare Chat-Reaktion.
 *  - Die bestehenden Formeln (Wichtigkeit, Schwelle 0.35, Relevanz, Verfall,
 *    Reaktivierung) werden nicht verändert.
 *  - VERGESSEN ≠ LÖSCHEN: nichts wird entfernt, nur Gewicht und Stufe sinken.
 *  - Datenzugriff ausschliesslich über den angemeldeten Benutzer-Client (RLS).
 */

import { reinforcement, scoreImportance } from "@/orb-core/core";
import { QueryCounter, touchConnection, type DB } from "@/orb-core/engine.server";
import { normKey, topicOf } from "@/orb-core/memory";
import {
  analyzeContextWindow,
  estimateCostUsd,
  hasAnalysisCredentials,
  type AnalysisUsage,
} from "@/orb-core/analysis/analyze.server";
import type { OrbTemporalScope } from "@/orb-core/analysis/schema";
import { analysisRunColumns, logAnalysisRun } from "@/orb-core/observability.server";
import {
  lifecycleFor,
  userSignalsFrom,
  validateCandidates,
  type CandidateDecision,
  type ExistingNode,
  type Lifecycle,
  type ValidatedCandidate,
} from "@/orb-core/analysis/validate";

/** Wie viele Nachrichten die Analyse betrachtet (mehr als das Chatfenster). */
export const ANALYSIS_TRANSCRIPT_MESSAGES = 24;
/** Wie viele bestehende Erinnerungen verglichen werden. */
export const ANALYSIS_NODE_LIMIT = 40;
/** Mindestabstand zwischen zwei Analysen desselben Benutzers. */
export const ANALYSIS_MIN_INTERVAL_MS = 45_000;

/**
 * Nachvollziehbarkeit je Kandidat: getrennt bleiben
 * A) Vorschlag der KI, B) Werte des deterministischen Validators,
 * C) Werte, die tatsächlich im Spiderweb landen (null = nichts gespeichert).
 * Rein analytisch, nur im Speicher – keine zusätzliche Datenstruktur.
 */
export type CandidateValues = {
  relevance: number;
  longTermValue: number;
  confidence: number;
};

export type CandidateTrace = {
  key: string;
  decision: CandidateDecision;
  reason: string;
  proposed: CandidateValues;
  accepted: CandidateValues;
  stored: CandidateValues | null;
  nodeId: string | null;
};

export type AnalysisReport = {
  ran: boolean;
  skippedReason: "throttled" | "no_key" | "no_messages" | null;
  failure: string | null;
  candidatesDetected: number;
  candidatesRejected: number;
  memoriesCreated: number;
  memoriesUpdated: number;
  memoriesReinforced: number;
  memoriesDecayed: number;
  contradictions: number;
  analysisMs: number;
  totalMs: number;
  tokens: AnalysisUsage;
  costUsdEstimate: number;
  /** A/B/C-Trennung je Kandidat, nur zur Auswertung. */
  trace: CandidateTrace[];
};

const EMPTY_REPORT = (
  skippedReason: AnalysisReport["skippedReason"],
  totalMs: number,
): AnalysisReport => ({
  ran: false,
  skippedReason,
  failure: null,
  candidatesDetected: 0,
  candidatesRejected: 0,
  memoriesCreated: 0,
  memoriesUpdated: 0,
  memoriesReinforced: 0,
  memoriesDecayed: 0,
  contradictions: 0,
  analysisMs: 0,
  totalMs,
  tokens: { promptTokens: 0, completionTokens: 0 },
  costUsdEstimate: 0,
  trace: [],
});

const LIFECYCLE_ORDER: Lifecycle[] = ["active", "weak", "stale", "archived", "forgotten"];

/** Eine Stufe schwächer – niemals löschen, niemals überspringen. */
function weaken(current: Lifecycle): Lifecycle {
  const index = LIFECYCLE_ORDER.indexOf(current);
  return LIFECYCLE_ORDER[Math.min(LIFECYCLE_ORDER.length - 1, index + 1)]!;
}

/**
 * Hintergrundanalyse des verfügbaren Gesprächskontexts. Wirft nie: ein Fehler
 * darf den Chat nicht beeinträchtigen.
 */
export async function analyzeAndPersist(db: DB, userId: string): Promise<AnalysisReport> {
  const startedAt = Date.now();
  if (!hasAnalysisCredentials()) return EMPTY_REPORT("no_key", Date.now() - startedAt);

  const q = new QueryCounter();

  // Drosselung: nicht bei jeder Nachricht, sondern höchstens im festen Abstand.
  const lastRun = await q.tick(
    db
      .from("orb_metrics")
      .select("created_at")
      .eq("user_id", userId)
      .eq("kind", "analysis")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  if (
    lastRun.data?.created_at &&
    startedAt - new Date(lastRun.data.created_at).getTime() < ANALYSIS_MIN_INTERVAL_MS
  ) {
    return EMPTY_REPORT("throttled", Date.now() - startedAt);
  }

  const [messages, nodes] = await Promise.all([
    q.tick(
      db
        .from("orb_messages")
        .select("role, body, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(ANALYSIS_TRANSCRIPT_MESSAGES),
    ),
    q.tick(
      db
        .from("orb_nodes")
        .select(
          "id, content, norm_key, category, long_term_value, temporal_scope, lifecycle, importance, decay_rate, activation_count, created_at, last_accessed_at",
        )
        .eq("user_id", userId)
        .order("last_accessed_at", { ascending: false })
        .limit(ANALYSIS_NODE_LIMIT),
    ),
  ]);
  if (messages.error) return EMPTY_REPORT("no_messages", Date.now() - startedAt);

  const history = (messages.data ?? []).slice().reverse();
  if (history.length === 0) return EMPTY_REPORT("no_messages", Date.now() - startedAt);

  const nodeRows = nodes.data ?? [];
  const existing: ExistingNode[] = nodeRows.map((n) => ({
    id: n.id,
    content: n.content,
    normKey: n.norm_key,
    category: n.category,
    longTermValue: n.long_term_value,
    temporalScope: n.temporal_scope as OrbTemporalScope,
  }));

  const transcript = history
    .map((m) => `${m.role === "user" ? "Benutzer" : "ORB"}: ${m.body.slice(0, 400)}`)
    .join("\n");
  const signals = userSignalsFrom(history.filter((m) => m.role === "user").map((m) => m.body));

  const aiStart = Date.now();
  const analysis = await analyzeContextWindow({
    transcript,
    knownMemories: existing.map((e) => e.content),
    allowedNodeIds: existing.map((e) => e.id),
  });
  const analysisMs = Date.now() - aiStart;
  const analysisRun = {
    analysisRunId: crypto.randomUUID(),
    httpStatus: analysis.httpStatus,
    failureKind: analysis.failure,
    preSanitizeCount: analysis.preSanitizeCount,
    postSanitizeCount: analysis.candidates.length,
    durationMs: analysisMs,
  };
  logAnalysisRun(analysisRun);

  const validated = validateCandidates(analysis.candidates, existing, signals);

  const report: AnalysisReport = {
    ran: true,
    skippedReason: null,
    failure: analysis.failure,
    candidatesDetected: analysis.candidates.length,
    candidatesRejected: validated.filter((v) => v.decision === "rejected").length,
    memoriesCreated: 0,
    memoriesUpdated: 0,
    memoriesReinforced: 0,
    memoriesDecayed: 0,
    contradictions: validated.filter((v) => v.decision === "contradiction").length,
    analysisMs,
    totalMs: 0,
    tokens: analysis.usage,
    costUsdEstimate: estimateCostUsd(analysis.usage),
    trace: [],
  };

  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  for (const v of validated) {
    try {
      const nodeId = await applyOne(db, userId, v, {
        signals,
        rows: nodeRows,
        now,
        nowIso,
        q,
        report,
      });
      await q.tick(
        db.from("orb_candidates").insert({
          user_id: userId,
          key: v.candidate.key,
          value: v.candidate.value,
          category: v.candidate.category,
          relevance: v.relevance,
          long_term_value: v.longTermValue,
          confidence: v.confidence,
          temporal_scope: v.temporalScope,
          decay_rate: v.decayRate,
          source: v.candidate.source,
          source_reference: v.candidate.sourceReference || null,
          related_node_ids: v.candidate.relatedNodeIds,
          action: v.candidate.action,
          decision: v.decision,
          decision_reason: v.reason,
          node_id: nodeId,
        }),
      );
      report.trace.push({
        key: v.candidate.key,
        decision: v.decision,
        reason: v.reason,
        // A) Vorschlag der KI – niemals direkt gespeichert.
        proposed: {
          relevance: v.candidate.relevance,
          longTermValue: v.candidate.longTermValue,
          confidence: v.candidate.confidence,
        },
        // B) Werte des deterministischen Validators.
        accepted: {
          relevance: v.relevance,
          longTermValue: v.longTermValue,
          confidence: v.confidence,
        },
        // C) Tatsächlich im Spiderweb wirksame Werte.
        stored: nodeId
          ? { relevance: v.relevance, longTermValue: v.longTermValue, confidence: v.confidence }
          : null,
        nodeId,
      });
    } catch {
      // Ein einzelner Kandidat darf den Rest der Analyse nicht verhindern.
      report.candidatesRejected += 1;
    }
  }

  // Lebenszyklus fortschreiben: Zeitbezug und Ruhezeit bestimmen die Stufe.
  for (const row of nodeRows) {
    const next = lifecycleFor({
      temporalScope: row.temporal_scope as OrbTemporalScope,
      ageMs: now - new Date(row.created_at).getTime(),
      lastAccessedAgeMs: now - new Date(row.last_accessed_at).getTime(),
      forgotten: row.lifecycle === "forgotten",
    });
    if (next === row.lifecycle) continue;
    const res = await q.tick(
      db.from("orb_nodes").update({ lifecycle: next }).eq("id", row.id).eq("user_id", userId),
    );
    if (!res.error) report.memoriesDecayed += 1;
  }

  report.totalMs = Date.now() - startedAt;

  await q.tick(
    db.from("orb_metrics").insert({
      user_id: userId,
      kind: "analysis",
      ai_ms: report.analysisMs,
      total_ms: report.totalMs,
      retrieval_ms: 0,
      relevance_ms: 0,
      // Nur Zahlen, keine Inhalte.
      nodes_loaded: report.candidatesDetected,
      connections_loaded: report.memoriesCreated + report.memoriesUpdated,
      db_queries: q.count,
      // D2: dieselben technischen D1-Werte, dauerhaft.
      ...analysisRunColumns(analysisRun),
    }),
  );

  return report;
}

/** Einen geprüften Kandidaten anwenden. Liefert den betroffenen Knoten. */
async function applyOne(
  db: DB,
  userId: string,
  v: ValidatedCandidate,
  ctx: {
    signals: { forget: boolean };
    rows: {
      id: string;
      content: string;
      lifecycle: string;
      importance: number;
      activation_count: number;
      long_term_value: number;
    }[];
    now: number;
    nowIso: string;
    q: QueryCounter;
    report: AnalysisReport;
  },
): Promise<string | null> {
  const { q, report } = ctx;
  if (v.decision === "rejected") return null;

  const row = v.nodeId ? ctx.rows.find((r) => r.id === v.nodeId) : undefined;

  // Ausdrücklicher Vergessens-Wunsch: Stufe und Verfall ändern, nichts löschen.
  if (ctx.signals.forget && row) {
    const next = weaken(row.lifecycle as Lifecycle);
    const res = await q.tick(
      db
        .from("orb_nodes")
        .update({ lifecycle: next, decay_rate: Math.min(1, Math.max(0.3, v.decayRate)) })
        .eq("id", row.id)
        .eq("user_id", userId),
    );
    if (res.error) throw new Error(res.error.message);
    await q.tick(
      db.from("orb_node_history").insert({
        user_id: userId,
        node_id: row.id,
        reason: "forget",
        previous_value: row.content,
        new_value: row.content,
        previous_lifecycle: row.lifecycle as Lifecycle,
        new_lifecycle: next,
        metadata: { requested_by_user: true },
      }),
    );
    report.memoriesDecayed += 1;
    return row.id;
  }

  if (v.decision === "duplicate" && row) {
    const res = await q.tick(
      db
        .from("orb_nodes")
        .update({
          activation_count: row.activation_count + 1,
          last_accessed_at: ctx.nowIso,
          long_term_value: Math.max(row.long_term_value, v.longTermValue),
          lifecycle: "active",
        })
        .eq("id", row.id)
        .eq("user_id", userId),
    );
    if (res.error) throw new Error(res.error.message);
    await q.tick(
      db.from("orb_node_history").insert({
        user_id: userId,
        node_id: row.id,
        reason: "reinforcement",
        previous_value: row.content,
        new_value: row.content,
        previous_lifecycle: row.lifecycle as Lifecycle,
        new_lifecycle: "active",
        metadata: {},
      }),
    );
    report.memoriesReinforced += 1;
    return row.id;
  }

  // P5-PATCH-01: Das Modell wollte nur verstärken. Bei einem Treffer bleibt der
  // bestehende Knoten inhaltlich exakt erhalten – kein Content-/Feld-Overwrite.
  // Nur die wörtliche Action "reinforce"; unbekannte/normalisierte Actions und
  // create_or_update behalten den bisherigen Update-Pfad.
  if (
    (v.decision === "update" || v.decision === "contradiction") &&
    row &&
    v.candidate.action === "reinforce"
  ) {
    const res = await q.tick(
      db
        .from("orb_nodes")
        .update({
          activation_count: row.activation_count + 1,
          last_accessed_at: ctx.nowIso,
          lifecycle: "active",
        })
        .eq("id", row.id)
        .eq("user_id", userId),
    );
    if (res.error) throw new Error(res.error.message);
    await q.tick(
      db.from("orb_node_history").insert({
        user_id: userId,
        node_id: row.id,
        // DB-CHECK erlaubt nur 'reinforcement' (nicht 'reinforce').
        reason: "reinforcement",
        previous_value: row.content,
        new_value: row.content,
        previous_lifecycle: row.lifecycle as Lifecycle,
        new_lifecycle: "active",
        metadata: { action: "reinforce", suppressed_decision: v.decision },
      }),
    );
    report.memoriesReinforced += 1;
    return row.id;
  }


  if ((v.decision === "update" || v.decision === "contradiction") && row) {
    const res = await q.tick(
      db
        .from("orb_nodes")
        .update({
          content: v.candidate.value,
          category: v.candidate.category,
          confidence: v.confidence,
          long_term_value: v.longTermValue,
          temporal_scope: v.temporalScope,
          decay_rate: v.decayRate,
          lifecycle: "active",
          norm_key: normKey(v.candidate.value) || null,
          topic: topicOf(v.candidate.value),
          source_reference: v.candidate.sourceReference || null,
          activation_count: row.activation_count + 1,
          last_accessed_at: ctx.nowIso,
        })
        .eq("id", row.id)
        .eq("user_id", userId),
    );
    // Schlüsselkonflikt = Unsicherheit: der bestehende Knoten bleibt, wie er ist.
    if (res.error && res.error.code !== "23505") throw new Error(res.error.message);
    await q.tick(
      db.from("orb_node_history").insert({
        user_id: userId,
        node_id: row.id,
        reason: v.decision === "contradiction" ? "contradiction" : "update",
        previous_value: row.content,
        new_value: v.candidate.value,
        previous_lifecycle: row.lifecycle as Lifecycle,
        new_lifecycle: "active",
        metadata: { reason: v.reason },
      }),
    );
    report.memoriesUpdated += 1;
    return row.id;
  }

  if (v.decision !== "accepted") return null;

  // Neue Erinnerung. Wichtigkeit stammt weiterhin aus der bestehenden Formel;
  // der Langzeitwert kommt zusätzlich und ersetzt sie nicht.
  const importance = Math.min(
    1,
    Math.max(scoreImportance(v.candidate.value), v.longTermValue * 0.8),
  );
  const inserted = await q.tick(
    db
      .from("orb_nodes")
      .insert({
        user_id: userId,
        type: "memory",
        content: v.candidate.value,
        importance,
        confidence: v.confidence,
        // Aus dem Gespräch abgeleitet – ausdrücklich nicht als eigene Angabe.
        source: "inferred",
        norm_key: normKey(v.candidate.value) || null,
        topic: topicOf(v.candidate.value),
        category: v.candidate.category,
        long_term_value: v.longTermValue,
        temporal_scope: v.temporalScope,
        decay_rate: v.decayRate,
        lifecycle: "active",
        source_reference: v.candidate.sourceReference || null,
        activation_count: 1,
        metadata: { origin: "context_analysis", relevance: v.relevance },
      })
      .select("id")
      .single(),
  );
  if (inserted.error) {
    // Konflikt heisst: es gibt bereits etwas Gleichwertiges – nicht verdoppeln.
    if (inserted.error.code === "23505") return null;
    throw new Error(inserted.error.message);
  }
  const newId = inserted.data.id;
  report.memoriesCreated += 1;

  // Beziehungen über die bestehende Verbindungslogik knüpfen.
  for (const related of v.candidate.relatedNodeIds) {
    if (related === newId) continue;
    await touchConnection(
      db,
      userId,
      related,
      newId,
      {
        delta: reinforcement(importance),
        importance,
        decayRate: v.decayRate > 0 ? v.decayRate : 0.05,
        origin: "context_analysis",
      },
      q,
      ctx.now,
    );
  }
  return newId;
}
