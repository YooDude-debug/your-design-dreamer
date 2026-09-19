/**
 * ORB Core – Kontinuität: offene Gedankenfäden, sprachliche Sicherheit,
 * Interessenentwicklung, Gesprächsstil, Widersprüche. Reine Logik.
 *
 * Diese Datei enthält KEINE Datenbank- und keine Netzwerkzugriffe. Sie
 * erweitert die bestehenden Bausteine (orb-core, orb-memory, orb-presence,
 * orb-curiosity) und ersetzt keinen davon.
 *
 * Grundsätze:
 *  - VERGESSEN ≠ LÖSCHEN: ein Faden wird schwächer oder pausiert, nie entfernt.
 *  - Keine vorgetäuschte Menschlichkeit: jede Formulierungsstufe beruht auf
 *    echten Gewichts-, Sicherheits- und Aktivierungswerten.
 *  - Schweigen ist ein gültiger Zustand.
 */

import { clamp01, W_MIN } from "@/lib/orb-core";
import {
  contentTokens,
  recencyFactor,
  similarity,
  topicsOf,
  type InterestRow,
} from "@/lib/orb-memory";
import {
  GAP_LABEL,
  gapKindsFor,
  type KnowledgeGap,
  type KnowledgeGapKind,
} from "@/lib/orb-curiosity";

/** Harte Grenze: Kontinuität wirkt ausschliesslich im ORB-Core-Chat. */
export const CONTINUITY_SCOPE = "orb_core_chat_only" as const;
/** Schweigen ist ausdrücklich erlaubt – keine künstliche Aktivität. */
export const SILENCE_IS_VALID = true;

/* ============================================================ Gedankenfäden */

export const THREAD_STATES = ["OPEN", "ACTIVE", "PAUSED", "REACTIVATED", "RESOLVED"] as const;
export type ThreadState = (typeof THREAD_STATES)[number];

const HOUR_MS = 3_600_000;

/** Ohne Aktivierung gilt ein Faden nach dieser Zeit als pausiert. */
export const THREAD_PAUSE_AFTER_MS = 6 * HOUR_MS;
/** Untergrenzen: ein Faden verliert Gewicht, verschwindet aber nie. */
export const THREAD_CURIOSITY_MIN = 0.05;
export const THREAD_IMPORTANCE_MIN = 0.05;
/** Verfallsrate der Fadenneugier pro Stunde. */
export const THREAD_DECAY_RATE = 0.03;
/** Ab dieser Relevanz darf ein alter Faden wieder aufgenommen werden. */
export const THREAD_RESUME_MIN_RELEVANCE = 0.35;
/** Frühestens nach dieser Zeit greift ORB einen Faden erneut auf. */
export const THREAD_RESUME_COOLDOWN_MS = 10 * 60_000;

export type ThoughtThread = {
  id: string;
  title: string;
  topic: string | null;
  status: ThreadState;
  /** Was ORB zu diesem Thema weiss. */
  known: string[];
  /** Was ORB noch nicht weiss (benennbare Lücken, keine fertigen Fragen). */
  unknown: string[];
  curiosity: number;
  importance: number;
  /** Zeitpunkt der letzten Berührung in Millisekunden. */
  lastActivationAt: number;
  activationCount: number;
  resolvedAt: number | null;
  /** Erinnerungen, aus denen der Faden entstand (nie gelöscht). */
  nodeIds: string[];
};

export type ThreadDraft = {
  title: string;
  topic: string | null;
  known: string[];
  unknown: string[];
  curiosity: number;
  importance: number;
};

/** Kurzer, sprechender Titel aus dem Inhalt (keine KI, nur Inhaltswörter). */
export function threadTitle(content: string): string {
  const tokens = contentTokens(content);
  if (tokens.length === 0) return content.trim().slice(0, 40);
  // Aussagekräftig statt wörtlich: die längsten Inhaltswörter in Originalfolge.
  const ranked = [...new Set(tokens)].sort((a, b) => b.length - a.length).slice(0, 3);
  return tokens
    .filter((t) => ranked.includes(t))
    .filter((t, i, a) => a.indexOf(t) === i)
    .join(" ");
}

