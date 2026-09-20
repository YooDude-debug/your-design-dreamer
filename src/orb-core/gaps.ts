/**
 * ORB Core – Gap Detection (Proactive Intent), reine Logik.
 *
 * Diese Datei enthält KEINE Datenbank- und keine Netzwerkzugriffe und ruft
 * keine KI auf. Sie beantwortet aus bereits geladenen Knoten, Verbindungen
 * und dem laufenden Gesprächskontext genau eine Frage:
 *
 *   „Gibt es im vorhandenen Wissen eine Lücke mit echter künftiger Relevanz?“
 *
 * Grundsatz: nicht jede fehlende Information ist eine Lücke. Es entstehen nur
 * Lücken mit benennbarem Grund, ausreichender Sicherheit und Ablaufzeit.
 *
 * Bestehende Formeln (Schwelle 0.35, Wichtigkeit, Relevanz, Verfall) werden
 * NICHT verändert; hier wird ausschliesslich gelesen und bewertet.
 */

import { clamp01 } from "@/orb-core/core";
import { contentTokens, similarity } from "@/orb-core/memory";

/* ------------------------------------------------------------------- Typen */

export const GAP_TYPES = [
  "missing_information",
  "unresolved_question",
  "ambiguous_preference",
  "incomplete_goal",
  "incomplete_project",
  "missing_context",
  "contradiction",
  "outdated_information",
  "pending_decision",
  "repeated_topic",
  "potential_relationship",
] as const;

export type GapType = (typeof GAP_TYPES)[number];

/** Zeitliche Reichweite einer Information (bestehende Analysestruktur). */
export type TemporalScope = "temporary" | "medium" | "long_term" | "permanent";

/** Knoten, wie er aus dem Spiderweb geladen vorliegt (Lesesicht). */
export type GapNode = {
  id: string;
  content: string;
  topic: string | null;
  importance: number;
  confidence: number;
  /** Aus der bestehenden Analysestruktur, falls vorhanden. */
  longTermValue?: number | null;
  temporalScope?: TemporalScope | null;
  category?: string | null;
  activationCount: number;
  /** Zeitstempel in ms. */
  lastAccessedAt: number;
};

/** Verbindung zwischen zwei Knoten (Lesesicht). */
export type GapConnection = { sourceNodeId: string; targetNodeId: string; weight: number };

export type DetectedGap = {
  id: string;
  type: GapType;
  importance: number;
  confidence: number;
  relatedNodes: string[];
  reason: string;
  suggestedQuestion: string;
  /** Form des Impulses: echte Frage oder reine Beobachtung. */
  form: "question" | "observation";
  topic: string | null;
  /** Zeitpunkt (ms), ab dem die Lücke nicht mehr berücksichtigt wird. */
  expiresAt: number;
  /** Bewertung der künftigen Bedeutung (0..1). */
  futureRelevance: number;
};

/* --------------------------------------------------------------- Textmuster */

const PROJECT_RE = /\b(projekt|app|plattform|baue|entwickle|arbeite an|starte)\b/i;
const GOAL_RE = /\b(ziel|erreichen|vorhaben|langfristig|plan für|möchte .* werden)\b/i;
const DECISION_RE = /(entscheiden|entscheidung|überleg\w*|schwanke|oder doch|welche(s|n)? soll)/i;
const VAGUE_RE = /\b(vielleicht|eventuell|irgendwie|mal sehen|weiss nicht|weiß nicht|unsicher)\b/i;
const NEGATION_RE = /\b(nicht|kein|keine|keinen|niemals)\b/i;
const PREFERENCE_RE = /\b(mag|liebe|lieblings\w*|bevorzuge|hasse|gern|gerne)\b/i;

/** Wie lange eine erkannte Lücke gültig bleibt – je Reichweite unterschiedlich. */
export const GAP_TTL_MS: Record<TemporalScope, number> = {
  temporary: 6 * 60 * 60_000,
  medium: 7 * 24 * 60 * 60_000,
  long_term: 60 * 24 * 60 * 60_000,
  permanent: 180 * 24 * 60 * 60_000,
};

/** Ab dieser Ruhezeit gilt eine kurzlebige Information als veraltet. */
export const OUTDATED_AFTER_MS = 45 * 24 * 60 * 60_000;

/** Ohne diese Mindestsicherheit entsteht aus einem Knoten keine Lücke. */
export const GAP_MIN_CONFIDENCE = 0.55;

/** Ab dieser Häufigkeit gilt ein Thema als wiederkehrend. */
export const REPEATED_TOPIC_MIN = 3;

/** Ab dieser inhaltlichen Nähe ist eine Verbindung zweier Themen erkennbar. */
export const RELATIONSHIP_SIMILARITY = 0.35;

function scopeOf(node: GapNode): TemporalScope {
  return node.temporalScope ?? "medium";
}

