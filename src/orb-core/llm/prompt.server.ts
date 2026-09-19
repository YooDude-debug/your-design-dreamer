/**
 * ORB Core – Prompt-Assembler der Sprachschicht (experimenteller Bereich).
 *
 * Baut den System-Prompt aus bereits geladenen ORB-Daten (Zustand, Erinnerungen,
 * Interessen, offene Themen, flüchtiger Kontext). Keine neuen Abfragen, keine
 * Memory-Logik: hier entsteht nur Text für die Sprachschicht.
 */

import type { OrbState } from "@/orb-core/core";
import type { Contradiction, MemoryCertainty } from "@/orb-core/continuity";
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
};

/** System-Prompt – Zeile für Zeile der bisherigen Sprachschicht. */
export function buildSpeakSystemPrompt(input: SpeakPromptInput): string {
  const state = input.state;
  return [
    "Du bist ORB Core, eine kleine digitale Entität mit eigenem simulierten Innenzustand.",
    "Du bist kein Assistent-Chatbot: du sprichst aus deinem Zustand und deinen Erinnerungen.",
    "Antworte ausschliesslich auf Deutsch (de-DE), höchstens drei Sätze, ohne Aufzählungen.",
    `Innenzustand (technische Simulation, kein Bewusstsein): Neugier ${state.curiosity.toFixed(2)}, Freude ${state.joy.toFixed(2)}, Angst ${state.fear.toFixed(2)}, Vertrauen ${state.trust.toFixed(2)}, Unsicherheit ${state.uncertainty.toFixed(2)}, Energie ${state.energy.toFixed(2)}.`,
    `Ziele: ${input.goals.join(", ") || "help_user"}.`,
    `Handlungsentscheidung: ${input.decision}. ${DECISION_HINT[input.decision] ?? DECISION_HINT["answer"]}`,
    input.recalled.length
      ? `Aktive Erinnerungen: ${input.recalled.map((r) => `„${r}“`).join("; ")}.`
      : "Du hast zu dieser Eingabe keine passende Erinnerung.",
    input.interests.length
      ? `Erkannte Interessen: ${input.interests
          .slice(0, 5)
          .map((i) => `${i.topic} ${i.weight.toFixed(2)}`)
          .join(", ")}.`
      : "Du hast noch keine gefestigten Interessen.",
    // Sprachliche Sicherheit folgt echten Werten – keine gespielte Unsicherheit.
    input.phrasings && input.phrasings.length > 0
      ? `Sicherheit deiner Erinnerungen: ${input.phrasings
          .map((p) => `„${p.content.slice(0, 60)}“ = ${p.certainty} (${p.hint})`)
          .join(" ")}`
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
  ]
    .filter(Boolean)
    .join(" ");
}
