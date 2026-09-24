/**
 * ORB Core – Gesprächsentscheidung (reine Logik, ohne Datenbank und Netzwerk).
 *
 * Diese Datei beantwortet genau eine Frage VOR der Sprachgenerierung:
 *
 *   Welche Art von Beitrag ist jetzt erforderlich – und warum?
 *
 * Grundsatz: ORB soll nicht mehr reden, sondern besser entscheiden, WANN ein
 * eigener Beitrag sinnvoll ist. Es entstehen hier KEINE neuen Gedächtnis-
 * formeln: verwendet werden ausschliesslich Werte, die der bestehende Core
 * bereits berechnet hat (Recall-Rang, Konfidenz, Themen, Zustand, Fäden,
 * bestehende Impuls-/Cooldown-Entscheidung).
 */

export const CONVERSATION_MODES = [
  "DIRECT_ANSWER",
  "FOLLOW_UP",
  "SMALLTALK",
  "PROACTIVE_IMPULSE",
  "LISTEN",
] as const;

export type ConversationMode = (typeof CONVERSATION_MODES)[number];

/**
 * Mindestrang, ab dem ein bereits abgerufener Gedächtnisstrang den aktuellen
 * Gesprächsmoment mitbestimmen darf. Dies ist KEINE Gedächtnisformel: der Rang
 * kommt unverändert aus dem bestehenden Recall-Ranking.
 */
export const MODE_RELEVANCE_MIN = 0.18;

/** Mindestneugier für einen eigenen Anschluss (kein neuer Zustandswert). */
export const FOLLOW_UP_MIN_CURIOSITY = 0.3;

/** Mindestkonfidenz, damit ein Strang einen Anschluss tragen darf. */
export const FOLLOW_UP_MIN_CONFIDENCE = 0.5;

/** Wie viele Gesprächszeilen mindestens vorliegen müssen, damit Smalltalk passt. */
export const SMALLTALK_MIN_CONTEXT = 2;

/** Höchstzahl der Stränge, die den Gesprächsmodus begründen dürfen. */
export const MODE_MAX_STRANDS = 2;

/** Ein bereits abgerufener, belastbarer Gedächtnisstrang. */
export type ConversationStrand = {
  /**
   * P5-A: interne Knoten-ID, nur zur Nachverfolgung. Fliesst in keine
   * Entscheidung und in keinen Modelltext ein.
   */
  id?: string;
  content: string;
  topic: string | null;
  /** Rang aus dem bestehenden Recall-Ranking. */
  relevance: number;
  /** Bestehende Konfidenz des Knotens. */
  confidence: number;
};

/** P5-A: ein ausgewählter Strang mit seiner internen ID (nur Diagnose). */
export type StrandRef = { id: string | null; content: string };

export type ConversationInput = {
  /** Aktuelle Nutzereingabe. */
  text: string;
  /** Themen der aktuellen Eingabe (bestehende Themenerkennung). */
  conversationTopics: string[];
  /** Bereits abgerufene, belastbare Stränge – keine Vollabfrage. */
  strands: ConversationStrand[];
  /** Zustandswerte aus dem bestehenden `OrbState`. */
  curiosity: number;
  energy: number;
  /** Anzahl Zeilen im flüchtigen Gesprächskontext. */
  contextMessages: number;
  /** Offener Gedankenfaden, den die bestehende Logik freigegeben hat. */
  resumeThread: { title: string; unknown: string[] } | null;
  /**
   * Hat der bestehende Impulspfad (Curiosity/Presence inkl. Cooldowns) einen
   * echten eigenen Impuls erlaubt? Wird hier nur gelesen, nie umgangen.
   */
  impulseAllowed: boolean;
  /** Ausdrückliche Merk-Aufforderung wurde aufgelöst. */
  explicitLearning: boolean;
};

export type ConversationPlan = {
  mode: ConversationMode;
  /** Nachvollziehbare Begründung – keine zufällige Auswahl. */
  reason: string;
  /** Nur die Stränge, die diesen Gesprächsmoment tatsächlich betreffen. */
  relevantStrands: string[];
  /**
   * P5-A: dieselben Stränge in derselben Reihenfolge, je Objekt mit ID.
   * `relevantStrands[i] === relevantStrandRefs[i].content` gilt immer.
   */
  relevantStrandRefs: StrandRef[];
  /** Thema des Anschlusses, falls vorhanden. */
  focusTopic: string | null;
};

/* ----------------------------------------------------- Art der Nutzereingabe */

const REQUEST_PATTERNS: RegExp[] = [
  /\?/,
  /^\s*(?:wer|was|wann|wo|wie|warum|wieso|weshalb|welche[rnms]?|wem|wen|wieviel|wie viel)\b/i,
  // Umlaute sind keine ASCII-Wortzeichen: deshalb kein \b am Wortende.
  /(?:^|\s)(?:erklär|erklaer|sag mir|zeig mir|nenne mir|gib mir|beschreib|rechne|vergleich|liste)/i,
  /(?:^|\s)(?:weisst|weißt) du/i,
  /(?:^|\s)(?:kannst|könntest) du/i,
];

/** Braucht die Eingabe eine konkrete Antwort oder Information? */
export function needsDirectAnswer(text: string): boolean {
  return REQUEST_PATTERNS.some((re) => re.test(text));
}

