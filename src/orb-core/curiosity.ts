/**
 * ORB Core – Curiosity Core (selbstgesteuerte Fragen), reine Logik.
 *
 * Diese Datei enthält KEINE Datenbank- und keine Netzwerkzugriffe. Sie
 * beantwortet drei Fragen aus bereits geladenen Daten:
 *
 *   1. Welche Wissenslücken bestehen?        → deriveKnowledgeGaps
 *   2. Wie stark ist die Neugier darauf?     → curiosityScore
 *   3. Was folgt daraus?                     → decideCuriosity (DO_NOTHING | WAIT | ASK)
 *
 * Grundsatz: „ORB fragt nicht, weil er fragen MUSS. ORB fragt, weil ORB
 * etwas wissen möchte.“ Auch eine ausdrückliche Aufforderung („frag mich“)
 * umgeht diese Prüfung nicht – ohne inneren Grund bleibt der ORB still.
 *
 * Es wird KEINE zweite Neugier-Variable eingeführt: verwendet wird
 * ausschliesslich `curiosity` aus dem bestehenden `OrbState`.
 */

import { clamp01 } from "@/orb-core/core";
import { contentTokens, recencyFactor, similarity, type InterestRow } from "@/orb-core/memory";
import {
  PROACTIVE_COOLDOWN_MS,
  PROACTIVE_MIN_CONFIDENCE,
  PROACTIVE_MIN_INTEREST_WEIGHT,
  curiosityBand,
  mayAskAtCuriosity,
  type CuriosityBand,
  type ProactiveMemory,
} from "@/orb-core/presence";

/* --------------------------------------------------------------- Wissenslücken */

/** Art der Wissenslücke – daraus entsteht die inhaltliche Richtung der Frage. */
export const KNOWLEDGE_GAP_KINDS = [
  "grund",
  "stand",
  "erfahrung",
  "praeferenz",
  "detail",
  "kontext",
] as const;

export type KnowledgeGapKind = (typeof KNOWLEDGE_GAP_KINDS)[number];

/** Benennbare Beschreibung der Lücke (für Bericht, Testbereich, Transparenz). */
export const GAP_LABEL: Record<KnowledgeGapKind, string> = {
  grund: "ORB weiss das Was, aber nicht das Warum.",
  stand: "ORB kennt das Vorhaben, aber nicht den aktuellen Stand.",
  erfahrung: "ORB kennt die Sache, aber keine konkrete Erfahrung damit.",
  praeferenz: "ORB kennt das Thema, aber keine konkrete Vorliebe darin.",
  detail: "ORB kennt die Aussage nur allgemein, ohne konkretes Detail.",
  kontext: "ORB kennt die Aussage, aber nicht den Zusammenhang drumherum.",
};

/** Anweisung an die Sprachschicht – die Frage bleibt inhaltlich gebunden. */
export const GAP_HINT: Record<KnowledgeGapKind, string> = {
  grund: "Frage nach dem Grund dahinter.",
  stand: "Frage nach dem aktuellen Stand dieses Vorhabens.",
  erfahrung: "Frage nach einer konkreten Erfahrung damit.",
  praeferenz: "Frage nach einer konkreten Vorliebe innerhalb dieses Themas.",
  detail: "Frage nach einem konkreten Detail dieser Aussage.",
  kontext: "Frage nach dem konkreten Zusammenhang oder Umfeld.",
};

const WANT_RE = /\b(möchte|will|plane|vorhaben|vorhabe|lerne|suche|brauche|spare)\b/i;
const LIKE_RE = /\b(mag|liebe|lieblings\w*|gern|gerne|bevorzuge|hasse|mag keine?)\b/i;
const DONE_RE = /\b(hatte|hab|habe|war|gekauft|gemacht|getestet|probiert|gespielt)\b/i;

/**
 * Welche Lücken ergeben sich aus dem Inhalt einer Erinnerung?
 * Die Reihenfolge ist die Priorität: was inhaltlich am nächsten liegt, zuerst.
 */
export function gapKindsFor(content: string): KnowledgeGapKind[] {
  const kinds: KnowledgeGapKind[] = [];
  if (LIKE_RE.test(content)) kinds.push("grund", "praeferenz");
  if (WANT_RE.test(content)) kinds.push("stand");
  if (DONE_RE.test(content)) kinds.push("erfahrung");
  for (const fallback of ["detail", "kontext"] as const) {
    if (!kinds.includes(fallback)) kinds.push(fallback);
  }
  return kinds;
}