/** Künftige Bedeutung aus vorhandenen Werten – keine neue Formel für Speicherung. */
function futureRelevanceOf(node: GapNode): number {
  const scope = scopeOf(node);
  const scopeWeight =
    scope === "permanent" ? 1 : scope === "long_term" ? 0.9 : scope === "medium" ? 0.6 : 0.3;
  const longTerm = node.longTermValue ?? node.importance;
  return clamp01(scopeWeight * (0.4 + 0.6 * clamp01(longTerm)));
}

function short(text: string, max = 80): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/* ------------------------------------------------------------- Lückensuche */

export type GapDetectionInput = {
  nodes: GapNode[];
  connections: GapConnection[];
  /** Themen der letzten Nachrichten (laufendes Gespräch). */
  conversationTopics?: string[];
  now: number;
};

/**
 * Sucht Lücken im vorhandenen Wissen. Rein rechnend, ohne KI und ohne
 * Spekulation: jede Lücke nennt ihre auslösenden Knoten und ihren Grund.
 */
export function detectGaps(input: GapDetectionInput): DetectedGap[] {
  const { nodes, connections, now } = input;
  const topics = new Set((input.conversationTopics ?? []).filter(Boolean));
  const gaps: DetectedGap[] = [];

  const neighbours = new Map<string, string[]>();
  for (const c of connections) {
    if (c.weight <= 0) continue;
    neighbours.set(c.sourceNodeId, [...(neighbours.get(c.sourceNodeId) ?? []), c.targetNodeId]);
    neighbours.set(c.targetNodeId, [...(neighbours.get(c.targetNodeId) ?? []), c.sourceNodeId]);
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const add = (
    node: GapNode,
    type: GapType,
    reason: string,
    question: string,
    extra: { related?: string[]; form?: "question" | "observation"; importance?: number } = {},
  ) => {
    gaps.push({
      id: `${node.id}:${type}`,
      type,
      importance: clamp01(extra.importance ?? node.importance),
      confidence: clamp01(node.confidence),
      relatedNodes: extra.related ?? [node.id],
      reason,
      suggestedQuestion: question,
      form: extra.form ?? "question",
      topic: node.topic,
      expiresAt: now + GAP_TTL_MS[scopeOf(node)],
      futureRelevance: futureRelevanceOf(node),
    });
  };

  // Themenhäufigkeit – Grundlage für wiederkehrende Themen.
  const topicCount = new Map<string, number>();
  for (const n of nodes) {
    if (n.topic) topicCount.set(n.topic, (topicCount.get(n.topic) ?? 0) + 1);
  }

  for (const node of nodes) {
    if (node.confidence < GAP_MIN_CONFIDENCE) continue;
    if (contentTokens(node.content).length === 0) continue;

    const linked = (neighbours.get(node.id) ?? [])
      .map((id) => byId.get(id))
      .filter((n): n is GapNode => Boolean(n));
    const linkedText = linked.map((n) => n.content).join(" ");
    const isProject = PROJECT_RE.test(node.content) || node.category === "project";
    const isGoal = GOAL_RE.test(node.content) || node.category === "goal";

    // Projekt ohne erkennbares Ziel.
    if (isProject && !isGoal && !GOAL_RE.test(linkedText)) {
      add(
        node,
        "incomplete_project",
        `Vorhaben „${short(node.content)}“ ist bekannt, ein Ziel dazu fehlt.`,
        `Was möchtest du mit „${short(node.content, 40)}“ langfristig erreichen?`,
      );
    }

    // Ziel ohne erkennbaren Umsetzungsbezug.
    if (isGoal && !isProject && linked.length === 0) {
      add(
        node,
        "incomplete_goal",
        `Das Ziel „${short(node.content)}“ steht ohne Bezug im Wissen.`,
        `Woran möchtest du „${short(node.content, 40)}“ konkret festmachen?`,
      );
    }

    // Offene Entscheidung.
    if (DECISION_RE.test(node.content)) {
      add(
        node,
        "pending_decision",
        `Zu „${short(node.content)}“ ist eine Entscheidung offen.`,
        `Bei „${short(node.content, 40)}“ – welche Angabe fehlt dir für die Entscheidung noch?`,
      );
    }

    // Unklare Vorliebe.
    if (PREFERENCE_RE.test(node.content) && VAGUE_RE.test(node.content)) {
      add(
        node,
        "ambiguous_preference",
        `Die Vorliebe in „${short(node.content)}“ ist noch nicht eindeutig.`,
        `Was davon ist dir bei „${short(node.content, 40)}“ tatsächlich lieber?`,
      );
    }

    // Offene Rückfrage, die im Wissen liegen blieb.
    if (node.content.trim().endsWith("?")) {
      add(
        node,
        "unresolved_question",
        `„${short(node.content)}“ blieb ohne Antwort.`,
        `Eine Sache ist offen geblieben: ${short(node.content, 60)}`,
      );
    }

    // Sehr knappe, aber wichtige Angabe ohne Umfeld.
    if (contentTokens(node.content).length <= 2 && node.importance >= 0.5) {
      add(
        node,
        "missing_context",
        `„${short(node.content)}“ ist wichtig, aber ohne Zusammenhang gespeichert.`,
        `In welchem Zusammenhang steht „${short(node.content, 40)}“ bei dir?`,
      );
    }

    // Wichtige Angabe, die im Wissen allein steht.
    if (linked.length === 0 && node.importance >= 0.6 && !isProject && !isGoal) {
      add(
        node,
        "missing_information",
        `„${short(node.content)}“ ist wichtig, aber mit nichts verknüpft.`,
        `Zu „${short(node.content, 40)}“ fehlt mir noch eine Angabe – worauf bezieht sich das?`,
      );
    }

    // Kurzlebige Angabe, die lange nicht mehr berührt wurde.
    if (scopeOf(node) === "temporary" && now - node.lastAccessedAt > OUTDATED_AFTER_MS) {
      add(
        node,
        "outdated_information",
        `„${short(node.content)}“ ist länger unberührt und könnte überholt sein.`,
        `Gilt „${short(node.content, 40)}“ bei dir noch?`,
      );
    }

    // Wiederkehrendes Thema – Beobachtung, keine Frage.
    if (node.topic && (topicCount.get(node.topic) ?? 0) >= REPEATED_TOPIC_MIN) {
      add(
        node,
        "repeated_topic",
        `Das Thema „${node.topic}“ taucht mehrfach auf.`,
        `Das Thema „${node.topic}“ kommt bei dir an mehreren Stellen vor.`,
        { form: "observation" },
      );
    }
  }

  // Widerspruch: gleiches Thema, gegenteilige Aussage.
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      if (!a || !b || !a.topic || a.topic !== b.topic) continue;
      if (a.confidence < GAP_MIN_CONFIDENCE || b.confidence < GAP_MIN_CONFIDENCE) continue;
      const opposite = NEGATION_RE.test(a.content) !== NEGATION_RE.test(b.content);
      if (opposite && similarity(a.content, b.content) >= 0.3) {
        gaps.push({
          id: `${a.id}:${b.id}:contradiction`,
          type: "contradiction",
          importance: clamp01(Math.max(a.importance, b.importance)),
          confidence: clamp01(Math.min(a.confidence, b.confidence)),
          relatedNodes: [a.id, b.id],
          reason: `„${short(a.content)}“ und „${short(b.content)}“ widersprechen sich.`,
          suggestedQuestion: `Zwei Angaben passen bei mir nicht zusammen: „${short(a.content, 40)}“ und „${short(b.content, 40)}“ – was gilt?`,
          form: "question",
          topic: a.topic,
          expiresAt: now + GAP_TTL_MS[scopeOf(a)],
          futureRelevance: Math.max(futureRelevanceOf(a), futureRelevanceOf(b)),
        });
      }
    }
  }

  // Mögliche Verbindung über Themengrenzen – Beobachtung, keine Frage.
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      if (!a || !b) continue;
      if (a.topic && b.topic && a.topic === b.topic) continue;
      const alreadyLinked = (neighbours.get(a.id) ?? []).includes(b.id);
      if (alreadyLinked) continue;
      if (similarity(a.content, b.content) < RELATIONSHIP_SIMILARITY) continue;
      gaps.push({
        id: `${a.id}:${b.id}:relationship`,
        type: "potential_relationship",
        importance: clamp01(Math.min(a.importance, b.importance)),
        confidence: clamp01(Math.min(a.confidence, b.confidence)),
        relatedNodes: [a.id, b.id],
        reason: `„${short(a.content)}“ und „${short(b.content)}“ berühren sich inhaltlich.`,
        suggestedQuestion: `Das hängt mit „${short(b.content, 40)}“ zusammen, worüber du vorher gesprochen hast.`,
        form: "observation",
        topic: a.topic ?? b.topic,
        expiresAt: now + GAP_TTL_MS[scopeOf(a)],
        futureRelevance: Math.min(futureRelevanceOf(a), futureRelevanceOf(b)),
      });
    }
  }

  // Abgelaufene Lücken und Lücken ausserhalb des Gesprächsinteresses bleiben,
  // werden aber später über Punktwert und Priorität sortiert.
  return gaps
    .filter((g) => g.expiresAt > now)
    .map((g) => ({
      ...g,
      // Ein Thema des laufenden Gesprächs bleibt unverändert relevant.
      futureRelevance:
        g.topic && topics.has(g.topic) ? g.futureRelevance : clamp01(g.futureRelevance * 0.85),
    }));
}