/** Neugier eines Fadens: Wichtigkeit und Menge der offenen Punkte. */
export function threadCuriosity(importance: number, unknownCount: number): number {
  return clamp01(0.25 + 0.45 * clamp01(importance) + 0.1 * Math.min(3, unknownCount));
}

/**
 * Entwurf eines Fadens aus einer Erinnerung. Die offenen Punkte entstehen aus
 * denselben Lückenarten wie im Curiosity Core – keine zweite Logik.
 */
export function threadDraftFrom(input: {
  content: string;
  topic: string | null;
  importance: number;
}): ThreadDraft | null {
  if (contentTokens(input.content).length === 0) return null;
  const kinds = gapKindsFor(input.content).slice(0, 3);
  const unknown = kinds.map((k) => GAP_LABEL[k]);
  return {
    title: threadTitle(input.content),
    topic: input.topic,
    known: [input.content.trim().slice(0, 300)],
    unknown,
    curiosity: threadCuriosity(input.importance, unknown.length),
    importance: clamp01(input.importance),
  };
}

/**
 * Verfall eines Fadens. Reine Berechnung: Neugier und Wichtigkeit sinken,
 * bleiben aber immer über den Untergrenzen. Nichts wird entfernt.
 */
export function decayThread(
  thread: Pick<ThoughtThread, "curiosity" | "importance" | "lastActivationAt">,
  now: number,
): { curiosity: number; importance: number } {
  const hours = Math.max(0, (now - thread.lastActivationAt) / HOUR_MS);
  const factor = Math.exp(-THREAD_DECAY_RATE * hours);
  return {
    curiosity: Math.max(THREAD_CURIOSITY_MIN, thread.curiosity * factor),
    importance: Math.max(THREAD_IMPORTANCE_MIN, thread.importance * (0.5 + 0.5 * factor)),
  };
}

/**
 * Zustand allein durch Zeitablauf. Ein gelöster Faden bleibt gelöst und
 * historisch nachvollziehbar; ein unberührter Faden pausiert.
 */
export function threadStatusAfter(thread: ThoughtThread, now: number): ThreadState {
  if (thread.status === "RESOLVED") return "RESOLVED";
  const idle = now - thread.lastActivationAt;
  if (idle >= THREAD_PAUSE_AFTER_MS) return "PAUSED";
  if (thread.status === "OPEN") return "OPEN";
  return thread.status;
}

/** Erneute Berührung: der Faden wird stärker, nicht neu angelegt. */
export function reactivateThread(
  thread: ThoughtThread,
  input: { now: number; delta?: number; known?: string },
): ThoughtThread {
  const decayed = decayThread(thread, input.now);
  const delta = input.delta ?? 0.12;
  const wasIdle = thread.status === "PAUSED" || thread.status === "RESOLVED";
  const known =
    input.known && !thread.known.includes(input.known)
      ? [...thread.known, input.known.slice(0, 300)]
      : thread.known;
  return {
    ...thread,
    known,
    // Ein gelöster Faden bleibt gelöst; er wird nur wieder berührt.
    status: thread.status === "RESOLVED" ? "RESOLVED" : wasIdle ? "REACTIVATED" : "ACTIVE",
    curiosity: Math.min(1, decayed.curiosity + delta),
    importance: Math.max(decayed.importance, thread.importance),
    lastActivationAt: input.now,
    activationCount: thread.activationCount + 1,
  };
}

/** Ein Faden pausiert – er wird ausdrücklich NICHT gelöscht. */
export function pauseThread(thread: ThoughtThread, now: number): ThoughtThread {
  if (thread.status === "RESOLVED") return thread;
  const decayed = decayThread(thread, now);
  return { ...thread, status: "PAUSED", ...decayed };
}

/**
 * Ein Faden ist geklärt. Bekanntes und die Herkunft bleiben erhalten, damit
 * der Verlauf nachvollziehbar bleibt.
 */
