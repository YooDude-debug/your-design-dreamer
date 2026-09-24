/**
 * ORB Core – P0 Messbarkeit des Sprachkontexts.
 *
 * Reine, seiteneffektfreie Zählung bereits erzeugter Prompt-Bausteine.
 * Speichert und liefert AUSSCHLIESSLICH Zahlen – keine Texte, keine Inhalte,
 * keine Prompts. Keine Tokenizer-/Modell-API: Tokens werden nicht geschätzt.
 */

import type { SpeakPromptSection } from "@/orb-core/llm/prompt.server";

export type SectionMetric = { chars: number; entries: number | null };

export type SpeakPromptMetrics = {
  /** Zeichen des gesamten System-Prompts (exakt wie übertragen). */
  systemChars: number;
  /** Zeichen der aktuellen Nutzereingabe (separates Eingabefeld). */
  userInputChars: number;
  /** Leerzeichen zwischen den Bausteinen. */
  separatorChars: number;
  sections: Record<SpeakPromptSection, SectionMetric>;
  /** Dauer der Prompt-Erstellung (ms). */
  buildMs: number;
};

export function measureSpeakPrompt(input: {
  parts: { section: SpeakPromptSection; text: string }[];
  system: string;
  userText: string;
  counts: {
    memories: number;
    certainty: number;
    interests: number;
    threads: number;
    contradictions: number;
    historyMessages: number;
  };
  buildMs: number;
}): SpeakPromptMetrics {
  const empty = (): SectionMetric => ({ chars: 0, entries: null });
  const sections: Record<SpeakPromptSection, SectionMetric> = {
    rules: empty(),
    state: empty(),
    memories: empty(),
    interests: empty(),
    certainty: empty(),
    threads: empty(),
    contradictions: empty(),
    history: empty(),
    other: empty(),
  };
  let nonEmpty = 0;
  for (const p of input.parts) {
    sections[p.section].chars += p.text.length;
    if (p.text) nonEmpty += 1;
  }
  sections.memories.entries = input.counts.memories;
  sections.certainty.entries = input.counts.certainty;
  sections.interests.entries = input.counts.interests;
  sections.threads.entries = input.counts.threads;
  sections.contradictions.entries = input.counts.contradictions;
  sections.history.entries = input.counts.historyMessages;
  return {
    systemChars: input.system.length,
    userInputChars: input.userText.length,
    separatorChars: Math.max(0, nonEmpty - 1),
    sections,
    buildMs: input.buildMs,
  };
}

export type MemoryPipelineCounts = {
  /** Aus der Datenbank geladene Kandidaten. */
  candidates: number;
  /** Nach dem Filter „Überschneidung > 0“. */
  afterOverlap: number;
  /** Nach Ebenen-/Limit-Auswahl (A→B→C, max. 6). */
  afterLevels: number;
  /** Nach Belastbarkeitsprüfung. */
  afterEligibility: number;
  /** Nach Modus-Auswahl (promptMemories) – an das Modell übergeben. */
  sentToModel: number;
};

export type ConversationCounts = {
  messages: number;
  userMessages: number;
  orbMessages: number;
  /** Zeichen des übergebenen Verlaufsbausteins (inkl. Kürzung auf 160). */
  historyChars: number;
};

export function countConversation(
  messages: { role: "user" | "orb" }[],
  formatted: string | null,
): ConversationCounts {
  return {
    messages: messages.length,
    userMessages: messages.filter((m) => m.role === "user").length,
    orbMessages: messages.filter((m) => m.role === "orb").length,
    historyChars: formatted?.length ?? 0,
  };
}