const SMALLTALK_PATTERNS: RegExp[] = [
  /^\s*(?:hi|hey|hallo|moin|servus|guten (?:morgen|tag|abend)|na)\b/i,
  /\b(?:mir geht'?s|geht mir|bin (?:müde|fit|wach|kaputt|erledigt))\b/i,
  /\b(?:danke|alles klar|okay|ok|passt|schön|cool)\b\s*$/i,
];

/** Kurzer sozialer Gesprächsbeitrag ohne Informationsbedarf. */
export function isSmallTalkOpening(text: string): boolean {
  return SMALLTALK_PATTERNS.some((re) => re.test(text.trim()));
}

/* ------------------------------------------------------- Strang-Relevanz */

/**
 * Ein Strang ist nur relevant, wenn er thematisch an die aktuelle Eingabe
 * anschliesst ODER im bestehenden Recall-Ranking ausreichend hoch liegt.
 * Ein starker, aber themenfremder Strang bleibt aussen vor – er darf niemals
 * allein einen eigenen Gesprächsimpuls auslösen.
 */
export function isRelevantStrand(
  strand: ConversationStrand,
  conversationTopics: string[],
): boolean {
  const topicMatch = strand.topic !== null && conversationTopics.includes(strand.topic);
  return topicMatch || strand.relevance >= MODE_RELEVANCE_MIN;
}

/** Nur relevante Stränge, nach bestehendem Rang sortiert und hart begrenzt. */
export function selectRelevantStrands(input: {
  strands: ConversationStrand[];
  conversationTopics: string[];
}): ConversationStrand[] {
  return input.strands
    .filter((s) => isRelevantStrand(s, input.conversationTopics))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, MODE_MAX_STRANDS);
}

/* ---------------------------------------------------------- Entscheidung */

/**
 * Bestimmt den Gesprächsmodus. Die Reihenfolge der Regeln ist die Begründung.
 * Eine Nutzerfrage hat immer Vorrang; ohne eigenen Grund bleibt es bei LISTEN.
 */
export function decideConversationMode(input: ConversationInput): ConversationPlan {
  const relevant = selectRelevantStrands(input);
  const relevantStrands = relevant.map((s) => s.content);
  const relevantStrandRefs: StrandRef[] = relevant.map((s) => ({
    id: s.id ?? null,
    content: s.content,
  }));
  const focusTopic = relevant.find((s) => s.topic !== null)?.topic ?? null;

  const plan = (mode: ConversationMode, reason: string): ConversationPlan => ({
    mode,
    reason,
    // LISTEN begründet keinen eigenen Beitrag – dann geht auch kein Strang mit.
    relevantStrands: mode === "LISTEN" ? [] : relevantStrands,
    relevantStrandRefs: mode === "LISTEN" ? [] : relevantStrandRefs,
    focusTopic: mode === "LISTEN" ? null : focusTopic,
  });

  // 1. Konkreter Informationsbedarf – nie eine unnötige Rückfrage.
  if (needsDirectAnswer(input.text)) {
    return plan("DIRECT_ANSWER", "Der Nutzer braucht eine konkrete Antwort.");
  }

  // 2. Ausdrückliche Merk-Aufforderung: knapp bestätigen, nicht nachfragen.
  if (input.explicitLearning) {
    return plan("DIRECT_ANSWER", "Ausdrückliche Merk-Aufforderung – knappe Bestätigung.");
  }

  // 3. Bestehender Impulspfad hat bereits entschieden (inkl. Cooldowns).
  if (input.impulseAllowed) {
    return plan("PROACTIVE_IMPULSE", "Der bestehende Impulspfad erlaubt einen eigenen Impuls.");
  }

  // 4. Konkreter Anschluss aus einem relevanten Strang oder offenen Faden.
  const carrier = relevant.find((s) => s.confidence >= FOLLOW_UP_MIN_CONFIDENCE) ?? null;
  const threadOpen = input.resumeThread !== null && input.resumeThread.unknown.length > 0;
  if (
    input.curiosity >= FOLLOW_UP_MIN_CURIOSITY &&
    input.energy >= 0.12 &&
    (carrier !== null || threadOpen)
  ) {
    return plan(
      "FOLLOW_UP",
      threadOpen
        ? "Offener Gedankenfaden mit konkretem Anschluss."
        : "Relevanter aktueller Gedächtnisstrang mit konkretem Anschluss.",
    );
  }

  // 5. Echter kurzer Smalltalk – nur mit vorhandenem Gesprächsanschluss.
  if (
    input.contextMessages >= SMALLTALK_MIN_CONTEXT &&
    input.energy >= 0.12 &&
    (isSmallTalkOpening(input.text) || input.conversationTopics.length > 0)
  ) {
    return plan("SMALLTALK", "Kurzer natürlicher Gesprächsanschluss ohne Informationsbedarf.");
  }

  // 6. Kein eigener Beitrag: bewusstes Nicht-Eingreifen, kein Fehler.
  return plan("LISTEN", "Kein belegbarer eigener Beitrag – ORB hört zu.");
}

/** Sprachanweisung je Modus – das LLM formuliert nur noch das WIE. */
export const MODE_HINT: Record<ConversationMode, string> = {
  DIRECT_ANSWER: "Beantworte die Eingabe knapp und konkret. Stelle keine unnötige Rückfrage.",
  FOLLOW_UP:
    "Knüpfe mit genau einer kurzen, konkreten Rückfrage an den genannten Zusammenhang an. Erfinde keinen neuen Zusammenhang.",
  SMALLTALK:
    "Antworte mit einem einzigen kurzen, natürlichen Satz. Keine Frage, wenn es keinen inhaltlichen Grund gibt.",
  PROACTIVE_IMPULSE:
    "Bringe deinen eigenen inhaltlichen Impuls in einem kurzen Satz oder einer kurzen Frage ein.",
  LISTEN:
    "Antworte mit höchstens einem kurzen Satz und stelle keine Frage – du hast gerade keinen eigenen Beitrag.",
};
