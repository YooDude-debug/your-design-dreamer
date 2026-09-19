/**
 * ORB Core – Kernpräsenz (proaktive Neugier), reine Logik.
 *
 * Diese Datei enthält KEINE Datenbank- und keine Netzwerkzugriffe. Sie
 * beantwortet nur zwei Fragen aus dem bestehenden ORB-Zustand:
 *
 *   1. Darf der ORB gerade von sich aus etwas fragen?  → shouldAskProactively
 *   2. Wonach möchte er fragen?                        → selectProactiveCandidate
 *
 * Grundsatz: Der ORB spricht nicht, weil ein Timer abgelaufen ist. 40 Sekunden
 * sind nur die früheste erlaubte Zeit. Ohne ausreichende Neugier und ohne
 * relevanten Gedächtnisbezug bleibt der ORB still.
 *
 * Es wird keine zweite Curiosity-Variable eingeführt: verwendet wird
 * ausschliesslich `curiosity` aus dem bestehenden `OrbState`.
 */

import { clamp01 } from "@/lib/orb-core";
import { contentTokens, recencyFactor, type InterestRow } from "@/lib/orb-memory";

/* --------------------------------------------------------------- Zeitgrenzen */

/** Früheste erlaubte Zeit ohne Benutzereingabe (kein Zwangsintervall). */
export const PROACTIVE_MIN_IDLE_MS = 40_000;

/**
 * War der Benutzer sehr lange untätig, wird nicht nachträglich gefragt –
 * eine Frage nach langer Abwesenheit wirkt nicht wie Präsenz, sondern wie Spam.
 */
export const PROACTIVE_MAX_IDLE_MS = 15 * 60_000;

/* ------------------------------------------------------- Neugier-Schwellen */

export type CuriosityBand = "low" | "medium" | "high" | "very_high";

/** Schwellenwerte der bestehenden Zustandsgrösse `curiosity`. */
export const CURIOSITY_MEDIUM = 0.35;
export const CURIOSITY_HIGH = 0.55;
export const CURIOSITY_VERY_HIGH = 0.75;

export function curiosityBand(curiosity: number): CuriosityBand {
  const c = clamp01(curiosity);
  if (c >= CURIOSITY_VERY_HIGH) return "very_high";
  if (c >= CURIOSITY_HIGH) return "high";
  if (c >= CURIOSITY_MEDIUM) return "medium";
  return "low";
}

/** Bei geringer Neugier fragt der ORB nicht. */
export function mayAskAtCuriosity(curiosity: number): boolean {
  return curiosityBand(curiosity) !== "low";
}

/** Cooldown nach einer proaktiven Frage (2–5 Minuten, je nach Neugier). */
export const PROACTIVE_COOLDOWN_MS: Record<CuriosityBand, number> = {
  low: 300_000,
  medium: 300_000,
  high: 180_000,
  very_high: 120_000,
};

/** Mindestsicherheit einer Erinnerung, damit daraus gefragt werden darf. */
export const PROACTIVE_MIN_CONFIDENCE = 0.5;

/** Mindestgewicht eines Interesses, damit es eine Frage tragen darf. */
export const PROACTIVE_MIN_INTEREST_WEIGHT = 0.1;

/* ------------------------------------------------------------- Entscheidung */

export type ProactiveContext = {
  /** Zeit seit der letzten Benutzeraktivität in Millisekunden. */
  idleMs: number;
  /** Bestehender Zustandswert `curiosity`. */
  curiosity: number;
  /** Benutzer tippt gerade. */
  typing: boolean;
  /** ORB spricht gerade (TTS läuft). */
  speaking: boolean;
  /** Mikrofonaufnahme läuft. */
  listening: boolean;
  /** Eine Anfrage (Antwort oder proaktive Frage) ist in Bearbeitung. */
  pending: boolean;
  /** Browser-Tab ist sichtbar. */
  tabVisible: boolean;
  /** Es gibt einen relevanten Gedächtnisbezug. */
  hasCandidate: boolean;
  /** Zeitpunkt der letzten proaktiven Frage (ms) oder null. */
  lastProactiveAt: number | null;
  now: number;
};

export type ProactiveVerdict = {
  ask: boolean;
  reason: string;
  band: CuriosityBand;
};

