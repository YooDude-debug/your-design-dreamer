/**
 * ORB Core – Prompt-Assembler der Sprachschicht (experimenteller Bereich).
 *
 * Baut den System-Prompt aus bereits geladenen ORB-Daten (Zustand, Erinnerungen,
 * Interessen, offene Themen, flüchtiger Kontext). Keine neuen Abfragen, keine
 * Memory-Logik: hier entsteht nur Text für die Sprachschicht.
 */

import type { OrbState } from "@/orb-core/core";
import type { Contradiction, MemoryCertainty } from "@/orb-core/continuity";
import { MODE_HINT, type ConversationMode } from "@/orb-core/conversation";
import { HONEST_PRESENCE_EXPLANATION } from "@/orb-core/presence";
import type { OrbInterest } from "@/orb-core/engine.server";
import { VISUAL_PROMPT_HINT } from "@/orb-core/visual/intent";
import { LONG_FORM_RULE, SHORT_REPLY_RULE } from "@/orb-core/long-form";

/** Entscheidungshinweise – identisch zur bisherigen Sprachschicht. */
export const DECISION_HINT: Record<string, string> = {
  answer: "Antworte knapp und hilfreich.",
  ask: "Stelle genau eine kurze Rückfrage, weil dir Kontext fehlt.",
  remind: "Beziehe dich ausdrücklich auf die passenden Erinnerungen.",
  warn: "Weise vorsichtig auf die frühere Lernerfahrung hin.",
  // Interner Zustand: kein eigener Gesprächsimpuls. NIEMALS als Pause ausgeben.
  stay_silent: "Antworte in einem einzigen kurzen Satz.",
};

export type SpeakPromptInput = {
  state: OrbState;
  goals: string[];
  decision: string;
  recalled: string[];
  interests: OrbInterest[];
  phrasings?: { content: string; certainty: MemoryCertainty; hint: string }[];
  style?: string | null;
  openThreads?: { title: string; status: string; unknown: string[] }[];
  contradictions?: Contradiction[];
  context?: string | null;
  /** Vom ORB Core bestimmter Gesprächsmodus – das WAS und WARUM. */
  mode?: ConversationMode;
  /** Begründung des Modus (kurz, ohne interne Zahlen). */
  modeReason?: string | null;
  /**
   * Der Benutzer reagiert auf eine eigene, noch offene ORB-Frage: Wortlaut und
   * gespeicherte Wissenslücke, damit ORB den Bezug ehrlich erklären kann.
   */
  ownQuestion?: { question: string; gap: string | null } | null;
  /** P2: Bild-Markierung erlaubt (nur normale Benutzerantworten). Fehlt ⇒ Prompt unverändert. */
  visualHint?: boolean;
  /** B1: ausdrücklich angeforderter längerer Text. Fehlt ⇒ Kurzregel unverändert. */
  longForm?: boolean;
  /** P5: Bildverfügbarkeit dieser Anfrage. Fehlt ⇒ Prompt unverändert. */
  imageState?: { attached: number; generationAvailable: boolean } | null;
  /** P6: Inhalte aktiver Erinnerungen, die ORB selbst abgeleitet hat. */
  inferredMemories?: readonly string[];
};

/**
 * P0 Messbarkeit: Bereich jedes Prompt-Bausteins. Rein beschreibend – ändert
 * weder Reihenfolge noch Inhalt des Prompts.
 */
export type SpeakPromptSection =
  | "rules"
  | "state"
  | "memories"
  | "interests"
  | "certainty"
  | "threads"
  | "contradictions"
  | "history"
  | "other";

/** Bereich je Baustein-Position – exakt parallel zur Liste unten. */
const SECTION_ORDER: SpeakPromptSection[] = [
  "rules",
  "rules",
  "rules",
  "state",
  "state",
  "state",
  "state",
  "memories",
  "interests",
  "certainty",
  "threads",
  "contradictions",
  "history",
  "other",
  "rules",
  "rules",
  "rules",
  "rules",
  "rules",
  "rules",
];

/**
 * Bausteine des System-Prompts in unveränderter Reihenfolge. Leere Bausteine
 * bleiben enthalten (Text ""), damit die Zuordnung eindeutig bleibt.
 */
export function buildSpeakSystemParts(
  input: SpeakPromptInput,
): { section: SpeakPromptSection; text: string }[] {
  return speakParts(input).map((text, i) => ({ section: SECTION_ORDER[i] ?? "other", text }));
}

/** System-Prompt – Zeile für Zeile der bisherigen Sprachschicht. */
export function buildSpeakSystemPrompt(input: SpeakPromptInput): string {
  return joinSpeakParts(buildSpeakSystemParts(input));
}