export function resolveThread(
  thread: ThoughtThread,
  input: { now: number; answer?: string },
): ThoughtThread {
  const known =
    input.answer && !thread.known.includes(input.answer)
      ? [...thread.known, input.answer.slice(0, 300)]
      : thread.known;
  return {
    ...thread,
    status: "RESOLVED",
    known,
    unknown: thread.unknown,
    resolvedAt: input.now,
    lastActivationAt: input.now,
    curiosity: Math.max(THREAD_CURIOSITY_MIN, thread.curiosity * 0.4),
  };
}

/** Relevanz eines Fadens für das laufende Gespräch. */
export function threadRelevance(
  thread: ThoughtThread,
  input: { conversationTopics?: string[]; text?: string; interests?: InterestRow[]; now: number },
): number {
  const decayed = decayThread(thread, input.now);
  const topics = new Set(input.conversationTopics ?? []);
  const topical = thread.topic && topics.has(thread.topic) ? 1 : 0.55;
  const textual = input.text ? similarity(input.text, thread.known.join(" ")) : 0;
  const interest = (input.interests ?? []).find((i) => i.topic === thread.topic) ?? null;
  const interestWeight = interest ? interest.weight * interest.confidence : 0;
  return clamp01(
    (0.55 * decayed.curiosity + 0.25 * decayed.importance + 0.2 * interestWeight) *
      Math.max(topical, 0.4 + 0.6 * textual) *
      recencyFactor(thread.lastActivationAt, input.now),
  );
}

export type ResumeVerdict = { resume: boolean; reason: string; relevance: number };

/**
 * Darf ORB einen offenen Faden jetzt wieder aufgreifen? Keine erzwungene
 * Wiederaufnahme – ohne ausreichende Relevanz bleibt ORB still.
 */
export function shouldResumeThread(input: {
  thread: ThoughtThread;
  relevance: number;
  curiosity: number;
  lastResumeAt: number | null;
  now: number;
}): ResumeVerdict {
  const out = (resume: boolean, reason: string): ResumeVerdict => ({
    resume,
    reason,
    relevance: input.relevance,
  });
  if (input.thread.status === "RESOLVED") return out(false, "Faden ist bereits geklärt.");
  if (input.thread.unknown.length === 0) return out(false, "Am Faden ist nichts offen.");
  if (input.curiosity < 0.35) return out(false, "Neugier zu gering – ORB bleibt still.");
  if (input.lastResumeAt !== null && input.now - input.lastResumeAt < THREAD_RESUME_COOLDOWN_MS) {
    return out(false, "Cooldown nach der letzten Wiederaufnahme aktiv.");
  }
  if (input.relevance < THREAD_RESUME_MIN_RELEVANCE) {
    return out(
      false,
      `Faden gerade nicht relevant genug (${input.relevance.toFixed(2)} < ${THREAD_RESUME_MIN_RELEVANCE}).`,
    );
  }
  return out(true, `Offener Faden „${input.thread.title}“ ist weiterhin relevant.`);
}

/**
 * Offene Fäden als Wissenslücken – dieselbe Struktur wie im Curiosity Core,
 * damit es nur eine Entscheidungslogik gibt.
 */
export function threadKnowledgeGaps(
  threads: ThoughtThread[],
  input: {
    curiosity: number;
    conversationTopics?: string[];
    interests?: InterestRow[];
    now: number;
  },
): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  for (const thread of threads) {
    if (thread.status === "RESOLVED") continue;
    if (thread.unknown.length === 0) continue;
    const relevance = threadRelevance(thread, input);
    const decayed = decayThread(thread, input.now);
    const kinds = gapKindsFor(thread.known.join(" "));
    const kind: KnowledgeGapKind = kinds[0] ?? "kontext";
    const score = clamp01(clamp01(input.curiosity) * relevance * (0.5 + 0.5 * decayed.importance));
    gaps.push({
      id: `thread:${thread.id}`,
      nodeId: thread.nodeIds[0] ?? thread.id,
      memory: thread.known[0] ?? thread.title,
      topic: thread.topic ?? thread.title,
      kind,
      gap: thread.unknown[0] ?? GAP_LABEL[kind],
      importance: decayed.importance,
      confidence: 0.8,
      interestWeight: 0,
      relevance,
      novelty: 1,
      conversationalFit: relevance,
      score,
      reason: `Offener Gedankenfaden „${thread.title}“ (${thread.status}), Relevanz ${relevance.toFixed(2)}.`,
    });
  }
  return gaps.sort((a, b) => b.score - a.score);
}