/**
 * Entscheidet, ob der ORB jetzt selbstständig fragen darf. Die Reihenfolge der
 * Prüfungen ist die Begründung – jede Ablehnung ist benennbar.
 */
export function shouldAskProactively(ctx: ProactiveContext): ProactiveVerdict {
  const band = curiosityBand(ctx.curiosity);
  const no = (reason: string): ProactiveVerdict => ({ ask: false, reason, band });

  if (!ctx.tabVisible) return no("Tab nicht aktiv – keine proaktive Frage.");
  if (ctx.typing) return no("Benutzer tippt gerade.");
  if (ctx.listening) return no("Mikrofon ist aktiv.");
  if (ctx.speaking) return no("ORB spricht gerade.");
  if (ctx.pending) return no("Eine Anfrage ist bereits in Bearbeitung.");
  if (ctx.idleMs < PROACTIVE_MIN_IDLE_MS) {
    return no("Früheste erlaubte Zeit (40 s) noch nicht erreicht.");
  }
  if (ctx.idleMs > PROACTIVE_MAX_IDLE_MS) {
    return no("Benutzer war lange abwesend – keine nachträgliche Frage.");
  }
  if (band === "low") return no("Neugier zu gering – ORB bleibt still.");
  if (!ctx.hasCandidate) return no("Kein relevanter Gedächtnisbezug – keine generische Frage.");
  if (ctx.lastProactiveAt !== null) {
    const waited = ctx.now - ctx.lastProactiveAt;
    if (waited < PROACTIVE_COOLDOWN_MS[band]) return no("Cooldown nach der letzten Frage aktiv.");
  }
  return { ask: true, reason: `Neugier ${band} und relevanter Kontext vorhanden.`, band };
}

/* ------------------------------------------------- Frageziel (Lernwert) */

/** Dimensionen, in die eine Frage das Gedächtnis erweitern kann. */
export const PROACTIVE_DIMENSIONS = [
  "nutzung",
  "praeferenz",
  "ziel",
  "erfahrung",
  "meinung",
  "kontext",
] as const;

export type ProactiveDimension = (typeof PROACTIVE_DIMENSIONS)[number];

/** Anweisung an die Sprachschicht – die Frage bleibt inhaltlich gebunden. */
export const DIMENSION_HINT: Record<ProactiveDimension, string> = {
  nutzung: "Frage, wofür der Benutzer das konkret nutzt.",
  praeferenz: "Frage nach einer konkreten Vorliebe innerhalb dieses Themas.",
  ziel: "Frage, was der Benutzer damit erreichen möchte.",
  erfahrung: "Frage nach einer konkreten Erfahrung damit.",
  meinung: "Frage nach der Einschätzung des Benutzers dazu.",
  kontext: "Frage nach dem konkreten Zusammenhang oder Umfeld.",
};

export type ProactiveMemory = {
  id: string;
  content: string;
  topic: string | null;
  importance: number;
  confidence: number;
  activationCount: number;
  /** Zeitpunkt des letzten Zugriffs in Millisekunden. */
  lastAccessedAt: number;
};

export type ProactiveCandidate = {
  nodeId: string;
  memory: string;
  topic: string;
  dimension: ProactiveDimension;
  confidence: number;
  interestWeight: number;
  score: number;
};

export type CandidateInput = {
  /** Nur bereits geladene, relevante Erinnerungen – keine Vollabfrage. */
  memories: ProactiveMemory[];
  interests: InterestRow[];
  /** Bereits gestellte proaktive Fragen (Thema + Dimension). */
  asked: { topic: string; dimension: ProactiveDimension }[];
  now: number;
};

/** Erste noch nicht gestellte Dimension zu einem Thema. */
export function nextDimension(
  topic: string,
  asked: { topic: string; dimension: ProactiveDimension }[],
): ProactiveDimension | null {
  const used = new Set(asked.filter((a) => a.topic === topic).map((a) => a.dimension));
  return PROACTIVE_DIMENSIONS.find((d) => !used.has(d)) ?? null;
}

