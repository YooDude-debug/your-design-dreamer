/**
 * ORB Core V0.2 – reine Gedächtnislogik (ohne Datenbank, ohne Netzwerk).
 *
 * Aufgaben dieser Datei:
 *  - Normalisierung von Eingaben (Duplikatvermeidung bei Knoten)
 *  - Themenerkennung (Grundlage des Interessenmodells)
 *  - Relevanzberechnung (Ähnlichkeit × Gewicht × Wichtigkeit × Aktualität)
 *  - drei Gedächtnisebenen A (aktiver Kontext), B (persönlich), C (Langzeit)
 *  - Interessen- und Feedbackberechnung (positiv und negativ)
 *  - Autonomie-Level (Level 3 und 4 sind nur vorbereitet, nicht aktiv)
 *
 * Grundsatz: VERGESSEN ≠ LÖSCHEN. Kein Vorgang hier entfernt eine Erinnerung.
 */

import { clamp01, W_MIN } from "@/orb-core/core";

/* ------------------------------------------------------------------ Autonomie */

export const AUTONOMY_LEVELS = {
  0: "Chat und Lernen",
  1: "Beobachten und Lernen",
  2: "Vorschlagen",
  3: "Teilautonom mit Benutzerbestätigung (vorbereitet, nicht aktiv)",
  4: "Autonome Aktionen (vorbereitet, nicht aktiv)",
} as const;

/** Höchstes in V0.2 aktives Level. */
export const ACTIVE_AUTONOMY_LEVEL = 2;

/**
 * Harte Schranke: der ORB führt keine sozialen Aktionen aus (kein Liken,
 * Kommentieren, Posten, Nachrichten senden, Folgen). Nur lesen und vorschlagen.
 */
export const AUTONOMOUS_SOCIAL_ACTIONS_ENABLED = false;

export function isAutonomyLevelActive(level: number): boolean {
  return level <= ACTIVE_AUTONOMY_LEVEL;
}

/* ------------------------------------------------------- Herkunft / Confidence */

export type OrbInfoSource = "user_stated" | "observed" | "inferred";

/** Grundvertrauen je Herkunft – eine Beobachtung wiegt weniger als eine Aussage. */
export const SOURCE_CONFIDENCE: Record<OrbInfoSource, number> = {
  user_stated: 0.9,
  observed: 0.5,
  inferred: 0.65,
};

export function confidenceFor(source: OrbInfoSource, hints = 1): number {
  const base = SOURCE_CONFIDENCE[source];
  if (source === "user_stated") return base;
  // Mehrere Hinweise erhöhen die Sicherheit, erreichen aber nie eine Aussage.
  return clamp01(Math.min(0.85, base + 0.05 * Math.max(0, hints - 1)));
}

/* --------------------------------------------------------------- Normalisierung */

const STOPWORDS = new Set([
  "ich",
  "du",
  "er",
  "sie",
  "es",
  "wir",
  "ihr",
  "mich",
  "mir",
  "dich",
  "dir",
  "mein",
  "meine",
  "meinen",
  "dein",
  "deine",
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "ein",
  "eine",
  "einen",
  "einem",
  "eines",
  "und",
  "oder",
  "aber",
  "auch",
  "noch",
  "sehr",
  "ganz",
  "schon",
  "mal",
  "doch",
  "denn",
  "weil",
  "dass",
  "ist",
  "bin",
  "sind",
  "war",
  "waren",
  "habe",
  "hab",
  "hat",
  "haben",
  "hatte",
  "werde",
  "wird",
  "wurde",
  "kann",
  "könnte",
  "koennte",
  "will",
  "möchte",
  "moechte",
  "muss",
  "soll",
  "darf",
  "tue",
  "tun",
  "nicht",
  "kein",
  "keine",
  "nichts",
  "mit",
  "ohne",
  "für",
  "fuer",
  "von",
  "vom",
  "zu",
  "zum",
  "zur",
  "auf",
  "in",
  "im",
  "an",
  "am",
  "bei",
  "aus",
  "über",
  "ueber",
  "unter",
  "nach",
  "vor",
  "seit",
  "als",
  "heute",
  "gestern",
  "morgen",
  "jetzt",
  "gerade",
  "immer",
  "oft",
  "manchmal",
  "gern",
  "gerne",
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "have",
  "has",
  "was",
  "are",
  "you",
  "your",
  "from",
]);

/**
 * Allgemeine Bewertungs- und Tätigkeitswörter. Sie beschreiben die Haltung,
 * nicht das Thema, und werden daher nur aus Thema/Interessen herausgehalten.
 * Im Duplikatschlüssel bleiben sie erhalten, damit unterschiedliche
 * Haltungen („mögen“ vs. „essen“) nicht zwanghaft zusammengeführt werden.
 */