/* ================================================= Sprachliche Sicherheit */

export type MemoryCertainty = "sicher" | "wahrscheinlich" | "vage";

export const CERTAINTY_SICHER = 0.6;
export const CERTAINTY_WAHRSCHEINLICH = 0.3;

/** Stärke einer Erinnerung aus echten Werten – keine Schätzung. */
export function memoryStrength(input: {
  weight: number;
  confidence: number;
  activationCount: number;
  lastAccessedAt: number;
  now: number;
}): number {
  const w = Math.max(W_MIN, Math.min(1, input.weight));
  const act = Math.min(1, 0.6 + 0.2 * Math.max(0, input.activationCount - 1));
  return clamp01(
    w *
      clamp01(input.confidence) *
      act *
      (0.5 + 0.5 * recencyFactor(input.lastAccessedAt, input.now)),
  );
}

export function certaintyOf(strength: number): MemoryCertainty {
  if (strength >= CERTAINTY_SICHER) return "sicher";
  if (strength >= CERTAINTY_WAHRSCHEINLICH) return "wahrscheinlich";
  return "vage";
}

/**
 * Anweisung an die Sprachschicht. ORB täuscht keine Unsicherheit vor: die
 * Stufe folgt ausschliesslich aus Gewicht, Sicherheit und Aktualität.
 */
export const CERTAINTY_HINT: Record<MemoryCertainty, string> = {
  sicher: "Beziehe dich direkt darauf („Du hast mir erzählt, dass …“).",
  wahrscheinlich: "Formuliere mit leichtem Vorbehalt („Ich glaube, du hattest … einmal erwähnt“).",
  vage: "Formuliere ausdrücklich unsicher („Ich bin mir nicht sicher, aber ich meine, …“).",
};

/** Formulierungsvorgabe für eine einzelne Erinnerung. */
export function phrasingFor(input: {
  content: string;
  weight: number;
  confidence: number;
  activationCount: number;
  lastAccessedAt: number;
  now: number;
}): { certainty: MemoryCertainty; strength: number; hint: string } {
  const strength = memoryStrength(input);
  const certainty = certaintyOf(strength);
  return { certainty, strength, hint: CERTAINTY_HINT[certainty] };
}

/* ======================================================= Gesprächsstil */

/** Ein Muster gilt erst nach mehreren Nachrichten als Muster. */
export const STYLE_MIN_MESSAGES = 5;
/** Anteil, ab dem ein Merkmal als wiederkehrend gilt. */
export const STYLE_DOMINANCE = 0.6;

export type StyleProfile = {
  messages: number;
  totalLength: number;
  emojiMessages: number;
  questionMessages: number;
  casualMessages: number;
  formalMessages: number;
  technicalMessages: number;
};

export const EMPTY_STYLE: StyleProfile = {
  messages: 0,
  totalLength: 0,
  emojiMessages: 0,
  questionMessages: 0,
  casualMessages: 0,
  formalMessages: 0,
  technicalMessages: 0,
};

const EMOJI_RE = /[\p{Extended_Pictographic}]/u;
const CASUAL_RE = /\b(hey|hi|moin|hallo|cool|krass|nice|lol|haha|ne\?|joa|ok|okay|passt)\b/i;
const FORMAL_RE =
  /\b(bitte|danke|könnten|würden|beziehungsweise|folglich|daher|gegebenenfalls|sehr geehrte)\b/i;
const TECHNICAL_RE =
  /\b(gpu|cpu|ram|vram|api|datenbank|latenz|benchmark|treiber|konfiguration|server|code|framework)\b/i;

/** Eine Nachricht beobachten. Kein Rückschluss auf Person oder Eigenschaften. */
export function observeStyle(prev: StyleProfile, text: string): StyleProfile {
  const t = text.trim();
  if (!t) return prev;
  return {
    messages: prev.messages + 1,
    totalLength: prev.totalLength + t.length,
    emojiMessages: prev.emojiMessages + (EMOJI_RE.test(t) ? 1 : 0),
    questionMessages: prev.questionMessages + (t.includes("?") ? 1 : 0),
    casualMessages: prev.casualMessages + (CASUAL_RE.test(t) ? 1 : 0),
    formalMessages: prev.formalMessages + (FORMAL_RE.test(t) ? 1 : 0),
    technicalMessages: prev.technicalMessages + (TECHNICAL_RE.test(t) ? 1 : 0),
  };
}

