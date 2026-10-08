/**
 * ORB Core – Phase 6: semantische Bedeutung einer Erinnerung (reine Logik,
 * keine DB, kein Modellaufruf, keine eigene Engine).
 *
 * semanticType = WAS für eine Information ist es. significance = Startpriorität
 * daraus. Beides ersetzt NICHT importance, frequency, durability, currentness
 * oder confidence – es ist eine zusätzliche, getrennte Dimension.
 * Kette: Bedeutung → bestehende Importance/Relevanz → Retrieval → Usage
 * Evidence → Lifecycle. Persistenz von semanticType ist für Phase 4B vorbereitet.
 */

export type SemanticType =
  | "identity"
  | "relationship"
  | "preference"
  | "interest"
  | "skill_role"
  | "project_goal"
  | "life_context"
  | "episodic"
  | "unknown";

/** Startpriorität (Priorisierungshilfe, keine Wahrheit, ersetzt nie importance). */
export const SEMANTIC_SIGNIFICANCE: Record<SemanticType, number> = {
  identity: 0.95,
  relationship: 0.9,
  skill_role: 0.75,
  project_goal: 0.75,
  life_context: 0.65,
  preference: 0.5,
  interest: 0.5,
  episodic: 0.2,
  unknown: 0.3,
};

const EPISODIC = /\b(heute|gestern|vorhin|gerade|letzte[nrms]?\s+(woche|nacht)|neulich|eben)\b/i;
const RULES: [Exclude<SemanticType, "unknown" | "episodic">, RegExp][] = [
  ["identity", /\b(ich\s+hei(ß|ss)e|mein\s+name\s+ist|nenn\s+mich)\b/i],
  [
    "relationship",
    /\b(meine?\s+(frau|ehefrau|mann|ehemann|partner(in)?|freundin|freund|kinder?|sohn|tochter|söhne|töchter|mutter|vater|eltern|familie|bruder|schwester)|ich\s+habe\s+(\w+\s+)?(kinder|kind|söhne|töchter|sohn|tochter))\b/i,
  ],
  [
    "project_goal",
    /\b(orb(\s+core)?|y-?dude|mein\s+(ziel|projekt)|ich\s+(baue|habe\s+.*gebaut|entwickle))\b/i,
  ],
  [
    "skill_role",
    /\b(ich\s+bin\s+(\w+\s+)?(koch|köchin|entwickler(in)?|programmierer(in)?|ingenieur(in)?|lehrer(in)?|arzt|ärztin)|ich\s+arbeite\s+als|mein\s+beruf)\b/i,
  ],
  ["life_context", /\b(ich\s+wohne|ich\s+lebe\s+in|wir\s+wohnen|umgezogen)\b/i],
  ["interest", /\b(ich\s+spiele|fortnite|minecraft|zocke|mein\s+hobby|hobbys?)\b/i],
  [
    "preference",
    /\b(ich\s+(esse|trinke|mag|liebe|hasse)\s+gerne?|ich\s+esse\s+gern|lieblings\w+|ich\s+mag)\b/i,
  ],
];

/**
 * Bedeutungsklasse einer Nutzeraussage. Nur explizite Satzmuster zählen;
 * kein Treffer ⇒ `unknown`. Einmalige Ereignisse mit Zeitwort ⇒ `episodic`,
 * außer bei Identität/Beziehung.
 */
export function semanticTypeOf(text: string): SemanticType {
  const t = (text ?? "").trim();
  if (!t) return "unknown";
  const hit = RULES.find(([, re]) => re.test(t))?.[0];
  if (hit === "identity" || hit === "relationship") return hit;
  if (EPISODIC.test(t)) return "episodic";
  return hit ?? "unknown";
}