/** Eine bereits gestellte selbstgenerierte Frage. */
export type AskedQuestion = {
  nodeId: string | null;
  topic: string | null;
  kind: KnowledgeGapKind | null;
  question: string;
  answered: boolean;
};

export type KnowledgeGap = {
  /** Stabiler Schlüssel aus Knoten und Lückenart. */
  id: string;
  nodeId: string;
  memory: string;
  topic: string;
  kind: KnowledgeGapKind;
  /** Benennbare Lücke, nicht die fertige Frage. */
  gap: string;
  importance: number;
  confidence: number;
  interestWeight: number;
  relevance: number;
  novelty: number;
  conversationalFit: number;
  score: number;
  reason: string;
};

/* ------------------------------------------------------------- Neugier-Wert */

/** Weiche Kennlinie: ein schwacher Faktor senkt, tötet aber nicht. */
function soft(value: number): number {
  return 0.5 + 0.5 * clamp01(value);
}

export type CuriosityScoreInput = {
  /** Bestehender Zustandswert `curiosity`. */
  curiosity: number;
  relevance: number;
  importance: number;
  confidence: number;
  /** Passt die Lücke zum laufenden Gespräch? */
  conversationalFit: number;
  /** Wurde zu dieser Lücke schon gefragt? */
  novelty: number;
};

/**
 * Nachvollziehbarer Neugier-Wert (0..1). Jeder Faktor ist einzeln sichtbar,
 * damit die Entscheidung erklärbar bleibt.
 */
export function curiosityScore(input: CuriosityScoreInput): number {
  return clamp01(
    clamp01(input.curiosity) *
      clamp01(input.relevance) *
      soft(input.importance) *
      soft(input.confidence) *
      soft(input.conversationalFit) *
      soft(input.novelty),
  );
}

/** Ab diesem Wert ist die Neugier stark genug für eine eigene Frage. */
export const CURIOSITY_ASK_THRESHOLD = 0.2;

/** Unter diesem Energiewert fragt der ORB nicht von sich aus. */
export const CURIOSITY_MIN_ENERGY = 0.15;

/** Ab dieser Ähnlichkeit gilt eine Frage als bereits gestellt. */
export const QUESTION_DUPLICATE_SIMILARITY = 0.6;

/** Eine bereits gestellte, sehr ähnliche Frage wird nicht wiederholt. */
export function isDuplicateQuestion(question: string, previous: string[]): boolean {
  return previous.some((p) => similarity(question, p) >= QUESTION_DUPLICATE_SIMILARITY);
}

/* ---------------------------------------------------------- Lückenermittlung */

export type GapInput = {
  /** Nur bereits geladene, begrenzte Erinnerungen – keine Vollabfrage. */
  memories: ProactiveMemory[];
  interests: InterestRow[];
  /** Bereits gestellte selbstgenerierte Fragen. */
  asked: AskedQuestion[];
  /** Themen des laufenden Gesprächs (letzte Nachrichten). */
  conversationTopics?: string[];
  now: number;
};

/**
 * Leitet aus den geladenen Erinnerungen offene Wissenslücken ab und bewertet
 * sie. Ohne thematisch verankerte, ausreichend sichere Erinnerung entsteht
 * keine Lücke – und damit keine generische Frage.
 */
