/**
 * ORB Core – erweiterte autonome Gesprächsinitiative (reine Logik).
 *
 * Zwei zusätzliche, klar getrennte Fragearten, die NUR greifen, wenn der
 * bestehende Gap-/Impuls-Pfad keinen Kandidaten liefert:
 *
 *   3. Category-Curiosity  – Anschlussfrage aus einer bekannten Kategorie
 *   4. Follow-up           – einmaliges Wiederaufnehmen einer unbeantworteten
 *                            autonomen Frage
 *
 * Keine DB-, Netzwerk- oder KI-Zugriffe. Gap-Erkennung, Autonomie-Gate,
 * Energie und Schwellen bleiben unverändert und werden vom Aufrufer
 * unverändert angewendet.
 *
 * Provenienz ohne Schemaänderung: `orb_questions.gap_kind` (freier Text)
 * trägt `category:<kategorie>` bzw. `follow_up`; `knowledge_gap` eines
 * Follow-ups trägt `follow_up:<ursprungs-id>`.
 */

import { contentTokens, recencyFactor } from "@/orb-core/memory";
import { PROACTIVE_MIN_CONFIDENCE, type ProactiveMemory } from "@/orb-core/presence";
import { curiosityScore, type KnowledgeGap } from "@/orb-core/curiosity";

/* ------------------------------------------------------------ Klassifikation */

export type AutonomousQuestionType =
  | "gap_curiosity"
  | "category_curiosity"
  | "follow_up"
  /** Kein gespeicherter autonomer Fragedatensatz (z. B. normale Rückfrage). */
  | "contextual";

export const CATEGORY_KIND_PREFIX = "category:";
export const FOLLOW_UP_KIND = "follow_up";
export const FOLLOW_UP_GAP_PREFIX = "follow_up:";

/** Unterscheidet Fragearten anhand gespeicherter Provenienz. */
export function classifyAutonomousQuestion(
  gapKind: string | null | undefined,
): AutonomousQuestionType {
  if (!gapKind) return "contextual";
  if (gapKind === FOLLOW_UP_KIND) return "follow_up";
  if (gapKind.startsWith(CATEGORY_KIND_PREFIX)) return "category_curiosity";
  return "gap_curiosity";
}

/* ---------------------------------------------------------------- Kategorien */

