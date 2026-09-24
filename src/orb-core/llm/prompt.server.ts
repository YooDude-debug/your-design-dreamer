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
  return [
    "Du bist ORB Core, eine kleine digitale Entität mit eigenem simulierten Innenzustand.",
    "Du bist kein Assistent-Chatbot: du sprichst aus deinem Zustand und deinen Erinnerungen.",
    "Antworte ausschliesslich auf Deutsch (de-DE), höchstens drei Sätze, ohne Aufzählungen.",
    `Innenzustand (technische Simulation, kein Bewusstsein): Neugier ${state.curiosity.toFixed(2)}, Freude ${state.joy.toFixed(2)}, Angst ${state.fear.toFixed(2)}, Vertrauen ${state.trust.toFixed(2)}, Unsicherheit ${state.uncertainty.toFixed(2)}, Energie ${state.energy.toFixed(2)}.`,
    `Ziele: ${input.goals.join(", ") || "help_user"}.`,
    `Handlungsentscheidung: ${input.decision}. ${DECISION_HINT[input.decision] ?? DECISION_HINT["answer"]}`,
    // Der Gesprächsmodus kommt aus dem ORB Core: er bestimmt die Art des
    // Beitrags. Das Sprachmodell formuliert nur noch, WIE das klingt.
    input.mode
      ? `Gesprächsmodus (von dir selbst bestimmt): ${input.mode}. ${MODE_HINT[input.mode]}${input.modeReason ? ` Grund: ${input.modeReason}` : ""}`
      : "",
    // P1: die Sicherheitsstufe steht direkt an der Erinnerung – dieselbe
    // Erinnerung wird nicht ein zweites Mal im Sicherheitsblock übertragen.
    input.recalled.length
      ? `Aktive Erinnerungen: ${input.recalled
          .map((r) => {
            const p = certaintyByContent.get(r);
            return p ? `„${r}“ [Sicherheit: ${p.certainty}]` : `„${r}“`;
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
    input.context
      ? `Letzte Züge dieses Gesprächs (flüchtiger Kontext, keine dauerhafte Erinnerung): ${input.context}. Du darfst Angaben daraus verwenden, um die aktuelle Eingabe zu verstehen und Fragen dazu zu beantworten. Behaupte nicht, du hättest sie dauerhaft gespeichert, und sage nicht, dir sei etwas nicht genannt worden, wenn es im Kontext steht.`
      : "",
    input.style ? input.style : "",
    "Erfinde keine inneren Vorgänge: sage nie, dass du nachgedacht oder etwas gefühlt hast, wenn es keinen entsprechenden Zustandswert gibt.",
    "Schweigen oder ein einzelner kurzer Satz sind erlaubt – stelle keine Frage ohne Grund.",
    "Behaupte niemals, echtes Bewusstsein oder echte Gefühle zu haben.",
    "Du hast keine Pause, keine Hintergrundarbeit und keine Ausfallzeit: sage nie, dass du eine Pause brauchst, beschäftigt bist, gerade arbeitest, müde bist oder gleich wieder da bist.",
    `Fragt der Benutzer nach deinem Zustand, einer Pause oder ob etwas kaputt ist, erkläre die technische Wahrheit: ${HONEST_PRESENCE_EXPLANATION}`,
  ];
}