/**
 * Wählt den besten Gedächtnisbezug für eine proaktive Frage.
 * Ohne ausreichend sichere, thematisch verankerte Erinnerung gibt es kein
 * Ergebnis – der ORB stellt dann keine generische Frage.
 */
export function selectProactiveCandidate(input: CandidateInput): ProactiveCandidate | null {
  const interestByTopic = new Map(input.interests.map((i) => [i.topic, i]));
  let best: ProactiveCandidate | null = null;

  for (const m of input.memories) {
    if (!m.topic) continue;
    if (m.confidence < PROACTIVE_MIN_CONFIDENCE) continue;
    // Eine Frage braucht inhaltliche Substanz, nicht nur ein Füllwort.
    if (contentTokens(m.content).length === 0) continue;

    const interest = interestByTopic.get(m.topic) ?? null;
    const interestWeight = interest ? interest.weight * interest.confidence : 0;
    if (interest && interest.weight < PROACTIVE_MIN_INTEREST_WEIGHT) continue;

    const dimension = nextDimension(m.topic, input.asked);
    if (!dimension) continue;

    const score =
      clamp01(m.importance) *
      clamp01(m.confidence) *
      (0.5 + 0.5 * clamp01(interestWeight)) *
      recencyFactor(m.lastAccessedAt, input.now) *
      (1 + Math.min(0.3, 0.1 * m.activationCount));

    if (!best || score > best.score) {
      best = {
        nodeId: m.id,
        memory: m.content,
        topic: m.topic,
        dimension,
        confidence: m.confidence,
        interestWeight,
        score,
      };
    }
  }
  return best;
}

/**
 * Harte Grenze der Kernpräsenz: der ORB spricht nur im eigenen ORB-Core-Chat.
 * Keine Posts, Likes, Kommentare, Nachrichten an andere oder Follows.
 */
export const PROACTIVE_SCOPE = "orb_core_chat_only" as const;
export const PROACTIVE_SOCIAL_ACTIONS_ENABLED = false;

/* ------------------------------------- Interne Zustände ≠ Benutzermeldung */

/**
 * Nur `ASK` erzeugt eine sichtbare Nachricht. `WAIT` und `DO_NOTHING` sind
 * reine Steuerwerte und dürfen nie als Text beim Benutzer erscheinen.
 */
export function presenceProducesUserMessage(action: "DO_NOTHING" | "WAIT" | "ASK"): boolean {
  return action === "ASK";
}

/**
 * Formulierungen, die einen Zustand behaupten, den ORB technisch nicht hat:
 * Pause, Beschäftigung, Hintergrundarbeit, vorübergehende Nichtverfügbarkeit.
 */
export const FAKE_PAUSE_PATTERNS: RegExp[] = [
  /\b(?:brauche|mache|nehme)\s+(?:gerade\s+|noch\s+|kurz\s+)*(?:eine\s+|eine kurze\s+)?pause\b/i,
  /\bmeine pause\b/i,
  /\bbin (?:gerade|momentan|kurz) (?:nicht verfügbar|beschäftigt|müde|weg)\b/i,
  /\b(?:ich )?arbeite gerade\b/i,
  /\bbin (?:gleich|bald) wieder (?:da|bereit)\b/i,
  /\bbrauche (?:noch )?(?:einen|kurz einen) moment\b/i,
];

/** Wahre Erklärung des internen Zustands – ohne vorgetäuschte Pause. */
export const HONEST_PRESENCE_EXPLANATION =
  "Ich mache keine echte Pause – das ist nur ein interner Zustandswert. " +
  "Ich antworte dir jederzeit; von mir aus frage ich nur dann etwas, wenn ich hier im ORB-Chat einen inhaltlichen Grund dazu habe.";

/** Behauptet der Text eine Pause oder Nichtverfügbarkeit, die es nicht gibt? */
export function claimsFakePause(text: string): boolean {
  return FAKE_PAUSE_PATTERNS.some((re) => re.test(text));
}

/**
 * Letzte Schutzschicht der Sprachschicht: eine erfundene Pause wird durch die
 * technische Wahrheit ersetzt. Alle anderen Antworten bleiben unverändert.
 */
export function stripFakePauseClaim(reply: string): string {
  return claimsFakePause(reply) ? HONEST_PRESENCE_EXPLANATION : reply;
}