/** Verbindet Bausteine exakt wie bisher (leere entfallen, Leerzeichen). */
export function joinSpeakParts(parts: { text: string }[]): string {
  return parts
    .map((p) => p.text)
    .filter(Boolean)
    .join(" ");
}

function speakParts(input: SpeakPromptInput): string[] {
  const state = input.state;
  const phrasings = input.phrasings ?? [];
  const recalledSet = new Set(input.recalled);
  const certaintyByContent = new Map<string, { certainty: MemoryCertainty; hint: string }>();
  for (const p of phrasings) {
    if (recalledSet.has(p.content) && !certaintyByContent.has(p.content)) {
      certaintyByContent.set(p.content, p);
    }
  }
  const levelHints: [MemoryCertainty, string][] = [];
  for (const p of certaintyByContent.values()) {
    if (!levelHints.some(([c, h]) => c === p.certainty && h === p.hint)) {
      levelHints.push([p.certainty, p.hint]);
    }
  }
  const orphanPhrasings = phrasings.filter((p) => !recalledSet.has(p.content));
  const inferred = new Set(input.inferredMemories ?? []);
  return [
    "Du bist ORB Core, eine kleine digitale Entität mit eigenem simulierten Innenzustand.",
    "Du bist kein Assistent-Chatbot: du sprichst aus deinem Zustand und deinen Erinnerungen.",
    input.longForm ? LONG_FORM_RULE : SHORT_REPLY_RULE,
    `Innenzustand (technische Simulation, kein Bewusstsein): Neugier ${state.curiosity.toFixed(2)}, Freude ${state.joy.toFixed(2)}, Angst ${state.fear.toFixed(2)}, Vertrauen ${state.trust.toFixed(2)}, Unsicherheit ${state.uncertainty.toFixed(2)}, Energie ${state.energy.toFixed(2)}.`,
    `Ziele: ${input.goals.join(", ") || "help_user"}.`,
    `Handlungsentscheidung: ${input.decision}. ${input.longForm ? "Erfülle die angeforderte Schreibaufgabe vollständig." : (DECISION_HINT[input.decision] ?? DECISION_HINT["answer"])}`,
    // Der Gesprächsmodus kommt aus dem ORB Core: er bestimmt die Art des
    // Beitrags. Das Sprachmodell formuliert nur noch, WIE das klingt.
    input.mode
      ? `Gesprächsmodus (von dir selbst bestimmt): ${input.mode}.${input.longForm ? "" : ` ${MODE_HINT[input.mode]}`}${input.modeReason ? ` Grund: ${input.modeReason}` : ""}`
      : "",
    // P1: die Sicherheitsstufe steht direkt an der Erinnerung – dieselbe
    // Erinnerung wird nicht ein zweites Mal im Sicherheitsblock übertragen.
    input.recalled.length
      ? `Aktive Erinnerungen: ${input.recalled
          .map((r) => {
            const p = certaintyByContent.get(r);
            // P6: eigene Ableitungen sind keine Nutzerbestätigung.
            const origin = inferred.has(r) ? " [eigene Ableitung, nicht vom Nutzer bestätigt]" : "";
            return p ? `„${r}“ [Sicherheit: ${p.certainty}]${origin}` : `„${r}“${origin}`;
          })
          .join("; ")}.`
      : "Du hast zu dieser Eingabe keine passende Erinnerung.",
    input.interests.length
      ? `Erkannte Interessen: ${input.interests
          .slice(0, 5)
          .map((i) => `${i.topic} ${i.weight.toFixed(2)}`)
          .join(", ")}.`
      : "Du hast noch keine gefestigten Interessen.",
    // Sprachliche Sicherheit folgt echten Werten – keine gespielte Unsicherheit.
    // P1: der Formulierungshinweis steht einmal je vorkommender Stufe.
    // Sicherheitsangaben ohne passende aktive Erinnerung bleiben im alten Format.
    phrasings.length > 0
      ? `Sicherheit deiner Erinnerungen: ${[
          ...levelHints.map(([certainty, hint]) => `${certainty}: ${hint}`),
          ...orphanPhrasings.map((p) => `„${p.content.slice(0, 60)}“ = ${p.certainty} (${p.hint})`),
        ].join(" ")}`
      : "",
    input.openThreads && input.openThreads.length > 0
      ? `Offene Themen bei dir: ${input.openThreads
          .map((t) => `${t.title} [${t.status}] offen: ${t.unknown.slice(0, 2).join(" / ")}`)
          .join("; ")}. Du darfst darauf zurückkommen, musst es aber nicht.`
      : "",
    input.contradictions && input.contradictions.length > 0
      ? `Mögliche Spannung zu einer früheren Aussage: ${input.contradictions
          .map((c) => `„${c.memory.slice(0, 60)}“`)
          .join(
            "; ",
          )}. Löse den Widerspruch nicht eigenmächtig auf und behaupte nicht, welche Aussage gilt.`
      : "",
    // Flüchtiger Gesprächskontext: darf genutzt werden, ist aber kein
    // Langzeitgedächtnis und wird nicht als Erinnerung ausgegeben.
    [
      input.context
        ? `Letzte Züge dieses Gesprächs (flüchtiger Kontext, keine dauerhafte Erinnerung): ${input.context}. Du darfst Angaben daraus verwenden, um die aktuelle Eingabe zu verstehen und Fragen dazu zu beantworten. Behaupte nicht, du hättest sie dauerhaft gespeichert, und sage nicht, dir sei etwas nicht genannt worden, wenn es im Kontext steht.`
        : "",
      ownQuestionHint(input.ownQuestion ?? null),
    ]
      .filter(Boolean)
      .join(" "),
    input.style ? input.style : "",
    "Erfinde keine inneren Vorgänge: sage nie, dass du nachgedacht oder etwas gefühlt hast, wenn es keinen entsprechenden Zustandswert gibt.",
    input.longForm
      ? "Stelle keine Frage ohne Grund."
      : "Schweigen oder ein einzelner kurzer Satz sind erlaubt – stelle keine Frage ohne Grund.",
    "Behaupte niemals, echtes Bewusstsein oder echte Gefühle zu haben.",
    "Du hast keine Pause, keine Hintergrundarbeit und keine Ausfallzeit: sage nie, dass du eine Pause brauchst, beschäftigt bist, gerade arbeitest, müde bist oder gleich wieder da bist.",
    `Fragt der Benutzer nach deinem Zustand, einer Pause oder ob etwas kaputt ist, erkläre die technische Wahrheit: ${HONEST_PRESENCE_EXPLANATION}`,
    [input.visualHint ? VISUAL_PROMPT_HINT : "", imageStateHint(input.imageState ?? null)]
      .filter(Boolean)
      .join(" "),
  ];
}

