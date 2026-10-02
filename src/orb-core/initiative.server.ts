/**
 * ORB Core – Einbindung der erweiterten Initiative (Category-Curiosity,
 * einmaliges Follow-up). Getrennt von engine.server.ts, damit der bestehende
 * Gap-/Impuls-Pfad unverändert bleibt. Wird nur aufgerufen, wenn das
 * bestehende Autonomie-Gate „no_candidate“ meldet.
 */

import type * as Engine from "@/orb-core/engine.server";
import { internalError } from "@/orb-core/internal-error";
import type {
  CuriosityContext,
  DB,
  OrbPerf,
  OrbProactiveResult,
  QueryCounter,
} from "@/orb-core/engine.server";
import type { OrbAutonomyAttempt } from "@/orb-core/autonomy";
import { finalAutonomyGate } from "@/orb-core/autonomy";
import {
  decideCuriosity,
  isDuplicateQuestion,
  type KnowledgeGap,
} from "@/orb-core/curiosity";
import type { decideImpulse } from "@/orb-core/impulse";
import { orbBuildId, scopeCheckOf } from "@/orb-core/decision-trace";
import { scopeOf } from "@/orb-core/scope";
import { PROACTIVE_SCOPE } from "@/orb-core/presence";
import { topicsOf } from "@/orb-core/memory";
import { logEventSummary, type OrbEventContext } from "@/orb-core/observability.server";
import {
  CATEGORY_KIND_PREFIX,
  CATEGORY_LABEL,
  FOLLOW_UP_KIND,
  categoryAsGap,
  decideFollowUp,
  deriveCategoryCandidates,
  followUpAsGap,
  followUpText,
  type AutonomousQuestionType,
} from "@/orb-core/initiative";

/* ------------------------------------------- Erweiterte autonome Initiative */

/**
 * Category-Curiosity (3) und einmaliges Follow-up (4). Läuft nur, wenn der
 * bestehende Pfad keinen Kandidaten hatte. Jeder Kandidat durchläuft
 * unverändert `decideCuriosity` (Neugier, Energie, offene Frage, Cooldown,
 * Schwelle) und `finalAutonomyGate` – VOR jedem Modellaufruf.
 * Kein Kandidat → null (ORB bleibt still).
 */