export function deriveKnowledgeGaps(input: GapInput & { curiosity: number }): KnowledgeGap[] {
  const interestByTopic = new Map(input.interests.map((i) => [i.topic, i]));
  const topics = new Set((input.conversationTopics ?? []).filter(Boolean));
  const gaps: KnowledgeGap[] = [];

  for (const m of input.memories) {
    if (!m.topic) continue;
    if (m.confidence < PROACTIVE_MIN_CONFIDENCE) continue;
    if (contentTokens(m.content).length === 0) continue;

    const interest = interestByTopic.get(m.topic) ?? null;
    if (interest && interest.weight < PROACTIVE_MIN_INTEREST_WEIGHT) continue;
    const interestWeight = interest ? interest.weight * interest.confidence : 0;

    const askedForNode = input.asked.filter((a) => a.nodeId === m.id);
    const relevance = clamp01(
      recencyFactor(m.lastAccessedAt, input.now) *
        (0.5 + 0.5 * clamp01(interestWeight)) *
        (1 + Math.min(0.3, 0.1 * m.activationCount)),
    );
    const conversationalFit = topics.has(m.topic) ? 1 : 0.6;

    for (const kind of gapKindsFor(m.content)) {
      // Geschlossene Lücke: eine beantwortete Frage wird nicht erneut gestellt.
      const sameKind = askedForNode.filter((a) => a.kind === kind);
      if (sameKind.some((a) => a.answered)) continue;
      if (sameKind.length > 0) continue;

      const novelty = clamp01(1 - 0.3 * askedForNode.length);
      if (novelty <= 0) continue;

      const score = curiosityScore({
        curiosity: input.curiosity,
        relevance,
        importance: m.importance,
        confidence: m.confidence,
        conversationalFit,
        novelty,
      });

      gaps.push({
        id: `${m.id}:${kind}`,
        nodeId: m.id,
        memory: m.content,
        topic: m.topic,
        kind,
        gap: GAP_LABEL[kind],
        importance: m.importance,
        confidence: m.confidence,
        interestWeight,
        relevance,
        novelty,
        conversationalFit,
        score,
        reason: `${GAP_LABEL[kind]} Thema „${m.topic}“, Relevanz ${relevance.toFixed(2)}, Neuheit ${novelty.toFixed(2)}.`,
      });
    }
  }

  return gaps.sort((a, b) => b.score - a.score);
}

/* -------------------------------------------------------------- Entscheidung */

export type CuriosityAction = "DO_NOTHING" | "WAIT" | "ASK";

export type CuriosityDecisionInput = {
  curiosity: number;
  energy: number;
  gaps: KnowledgeGap[];
  /** Zeitpunkt der letzten selbstgenerierten Frage (ms) oder null. */
  lastQuestionAt: number | null;
  /** Eine bereits gestellte, unbeantwortete Frage wartet noch. */
  openQuestion?: boolean;
  now: number;
};

export type CuriosityDecision = {
  action: CuriosityAction;
  reason: string;
  score: number;
  band: CuriosityBand;
  gap: KnowledgeGap | null;
};

/**
 * Entscheidet aus dem inneren Zustand heraus. Die Reihenfolge der Prüfungen
 * ist die Begründung: jede Entscheidung ist benennbar.
 */
export function decideCuriosity(input: CuriosityDecisionInput): CuriosityDecision {
  const band = curiosityBand(input.curiosity);
  const best = input.gaps[0] ?? null;
  const score = best?.score ?? 0;
  const out = (action: CuriosityAction, reason: string): CuriosityDecision => ({
    action,
    reason,
    score,
    band,
    gap: action === "ASK" ? best : null,
  });

  if (input.gaps.length === 0) {
    return out("DO_NOTHING", "Keine offene Wissenslücke – ORB hat keinen Grund zu fragen.");
  }
  if (!mayAskAtCuriosity(input.curiosity)) {
    return out("DO_NOTHING", "Neugier zu gering – ORB möchte gerade nichts wissen.");
  }
  if (input.energy < CURIOSITY_MIN_ENERGY) {
    return out("WAIT", "Zu wenig Energie – ORB wartet.");
  }
  if (input.openQuestion) {
    return out("WAIT", "Eine eigene Frage ist noch offen – ORB wartet auf die Antwort.");
  }
  if (input.lastQuestionAt !== null) {
    const waited = input.now - input.lastQuestionAt;
    if (waited < PROACTIVE_COOLDOWN_MS[band]) {
      return out("WAIT", "Cooldown nach der letzten eigenen Frage aktiv.");
    }
  }
  if (score < CURIOSITY_ASK_THRESHOLD) {
    return out(
      "WAIT",
      `Interesse noch nicht stark genug (${score.toFixed(2)} < ${CURIOSITY_ASK_THRESHOLD}).`,
    );
  }
  return out("ASK", `${best?.reason ?? ""} Neugier ${band}, Wert ${score.toFixed(2)}.`.trim());
}

/* ------------------------------------------------------------ Antworterkennung */

/** Aufforderungen wie „frag mich“ – sie umgehen die innere Prüfung nicht. */
const ASK_ME_RE = /\b(frag(e)? mich|stell(e)? (mir )?eine frage|was möchtest du wissen)\b/i;

export function isAskMeRequest(text: string): boolean {
  return ASK_ME_RE.test(text);
}

/** Harte Grenze: der Curiosity Core wirkt ausschliesslich im ORB-Core-Chat. */
export const CURIOSITY_SCOPE = "orb_core_chat_only" as const;
export const CURIOSITY_SOCIAL_ACTIONS_ENABLED = false;