/** Zieltyp einer Nutzerfrage für die Abrufpriorisierung (sonst null). */
export function questionSemanticType(question: string): SemanticType | null {
  const q = (question ?? "").toLowerCase();
  if (!q.includes("?") && !/^\s*(wie|was|warum|wer|wo)\b/.test(q)) return null;
  if (/\bwie\s+hei(ß|ss)e\s+ich|mein\s+name\b/.test(q)) return "identity";
  if (/\b(familie|frau|kinder|mann|partner)\b/.test(q)) return "relationship";
  if (/\bwas\s+(esse|trinke|mag)\s+ich\b/.test(q)) return "preference";
  if (/\bwas\s+spiele\s+ich|hobby/.test(q)) return "interest";
  if (/\bberuflich|beruf|was\s+arbeite\s+ich\b/.test(q)) return "skill_role";
  if (/\b(orb|y-?dude|projekt|ziel)\b/.test(q)) return "project_goal";
  if (/\bwo\s+wohne\s+ich\b/.test(q)) return "life_context";
  return null;
}

/**
 * Sortiert vorhandene Kandidaten: passender Bedeutungstyp zuerst, danach die
 * unveränderte bestehende Relevanz, dann id. Erfindet keine Kandidaten.
 */
export function prioritizeBySemantic<T extends { id: string; content: string; relevance: number }>(
  question: string,
  candidates: readonly T[],
): T[] {
  const want = questionSemanticType(question);
  const match = (c: T) => (want && semanticTypeOf(c.content) === want ? 1 : 0);
  return [...candidates].sort(
    (a, b) => match(b) - match(a) || b.relevance - a.relevance || (a.id < b.id ? -1 : 1),
  );
}

/**
 * Wählt die Quell-Erinnerung für eine Nachfrage: Gesprächsthema vor Lücke vor
 * Bedeutung. Ohne Themenbezug zum aktuellen Gespräch ⇒ keine Nachfrage (null).
 */
export function pickFollowUpSource<
  T extends { id: string; topic: string | null; content: string; gapScore: number },
>(conversationTopics: readonly string[], candidates: readonly T[]): T | null {
  const topics = new Set(conversationTopics);
  const onTopic = candidates.filter((c) => c.topic !== null && topics.has(c.topic));
  if (onTopic.length === 0) return null;
  const sig = (c: T) => SEMANTIC_SIGNIFICANCE[semanticTypeOf(c.content)];
  return [...onTopic].sort(
    (a, b) => b.gapScore - a.gapScore || sig(b) - sig(a) || (a.id < b.id ? -1 : 1),
  )[0];
}

export type Provenance = "confirmed" | "inferred" | "unknown";

/** Pflicht-Einleitung je Herkunft – eine Ableitung wird nie als Fakt formuliert. */
export function provenancePrefix(p: Provenance): string {
  if (p === "confirmed") return "Du hast mir gesagt, dass";
  if (p === "inferred") return "Meine Vermutung ist";
  return "Das weiß ich nicht sicher.";
}

/**
 * Leitet aus einer Aussage nur ihren eigenen Typ ab. Es entstehen keine
 * Zusatzbehauptungen über andere Personen oder allgemeine Werte.
 */
export function derivedClaims(_text: string): string[] {
  return [];
}

/** Prompt-Regel (wird in die bestehende Kontinuitätsregel eingefügt). */
export const SEMANTIC_ANSWER_RULE = [
  "Formuliere gespeicherte Nutzeraussagen als „Du hast mir gesagt, dass …“, eigene Ableitungen als „Meine Vermutung ist …“ und Unbekanntes als „Das weiß ich nicht sicher.“; eine Ableitung nie als Fakt.",
  "Leite aus einer Aussage über eine Person keine Vorlieben oder Werte einer anderen Person oder allgemeine Prioritäten ab.",
  "Über deine eigene Architektur sprich zurückhaltend: Du bist darauf ausgelegt, Erinnerungen nach Bedeutung, Nutzung, Aktualität und Lebenszyklus unterschiedlich zu behandeln; behaupte keine Überlegenheit gegenüber anderen Agenten und keine bereits vollständig dauerhaft umgesetzte Vergessens-, Ruhe- oder Widerspruchsverarbeitung.",
].join(" ");