export type StyleTraits = {
  established: boolean;
  messages: number;
  avgLength: number;
  tone: "locker" | "sachlich" | "unbestimmt";
  emoji: boolean;
  technical: boolean;
  questions: boolean;
  preferredReplyLength: "kurz" | "mittel" | "lang";
};

export function styleTraits(p: StyleProfile): StyleTraits {
  const established = p.messages >= STYLE_MIN_MESSAGES;
  const avgLength = p.messages === 0 ? 0 : p.totalLength / p.messages;
  const share = (n: number) => (p.messages === 0 ? 0 : n / p.messages);
  const casual = share(p.casualMessages);
  const formal = share(p.formalMessages);
  const tone: StyleTraits["tone"] =
    !established || Math.max(casual, formal) < STYLE_DOMINANCE
      ? "unbestimmt"
      : casual >= formal
        ? "locker"
        : "sachlich";
  return {
    established,
    messages: p.messages,
    avgLength,
    tone,
    emoji: established && share(p.emojiMessages) >= STYLE_DOMINANCE,
    technical: established && share(p.technicalMessages) >= STYLE_DOMINANCE,
    questions: established && share(p.questionMessages) >= STYLE_DOMINANCE,
    preferredReplyLength: avgLength >= 160 ? "lang" : avgLength >= 60 ? "mittel" : "kurz",
  };
}

/**
 * Stilhinweis für die Sprachschicht – erst bei wiederkehrendem Muster.
 * Keine künstliche Persönlichkeit, keine stereotype Nachahmung.
 */
export function styleHint(p: StyleProfile): string | null {
  const t = styleTraits(p);
  if (!t.established) return null;
  const parts: string[] = [];
  if (t.tone === "locker")
    parts.push("Der Benutzer schreibt dauerhaft locker – antworte entspannt, aber nicht albern.");
  if (t.tone === "sachlich")
    parts.push("Der Benutzer schreibt dauerhaft sachlich – antworte sachlich und knapp.");
  if (t.emoji) parts.push("Emojis sind hier üblich, höchstens eines.");
  if (t.technical)
    parts.push("Technische Gespräche sind üblich – fachliche Begriffe sind in Ordnung.");
  parts.push(
    t.preferredReplyLength === "kurz"
      ? "Halte die Antwort kurz."
      : t.preferredReplyLength === "mittel"
        ? "Eine mittellange Antwort passt."
        : "Eine ausführlichere Antwort passt.",
  );
  return parts.length > 0 ? parts.join(" ") : null;
}

/* ====================================================== Widersprüche */

export type Polarity = "positiv" | "negativ" | "neutral";

const POS_RE = /\b(mag|liebe|lieblings\w*|gern|gerne|super|toll|bevorzuge|freue|schön|spannend)\b/i;
const NEG_RE =
  /\b(nicht|kein|keine|keinen|niemals|nie|hasse|schlecht|furchtbar|mies|überhaupt nicht|ungern)\b/i;

/** Haltung einer Aussage – rein sprachlich, ohne Deutung der Person. */
export function polarityOf(text: string): Polarity {
  const neg = NEG_RE.test(text);
  const pos = POS_RE.test(text);
  if (neg && pos) return "negativ"; // „mag ich nicht“
  if (neg) return "negativ";
  if (pos) return "positiv";
  return "neutral";
}

export type Contradiction = {
  nodeId: string;
  memory: string;
  overlap: number;
  polarityOld: Polarity;
  polarityNew: Polarity;
  reason: string;
  /** Benennbare Lücke, die daraus entstehen kann. */
  gap: string;
};

/** Ab dieser inhaltlichen Nähe gelten zwei Aussagen als dasselbe Thema. */
export const CONTRADICTION_MIN_OVERLAP = 0.3;