export const INITIATIVE_CATEGORIES = [
  "gaming",
  "technik",
  "projekte",
  "arbeit",
  "reisen",
  "hobbys",
] as const;
export type InitiativeCategory = (typeof INITIATIVE_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<InitiativeCategory, string> = {
  gaming: "Gaming",
  technik: "PC / Technik",
  projekte: "Projekte",
  arbeit: "Arbeit",
  reisen: "Reisen",
  hobbys: "Freizeit / Hobbys",
};

const CATEGORY_RE: Record<InitiativeCategory, RegExp> = {
  gaming:
    /\b(fortnite|minecraft|valorant|zock\w*|spiele?n?|games?|gaming|gamer|playstation|ps5|xbox|nintendo|steam)\b/i,
  technik:
    /\b(pc|rechner|grafikkarte|rtx|gpu|cpu|prozessor|laptop|computer|hardware|monitor|hardware)\b/i,
  projekte: /\b(projekt\w*|app|website|webseite|entwickl\w*|programmier\w*)\b/i,
  arbeit: /\b(arbeit\w*|job|beruf|firma|kolleg\w*|chef\w*|schicht)\b/i,
  reisen: /\b(reise\w*|urlaub|flug|trip|verreis\w*)\b/i,
  hobbys:
    /\b(hobby\w*|freizeit|sport|fu(ss|ß)ball|gitarre|musik|wandern|fotograf\w*|kochen|lesen)\b/i,
};

/** Sensible Inhalte werden nie zum Ausgangspunkt einer Kategorie-Frage. */
const SENSITIVE_RE =
  /\b(gesundheit|krank\w*|diagnose|therapie|medikament\w*|religion|glaube|politik|partei|sex\w*|schulden|gehalt|passwort|adresse|trennung|gestorben|tod)\b/i;

export function isSensitive(text: string): boolean {
  return SENSITIVE_RE.test(text);
}

/** Kategorien, die sich tatsächlich aus dem Inhalt ableiten lassen. */
export function categoriesOf(text: string): InitiativeCategory[] {
  if (isSensitive(text)) return [];
  return INITIATIVE_CATEGORIES.filter((c) => CATEGORY_RE[c].test(text));
}

export type CategoryCandidate = {
  category: InitiativeCategory;
  /** Erinnerung, aus der die Frage entsteht (Ausgangspunkt). */
  anchor: ProactiveMemory;
  /** Bereits bekannte Angaben dieser Kategorie – dürfen nicht erfragt werden. */
  known: string[];
  score: number;
  reason: string;
};

export type CategoryInput = {
  memories: ProactiveMemory[];
  /** gap_kind der bisherigen eigenen Fragen. */
  askedKinds: string[];
  conversationTopics: string[];
  curiosity: number;
  now: number;
};

/**
 * Leitet Kategorie-Kandidaten aus vorhandenen Erinnerungen ab. Jede Kategorie
 * wird höchstens einmal (innerhalb der geladenen Fragenhistorie) genutzt.
 */
export function deriveCategoryCandidates(input: CategoryInput): CategoryCandidate[] {
  const asked = new Set(
    input.askedKinds
      .filter((k) => k.startsWith(CATEGORY_KIND_PREFIX))
      .map((k) => k.slice(CATEGORY_KIND_PREFIX.length)),
  );
  const topics = new Set(input.conversationTopics.filter(Boolean));
  const byCategory = new Map<InitiativeCategory, ProactiveMemory[]>();
  for (const m of input.memories) {
    if (m.confidence < PROACTIVE_MIN_CONFIDENCE) continue;
    if (contentTokens(m.content).length === 0) continue;
    for (const c of categoriesOf(m.content)) {
      if (asked.has(c)) continue;
      byCategory.set(c, [...(byCategory.get(c) ?? []), m]);
    }
  }
  const out: CategoryCandidate[] = [];
  for (const [category, mems] of byCategory) {
    const anchor = [...mems].sort(
      (a, b) => b.importance - a.importance || b.lastAccessedAt - a.lastAccessedAt,
    )[0]!;
    const relevance = recencyFactor(anchor.lastAccessedAt, input.now);
    const score = curiosityScore({
      curiosity: input.curiosity,
      relevance,
      importance: anchor.importance,
      confidence: anchor.confidence,
      conversationalFit: anchor.topic && topics.has(anchor.topic) ? 1 : 0.6,
      novelty: 1,
    });
    out.push({
      category,
      anchor,
      known: mems.map((m) => m.content),
      score,
      reason: `Kategorie „${CATEGORY_LABEL[category]}“ aus bekannter Angabe, Relevanz ${relevance.toFixed(2)}.`,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Wandelt einen Kandidaten in die Form, die decideCuriosity unverändert prüft. */
export function categoryAsGap(c: CategoryCandidate): KnowledgeGap {
  return {
    id: `${CATEGORY_KIND_PREFIX}${c.category}:${c.anchor.id}`,
    nodeId: c.anchor.id,
    memory: c.anchor.content,
    topic: c.anchor.topic ?? c.category,
    kind: "praeferenz",
    gap: `Kategorie ${CATEGORY_LABEL[c.category]}: mögliche Anschlussfrage.`,
    importance: c.anchor.importance,
    confidence: c.anchor.confidence,
    interestWeight: 0,
    relevance: recencyFactor(c.anchor.lastAccessedAt, Date.now()),
    novelty: 1,
    conversationalFit: 0.6,
    score: c.score,
    reason: c.reason,
  };
}

/* ------------------------------------------------------------------ Follow-up */

export type FollowUpQuestionRow = {
  id: string;
  question: string;
  topic: string | null;
  gap_kind: string;
  knowledge_gap: string;
  answered: boolean;
  asked_at: string | null;
  score: number;
  source_memory_ids: string[];
};

export type FollowUpInput = {
  /** Eigene Fragen, neueste zuerst. */
  questions: FollowUpQuestionRow[];
  /** Nachrichten, neueste zuerst. */
  recentMessages: { role: string; body: string }[];
  /** Bestehendes Antwortfenster der Engine. */
  answerWindowMs: number;
  now: number;
  topicsOf: (text: string) => string[];
};

export type FollowUpDecision =
  | { eligible: true; row: FollowUpQuestionRow; reason: string }
  | { eligible: false; row: null; reason: string };

/** Ausdrückliche Ablehnung, eine Frage zu beantworten. */
const REFUSE_RE =
  /\b((will|möchte|mag) (ich )?(das |darauf |dazu )?(nicht|nichts) (beantworten|sagen|erzählen)|keine lust|geht dich nichts an|kein kommentar|lass (das|mal)|frag nicht|nicht fragen|kein thema)\b/i;

export function isRefusal(text: string): boolean {
  return REFUSE_RE.test(text);
}

/**
 * Darf die zuletzt gestellte autonome Frage einmal wieder aufgenommen werden?
 * Nur die neueste Frage wird betrachtet (nie mehrere gleichzeitig). Sobald
 * eine neuere Frage gestellt wurde, gilt die ältere als geparkt/geschlossen.
 */
export function decideFollowUp(input: FollowUpInput): FollowUpDecision {
  const no = (reason: string): FollowUpDecision => ({ eligible: false, row: null, reason });
  const latest = input.questions.find((r) => r.asked_at !== null);
  if (!latest) return no("Keine eigene Frage vorhanden.");
  if (latest.gap_kind === FOLLOW_UP_KIND) return no("Follow-up bereits gesendet – Frage geschlossen.");
  if (latest.answered) return no("Frage wurde beantwortet.");
  const marker = `${FOLLOW_UP_GAP_PREFIX}${latest.id}`;
  if (input.questions.some((r) => r.gap_kind === FOLLOW_UP_KIND && r.knowledge_gap === marker)) {
    return no("Follow-up bereits gesendet – Frage geschlossen.");
  }
  if (input.now - new Date(latest.asked_at!).getTime() < input.answerWindowMs) {
    return no("Frage liegt noch im Antwortfenster.");
  }
  // Nachrichten nach der Frage (neueste zuerst bis zur Frage).
  const idx = input.recentMessages.findIndex((m) => m.role === "orb" && m.body === latest.question);
  const after = idx === -1 ? input.recentMessages : input.recentMessages.slice(0, idx);
  const userAfter = after.filter((m) => m.role === "user").map((m) => m.body);
  if (userAfter.length === 0) return no("Gespräch ist seit der Frage nicht weitergelaufen.");
  if (userAfter.some(isRefusal)) return no("Nutzer möchte die Frage nicht beantworten.");
  const lastTopics = input.topicsOf(userAfter[0]!);
  if (lastTopics.length > 0 && latest.topic && !lastTopics.includes(latest.topic)) {
    return no("Nutzer hat das Thema gewechselt – ORB hakt nicht sofort nach.");
  }
  return { eligible: true, row: latest, reason: "Eigene Frage blieb unbeantwortet – einmaliges Follow-up." };
}

/** Deterministischer Follow-up-Text – keine erfundene Begründung, kein Modellaufruf. */
export function followUpText(originalQuestion: string): string {
  return `Übrigens, meine Frage von vorhin ist noch offen. 😄 Wenn du irgendwann Lust hast: ${originalQuestion.trim()}`;
}

export function followUpAsGap(row: FollowUpQuestionRow): KnowledgeGap {
  return {
    id: `${FOLLOW_UP_GAP_PREFIX}${row.id}`,
    nodeId: row.source_memory_ids[0] ?? "",
    memory: row.question,
    topic: row.topic ?? "",
    kind: "kontext",
    gap: `${FOLLOW_UP_GAP_PREFIX}${row.id}`,
    importance: 0,
    confidence: 1,
    interestWeight: 0,
    relevance: 1,
    novelty: 1,
    conversationalFit: 1,
    score: row.score,
    reason: "Einmaliges Follow-up auf unbeantwortete eigene Frage.",
  };
}