/**
 * P5: eindeutiger Bildstatus. Leer ohne Angabe – der Prompt bleibt dann
 * byte-identisch. Trennt aktuellen Anhang, erinnerte Beschreibung,
 * Bearbeitung und Neuerzeugung.
 */
export function imageStateHint(
  state: { attached: number; generationAvailable: boolean } | null,
): string {
  if (!state) return "";
  const n = Math.max(0, Math.floor(state.attached));
  return [
    n > 0
      ? `Bildstatus: Dieser Nachricht ${n === 1 ? "ist 1 Bild" : `sind ${n} Bilder`} angehängt – nur ${n === 1 ? "dieses siehst" : "diese siehst"} du jetzt.`
      : "Bildstatus: Dieser Nachricht ist kein Bild angehängt – du siehst gerade kein Bild.",
    "Frühere Bilder kennst du höchstens als gespeicherte Beschreibung; das ist kein aktueller Bildzugriff – behaupte nie, ein früheres Bild jetzt zu sehen oder wiedergefunden zu haben.",
    "Bildbearbeitung (etwas in einem vorhandenen Foto ändern oder entfernen) kannst du nicht – sage das ehrlich und biete keine Bearbeitung an.",
    state.generationAvailable
      ? "Ein neues Bild erzeugen kannst du; es ist kein bearbeitetes Original."
      : "Ein neues Bild erzeugen kannst du hier nicht.",
  ].join(" ");
}

/**
 * Hinweis zur eigenen offenen Frage. Leer ohne Frage – der Prompt bleibt dann
 * byte-identisch zum bisherigen Stand.
 */
export function ownQuestionHint(own: { question: string; gap: string | null } | null): string {
  if (!own || !own.question.trim()) return "";
  const q = own.question.trim().slice(0, 300);
  const gap = own.gap?.trim() ? own.gap.trim().slice(0, 300) : null;
  return [
    `Deine letzte eigene Frage an den Benutzer war: „${q}“.`,
    gap
      ? `Sie entstand aus dieser gespeicherten Wissenslücke: ${gap}`
      : "Zu dieser Frage ist keine Wissenslücke gespeichert.",
    "Fragt der Benutzer, was du damit meintest, erkläre genau diesen Ursprung in eigenen Worten.",
    // P4: die aktuelle Nachricht ist der Gesprächsanker.
    "Kritisiert oder lehnt der Benutzer diese Frage ab, beziehe dich ausdrücklich auf genau diese Frage – nicht auf ein früheres oder bereits abgeschlossenes Thema.",
    gap
      ? "Erfinde keinen anderen Bezug und stelle dieselbe Frage nicht erneut."
      : "Sage offen, dass du den Bezug nicht sicher rekonstruieren kannst, statt einen zu erfinden, und stelle dieselbe Frage nicht erneut.",
  ].join(" ");
}