/**
 * Möglicher Widerspruch zwischen neuer Aussage und bestehenden Erinnerungen.
 * Es wird NICHTS überschrieben und NICHTS gelöscht – es entsteht nur eine
 * offene, benennbare Beziehung.
 */
export function detectContradictions(
  newText: string,
  memories: { id: string; content: string; topic: string | null }[],
): Contradiction[] {
  const pNew = polarityOf(newText);
  if (pNew === "neutral") return [];
  const newTopics = new Set(topicsOf(newText));
  const out: Contradiction[] = [];
  for (const m of memories) {
    const pOld = polarityOf(m.content);
    if (pOld === "neutral" || pOld === pNew) continue;
    const overlap = similarity(newText, m.content);
    const sharedTopic = m.topic !== null && newTopics.has(m.topic);
    if (overlap < CONTRADICTION_MIN_OVERLAP && !sharedTopic) continue;
    out.push({
      nodeId: m.id,
      memory: m.content,
      overlap,
      polarityOld: pOld,
      polarityNew: pNew,
      reason: `Mögliche Spannung: frühere Aussage ist ${pOld}, neue Aussage ist ${pNew} (Nähe ${overlap.toFixed(2)}).`,
      gap: "ORB kennt beide Aussagen, aber nicht, wie sie zusammenpassen.",
    });
  }
  return out.sort((a, b) => b.overlap - a.overlap);
}

/* ============================================ Umgang mit neuer Information */

export type Handling = "ASK" | "WAIT" | "STORE_ONLY" | "IGNORE";

/**
 * Nicht jede neue Information löst eine Frage aus. Die Reihenfolge der
 * Prüfungen ist die Begründung. „IGNORE“ bedeutet nur: derzeit ohne weitere
 * Bedeutung – gelöscht wird nichts.
 */
export function decideHandling(input: {
  importance: number;
  curiosity: number;
  hasGap: boolean;
  cooldownActive: boolean;
  openQuestion: boolean;
  contradiction?: boolean;
}): { handling: Handling; reason: string } {
  if (input.importance < 0.2 && !input.contradiction) {
    return { handling: "IGNORE", reason: "Information hat derzeit keine weitere Bedeutung." };
  }
  if (!input.hasGap && !input.contradiction) {
    return { handling: "STORE_ONLY", reason: "Nichts offen – ORB merkt sich das nur." };
  }
  if (input.openQuestion) {
    return { handling: "WAIT", reason: "Eine eigene Frage ist noch offen." };
  }
  if (input.cooldownActive) {
    return { handling: "WAIT", reason: "Cooldown nach der letzten eigenen Frage aktiv." };
  }
  if (input.curiosity < 0.35) {
    return { handling: "STORE_ONLY", reason: "Neugier zu gering – nur merken, nicht fragen." };
  }
  return {
    handling: "ASK",
    reason: input.contradiction
      ? "Offener Widerspruch mit ausreichender Neugier."
      : "Offene Lücke mit ausreichender Neugier.",
  };
}

/* ================================================ Zustand aus Kontinuität */

/**
 * Nachvollziehbare Zustandsverschiebung durch Kontinuitätsereignisse.
 * Keine Zufallswerte: jede Änderung hat einen benannten Auslöser.
 */
export function continuityStateShift(input: {
  newThread: boolean;
  reactivatedThread: boolean;
  resolvedThread: boolean;
  contradictions: number;
}): { curiosity: number; uncertainty: number; trust: number; reason: string[] } {
  let curiosity = 0;
  let uncertainty = 0;
  let trust = 0;
  const reason: string[] = [];
  if (input.newThread) {
    curiosity += 0.05;
    reason.push("neuer offener Gedankenfaden");
  }
  if (input.reactivatedThread) {
    curiosity += 0.03;
    reason.push("offener Faden wieder berührt");
  }
  if (input.resolvedThread) {
    uncertainty -= 0.06;
    trust += 0.03;
    reason.push("Gedankenfaden geklärt");
  }
  if (input.contradictions > 0) {
    uncertainty += Math.min(0.12, 0.06 * input.contradictions);
    reason.push("möglicher Widerspruch erkannt");
  }
  return { curiosity, uncertainty, trust, reason };
}