const AFFECT_WORDS = new Set([
  "mag",
  "magst",
  "liebe",
  "lieben",
  "hasse",
  "hassen",
  "finde",
  "find",
  "gefällt",
  "gefaellt",
  "interessiere",
  "interessiert",
  "interesse",
  "spannend",
  "toll",
  "super",
  "schön",
  "schoen",
  "esse",
  "essen",
  "trinke",
  "trinken",
  "brauche",
  "brauchen",
  "möchte",
  "moechte",
  "wünsche",
  "like",
  "love",
  "hate",
  "want",
  "need",
  "eat",
  "think",
  "interested",
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Sehr einfache Grundformbildung (nur Endungen, keine Bibliothek). */
function stem(word: string): string {
  let w = word;
  for (const suffix of [
    "innen",
    "enden",
    "ungen",
    "chen",
    "lein",
    "ern",
    "en",
    "er",
    "es",
    "s",
    "n",
  ]) {
    if (w.length - suffix.length >= 4 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w;
}

/** Inhaltswörter einer Eingabe (ohne Füll- und Bewertungswörter), als Grundform. */
export function contentTokens(text: string): string[] {
  const out: string[] = [];
  for (const w of words(text)) {
    if (w.length < 3) continue;
    if (STOPWORDS.has(w) || AFFECT_WORDS.has(w)) continue;
    const s = stem(w);
    if (s.length < 3) continue;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

/* ------------------------------------------------------ Duplikatschlüssel */
/*
 * Der norm_key dient NUR zur konservativen Erkennung offensichtlicher
 * Duplikate. Er darf semantisch unterschiedliche Informationen niemals
 * zwanghaft zusammenführen. Deshalb bleiben im Schlüssel erhalten:
 *  - Verneinungen („Ich mag Pizza“ ≠ „Ich mag keine Pizza“)
 *  - Bewertungs-/Tätigkeitswörter („Pizza essen“ ≠ „Pizza selbst machen“)
 * Bei Unsicherheit gilt: lieber zwei getrennte Knoten als eine falsche
 * Erinnerung. Semantische Verknüpfung erfolgt später über orb_connections.
 */
const NEGATIONS = new Set([
  "nicht",
  "kein",
  "keine",
  "keinen",
  "keinem",
  "keiner",
  "nichts",
  "nie",
  "niemals",
  "not",
  "no",
  "never",
]);

/** Füllwörter für den Schlüssel: wie STOPWORDS, aber Verneinungen bleiben. */
const KEY_STOPWORDS = new Set([...STOPWORDS].filter((w) => !NEGATIONS.has(w)));

/** Schlüsselwörter: Inhalt + Haltung + Verneinung (kanonisch „neg“). */
function keyTokens(text: string): string[] {
  const out: string[] = [];
  for (const w of words(text)) {
    if (w.length < 2) continue;
    if (NEGATIONS.has(w)) {
      if (!out.includes("neg")) out.push("neg");
      continue;
    }
    if (w.length < 3) continue;
    if (KEY_STOPWORDS.has(w)) continue;
    const s = stem(w);
    if (s.length < 3) continue;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

/**
 * Konservativer Duplikatschlüssel: nur bei (nahezu) wortgleichem Inhalt,
 * gleicher Haltung und gleicher Verneinung entsteht derselbe Schlüssel.
 * „Pizza“ ≠ „Pizza mit Ananas“, „Ich mag Pizza“ ≠ „Ich mag keine Pizza“.
 */
export function normKey(text: string): string {
  const tokens = keyTokens(text);
  if (tokens.length === 0) return "";
  return tokens.slice().sort().join("-");
}

/** Ähnlichkeit zweier Texte über ihre Inhaltswörter (0..1). */
export function similarity(a: string, b: string): number {
  const ta = new Set(contentTokens(a));
  const tb = new Set(contentTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hits = 0;
  for (const t of ta) if (tb.has(t)) hits += 1;
  // Jaccard-Mass: Unterschiede bleiben dadurch sichtbar.
  return hits / (ta.size + tb.size - hits);
}

/** Gleiche Erfahrung? Nur bei identischem Schlüssel – keine unscharfe Fusion. */
export function isSameMemory(a: string, b: string): boolean {
  const ka = normKey(a);
  return ka !== "" && ka === normKey(b);
}

/* ------------------------------------------------------------------- Themen */

const TOPIC_KEYWORDS: Record<string, string[]> = {
  hardware: [
    "grafikkart",
    "gpu",
    "cpu",
    "prozessor",
    "mainboard",
    "arbeitsspeich",
    "ram",
    "ssd",
    "hardwar",
    "rechn",
    "pc",
    "computer",
    "laptop",
    "monitor",
    "netzteil",
  ],
  gaming: [
    "gaming",
    "spiel",
    "konsol",
    "playstation",
    "xbox",
    "nintendo",
    "zock",
    "esport",
    "steam",
  ],
  smartphones: ["smartphon", "handy", "iphon", "android", "tablet"],
  programmierung: [
    "programmier",
    "code",
    "softwar",
    "entwickl",
    "javascript",
    "python",
    "datenbank",
    "api",
  ],
  ki: ["künstlich", "kuenstlich", "intelligenz", "modell", "neural", "robot"],
  essen: [
    "pizza",
    "pasta",
    "burg",
    "kochen",
    "koch",
    "restaurant",
    "backen",
    "ananas",
    "käs",
    "kaes",
    "sushi",
    "kaffee",
  ],
  sport: ["sport", "fußball", "fussball", "training", "fitness", "laufen", "joggen", "radfahr"],
  musik: ["musik", "band", "konzert", "gitarr", "klavier", "song", "album"],
  reisen: ["reis", "urlaub", "flug", "hotel", "strand", "berg", "wander"],
  film: ["film", "serie", "kino", "netflix", "anime"],
  auto: ["auto", "motor", "elektroauto", "fahrzeug", "tesla"],
  natur: ["natur", "garten", "pflanz", "tier", "hund", "katz", "wald"],
};

/**
 * Thema einer Erfahrung. Bekannte Schlüsselwörter gewinnen, sonst das erste
 * Inhaltswort (damit auch unbekannte Themen wachsen können).
 */
export function topicOf(text: string): string | null {
  const tokens = contentTokens(text);
  if (tokens.length === 0) return null;
  for (const [topic, keys] of Object.entries(TOPIC_KEYWORDS)) {
    if (tokens.some((t) => keys.some((k) => t.startsWith(k) || k.startsWith(t)))) return topic;
  }
  return tokens[0] ?? null;
}

/** Alle erkennbaren Themen einer Erfahrung (für Feed-Vergleiche). */
export function topicsOf(text: string): string[] {
  const tokens = contentTokens(text);
  const found = new Set<string>();
  for (const [topic, keys] of Object.entries(TOPIC_KEYWORDS)) {
    if (tokens.some((t) => keys.some((k) => t.startsWith(k) || k.startsWith(t)))) found.add(topic);
  }
  for (const t of tokens) found.add(t);
  return [...found];
}

/* ----------------------------------------------------------------- Relevanz */

const HOUR_MS = 3_600_000;

/** Aktualität: 1 = eben, halbiert sich etwa alle 72 Stunden, nie 0. */
export function recencyFactor(lastAccessedAt: number, now: number): number {
  const hours = Math.max(0, (now - lastAccessedAt) / HOUR_MS);
  return Math.max(0.1, Math.exp(-hours / 104));
}

export type RelevanceInput = {
  similarity: number;
  weight: number;
  importance: number;
  lastAccessedAt: number;
  activationCount: number;
  now: number;
};

/**
 * Relevanz = Ähnlichkeit × Gewicht × Wichtigkeit × Aktualität,
 * zusätzlich leicht verstärkt durch häufige Aktivierung.
 */
export function memoryRelevance(input: RelevanceInput): number {
  const sim = clamp01(input.similarity);
  const w = Math.max(W_MIN, Math.min(1, input.weight));
  const imp = 0.5 + 0.5 * clamp01(input.importance);
  const rec = recencyFactor(input.lastAccessedAt, input.now);
  const act = 1 + Math.log10(1 + Math.max(0, input.activationCount)) * 0.3;
  return sim * w * imp * rec * act;
}

/* ---------------------------------------------------------- Gedächtnisebenen */

export type MemoryLevel = "A" | "B" | "C";

export type LeveledMemory = {
  importance: number;
  activationCount: number;
  lastAccessedAt: number;
};

/**
 * Ebene einer Erinnerung:
 *  A – aktiver Kontext (in den letzten Stunden berührt)
 *  B – persönliches Gedächtnis (wichtig oder häufig aktiviert)
 *  C – Langzeitgedächtnis (alt, schwach, selten aktiviert)
 */
export function memoryLevel(m: LeveledMemory, now: number): MemoryLevel {
  const hours = (now - m.lastAccessedAt) / HOUR_MS;
  if (hours <= 6) return "A";
  if (m.importance >= 0.5 || m.activationCount >= 3) return "B";
  return "C";
}

/** Obergrenzen je Ebene – Ebene C wird nur bei Bedarf herangezogen. */
export const LEVEL_LIMITS: Record<MemoryLevel, number> = { A: 4, B: 4, C: 2 };

/**
 * Auswahl des relevanten Teilgraphen: zuerst A, dann B, Ebene C nur, wenn
 * noch Platz im KI-Kontext ist. Verhindert vollständige Graphabfragen.
 */
export function selectByLevel<T extends { level: MemoryLevel; score: number }>(
  candidates: T[],
  limit: number,
): T[] {
  const out: T[] = [];
  for (const level of ["A", "B", "C"] as MemoryLevel[]) {
    const take = candidates
      .filter((c) => c.level === level)
      .sort((a, b) => b.score - a.score)
      .slice(0, LEVEL_LIMITS[level]);
    for (const t of take) {
      if (out.length >= limit) return out;
      out.push(t);
    }
  }
  return out.slice(0, limit);
}

/* --------------------------------------------------------------- Interessen */

export type InterestRow = {
  topic: string;
  weight: number;
  confidence: number;
  source: OrbInfoSource;
  activationCount: number;
};

/** Verstärkung eines Interesses durch eine neue Erfahrung. */
export function interestDelta(source: OrbInfoSource, importance: number): number {
  const base = source === "user_stated" ? 0.18 : source === "inferred" ? 0.08 : 0.05;
  return base * (0.6 + 0.8 * clamp01(importance));
}

/**
 * Interesse fortschreiben. Eine direkte Aussage darf eine Beobachtung
 * aufwerten, aber niemals umgekehrt.
 */
export function nextInterest(
  prev: InterestRow | null,
  input: { topic: string; source: OrbInfoSource; importance: number; delta?: number },
): InterestRow {
  const delta = input.delta ?? interestDelta(input.source, input.importance);
  if (!prev) {
    return {
      topic: input.topic,
      weight: clamp01(Math.max(0.05, delta * 2)),
      confidence: confidenceFor(input.source),
      source: input.source,
      activationCount: 1,
    };
  }
  const rank: Record<OrbInfoSource, number> = { observed: 0, inferred: 1, user_stated: 2 };
  const source = rank[input.source] > rank[prev.source] ? input.source : prev.source;
  return {
    topic: prev.topic,
    // Ein Interesse verschwindet nicht; es wird nur schwächer.
    weight: Math.max(0.02, clamp01(prev.weight + delta)),
    confidence:
      source === "user_stated"
        ? SOURCE_CONFIDENCE.user_stated
        : confidenceFor(source, prev.activationCount + 1),
    source,
    activationCount: prev.activationCount + 1,
  };
}

/** Feedback des Benutzers: positiv verstärkt, negativ schwächt ab (kein Löschen). */
export function feedbackDelta(kind: "positive" | "negative", importance = 0.5): number {
  const strength = 0.1 + 0.2 * clamp01(importance);
  return kind === "positive" ? strength : -strength;
}

/** Gewicht nach Feedback – bleibt immer ≥ W_MIN, wird nie entfernt. */
export function applyFeedbackToWeight(weight: number, delta: number): number {
  return Math.min(1, Math.max(W_MIN, weight + delta));
}

/* ------------------------------------------------------------ Feed-Relevanz */

/** Ab diesem Wert darf ein beobachteter Beitrag vorgeschlagen werden. */
export const SUGGESTION_THRESHOLD = 0.35;

export type FeedMatch = { topic: string; relevance: number };

/**
 * Vergleicht einen beobachteten Beitrag mit dem Interessenmodell.
 * Ergebnis ist immer OBSERVED/INFERRED – niemals eine Aussage des Benutzers.
 */
export function feedRelevance(postText: string, interests: InterestRow[]): FeedMatch | null {
  const topics = new Set(topicsOf(postText));
  const tokens = contentTokens(postText);
  let best: FeedMatch | null = null;
  for (const i of interests) {
    if (!topics.has(i.topic)) continue;
    // Deutlichkeit: wie stark der Beitrag das Thema selbst trifft (max. 3 Treffer).
    const keys = TOPIC_KEYWORDS[i.topic] ?? [i.topic];
    const hits = tokens.filter((t) => keys.some((k) => t.startsWith(k) || k.startsWith(t))).length;
    const coverage = Math.min(1, hits / 3);
    // Interessenstärke und Deutlichkeit gemeinsam – ein klar passender Beitrag
    // erreicht die Schwelle auch bei einem noch jungen Interesse.
    const relevance = clamp01(0.55 * i.weight * i.confidence + 0.45 * coverage);
    if (!best || relevance > best.relevance) best = { topic: i.topic, relevance };
  }
  return best;
}

/** Nachvollziehbare Begründung für den Benutzer (nur für ihn sichtbar). */
export function suggestionReason(topic: string, relevance: number): string {
  return `Dieser Beitrag passt zu deinem Interesse an ${topic} (Relevanz ${relevance.toFixed(2)}). Grundlage sind deine eigenen Erfahrungen im ORB-Gedächtnis.`;
}
