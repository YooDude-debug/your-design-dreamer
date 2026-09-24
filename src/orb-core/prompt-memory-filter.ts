/**
 * ORB Core – P2 V2: finale Memory-Übergabe bei direkten Antworten.
 *
 * Läuft NACH der bestehenden Auswahl und NACH der Antwortart-Entscheidung.
 * Entfernt nur, nie hinzufügen, keine Nachrücker, keine neue Auswahlrunde.
 * Ändert weder gespeicherte Werte noch Themen, Schlüssel oder STOPWORDS.
 */

import { contentTokens, topicOf } from "@/orb-core/memory";
import { infoDomainsOf } from "@/orb-core/recall";

export type FinalMemory = { content: string; topic: string | null };

/**
 * Sachfremd nur, wenn ALLE drei Bedingungen gelten:
 * kein gemeinsamer Bereich UND kein gleiches gespeichertes Thema UND
 * höchstens ein gemeinsamer Wortstamm.
 */
export function isForeignForDirectAnswer(text: string, memory: FinalMemory): boolean {
  const textDomains = new Set(infoDomainsOf(text));
  const sharedDomain = infoDomainsOf(memory.content).some((d) => textDomains.has(d));
  if (sharedDomain) return false;
  const textTopic = topicOf(text);
  if (memory.topic !== null && memory.topic === textTopic) return false;
  const textStems = new Set(contentTokens(text));
  const sharedStems = contentTokens(memory.content).filter((s) => textStems.has(s)).length;
  return sharedStems <= 1;
}

/** Reihenfolge bleibt erhalten; die Liste wird nicht wieder aufgefüllt. */
export function filterDirectAnswerMemories<T extends FinalMemory>(text: string, memories: T[]): T[] {
  return memories.filter((m) => !isForeignForDirectAnswer(text, m));
}