export async function tryExtendedInitiative(input: {
  db: DB;
  userId: string;
  ctx: CuriosityContext;
  q: QueryCounter;
  now: number;
  obs: OrbEventContext;
  startedAt: number;
  explicit: boolean;
  impulseDecision: ReturnType<typeof decideImpulse>;
  answerWindowMs: number;
  speak: typeof Engine.speak;
  getSnapshot: typeof Engine.getSnapshot;
}): Promise<OrbProactiveResult | null> {
  const { db, userId, ctx, q, now, obs, speak, getSnapshot } = input;

  const gateFor = (gap: KnowledgeGap) => {
    const decision = decideCuriosity({
      curiosity: ctx.state.curiosity,
      energy: ctx.state.energy,
      gaps: [gap],
      lastQuestionAt: ctx.lastQuestionAt,
      openQuestion: ctx.openQuestion !== null,
      now,
    });
    return finalAutonomyGate({
      energy: ctx.state.energy,
      curiosity: decision,
      impulse: input.impulseDecision,
    });
  };

  let type: AutonomousQuestionType | null = null;
  let gap: KnowledgeGap | null = null;
  let gapKind = "";
  let question: string | null = null;
  let aiMs = 0;
  let provenance: Record<string, string> = {};

  // 3. Category-Curiosity
  const categories = deriveCategoryCandidates({
    memories: ctx.memories,
    askedKinds: ctx.questions.map((r) => r.gap_kind),
    conversationTopics: ctx.conversationTopics,
    curiosity: ctx.state.curiosity,
    now,
  });
  const cat = categories[0] ?? null;
  if (cat && gateFor(categoryAsGap(cat)).allowed) {
    const aiStart = Date.now();
    const spoken = await speak({
      text: [
        `Du möchtest aus eigener Neugier eine natürliche Anschlussfrage im Bereich „${CATEGORY_LABEL[cat.category]}“ stellen.`,
        `Ausgangspunkt (bekannte Angabe): „${cat.anchor.content}“.`,
        `Bereits bekannt – NICHT erneut erfragen: ${cat.known.map((k) => `„${k}“`).join("; ")}.`,
        "Formuliere genau eine kurze, lockere Frage auf Deutsch, die an den Ausgangspunkt anschliesst und etwas Neues innerhalb dieses Bereichs erfragt.",
        "Keine sensiblen persönlichen Themen, keine Begrüssung, keine Floskel.",
        "Begründe die Frage nicht mit früheren Aussagen, die oben nicht stehen.",
      ].join(" "),
      obs,
      state: ctx.state,
      goals: Array.isArray(ctx.stateRow.goals) ? (ctx.stateRow.goals as string[]) : ["help_user"],
      decision: "ask",
      recalled: cat.known.slice(0, 5),
      interests: ctx.interests,
    });
    aiMs = Date.now() - aiStart;
    const text = spoken.status === "ok" ? spoken.reply.trim().slice(0, 600) : "";
    const previous = ctx.questions.map((r) => r.question);
    if (text && !isDuplicateQuestion(text, previous) && !isDuplicateQuestion(text, cat.known)) {
      type = "category_curiosity";
      gap = categoryAsGap(cat);
      gapKind = `${CATEGORY_KIND_PREFIX}${cat.category}`;
      question = text;
      provenance = { category: cat.category, anchor_node_id: cat.anchor.id };
    }
  }

  // 4. Einmaliges Follow-up (nur wenn keine Kategorie-Frage entstand; kein Modellaufruf)
  if (!question) {
    const fu = decideFollowUp({
      questions: ctx.questions,
      recentMessages: ctx.recentMessages,
      answerWindowMs: input.answerWindowMs,
      now,
      topicsOf,
    });
    if (fu.eligible) {
      const fuGap = followUpAsGap(fu.row);
      if (gateFor(fuGap).allowed) {
        type = "follow_up";
        gap = fuGap;
        gapKind = FOLLOW_UP_KIND;
        question = followUpText(fu.row.question);
        provenance = { follow_up_of: fu.row.id };
      }
    }
  }

  if (!question || !gap || !type) return null;

  const questionRow = await q.tick(
    db
      .from("orb_questions")
      .insert({
        user_id: userId,
        question,
        topic: gap.topic || null,
        knowledge_gap: gap.gap,
        gap_kind: gapKind,
        source_memory_ids: gap.nodeId ? [gap.nodeId] : [],
        score: gap.score,
        reason: gap.reason,
        asked_at: new Date(now).toISOString(),
      })
      .select("id")
      .single(),
  );
  if (questionRow.error) throw internalError(questionRow.error);

  const msg = await q.tick(
    db.from("orb_messages").insert({
      user_id: userId,
      role: "orb",
      body: question,
      decision: "ask",
      state_snapshot: {
        ...ctx.state,
        proactive: true,
        explicit: input.explicit,
        // Deklarierte Beschriftung (kein Prüfergebnis); Prüfung: `scope_check`.
        declared_scope: PROACTIVE_SCOPE,
        build_id: orbBuildId(),
        scope_check: scopeCheckOf({
          declaredAllowed: "orb_core",
          runtimeScope: scopeOf(db),
          explicit: input.explicit,
        }),
        topic: gap.topic,
        gap_kind: gapKind,
        knowledge_gap: gap.gap,
        score: gap.score,
        question_id: questionRow.data.id,
        initiative_type: type,
        initiative_provenance: provenance,
        impulse: null,
      },
      created_at: new Date(now).toISOString(),
    }),
  );
  if (msg.error) {
    await db.from("orb_questions").delete().eq("id", questionRow.data.id).eq("user_id", userId);
    throw internalError(msg.error);
  }

  // Identische Kosten wie jede eigene Frage (Energy-System unverändert).
  const stateUpdate = await q.tick(
    db
      .from("orb_state")
      .update({
        curiosity: Math.max(0, ctx.state.curiosity - 0.06),
        energy: Math.max(0, ctx.state.energy - 0.03),
      })
      .eq("user_id", userId),
  );
  if (stateUpdate.error) throw internalError(stateUpdate.error);

  const perf: OrbPerf = {
    retrievalMs: ctx.retrievalMs,
    relevanceMs: ctx.relevanceMs,
    aiMs,
    totalMs: Date.now() - input.startedAt,
    nodesLoaded: ctx.nodesLoaded,
    connectionsLoaded: ctx.connectionsLoaded,
    dbQueries: q.count,
  };
  const attempt: OrbAutonomyAttempt = {
    at: new Date(now).toISOString(),
    side: "server",
    result: "asked",
    curiosityAction: "ASK",
    impulseAction: input.impulseDecision.action,
    gate: "pass",
    reason: gap.reason,
    energy: ctx.state.energy,
    curiosity: ctx.state.curiosity,
    score: gap.score,
    source: "curiosity",
    duplicate: false,
    topic: gap.topic || null,
  };
  console.info("[orb.autonomy]", JSON.stringify({ userId, ...attempt, initiative: type }));
  logEventSummary({
    ctx: obs,
    outcome: `asked:${type}`,
    dbQueries: q.count,
    totalMs: perf.totalMs,
  });

  return {
    asked: true,
    action: "ASK",
    reason: gap.reason,
    question,
    topic: gap.topic || null,
    kind: null,
    score: gap.score,
    snapshot: await getSnapshot(db, userId, perf),
    perf,
    attempt,
  };
}
