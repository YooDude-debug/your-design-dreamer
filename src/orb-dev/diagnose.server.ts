/**
 * ORB Developer Environment – READ-ONLY Diagnose.
 *
 * Die Diagnose rechnet ausschliesslich mit den bestehenden, deterministischen
 * ORB-Core-Funktionen und liest Code. Sie ändert nichts: keine Datenbank, kein
 * Code, kein LLM, keine Persistenz.
 *
 * Kette: Observation → Reproduction → Code Trace → Root Cause → Fix Proposal.
 */

import { contentTokens, similarity, topicOf } from "@/orb-core/memory";
import { questionIntentOf, topicAffinity } from "@/orb-core/recall";
import { isReliableMemoryContent } from "@/orb-core/eligibility";
import { findCallers, findSymbolDefinitions, findRelatedTests } from "@/orb-dev/code-access.server";
import { mayProposeRepair, type FixProposal } from "@/orb-dev/fix-model";
import type { ChainStep, Diagnosis } from "@/orb-dev/types";

/**
 * Erster realer Fall: „Wie alt bin ich?“ gegen „Ich bin 36 Jahre.“
 * Rein lesend, vollständig reproduzierbar, ohne Datenbankzugriff.
 */
export async function diagnoseMemoryRecallCase(
  question = "Wie alt bin ich?",
  memory = "Ich bin 36 Jahre.",
): Promise<Diagnosis> {
  const questionTopic = topicOf(question);
  const questionIntent = questionIntentOf(question);
  const questionTokens = contentTokens(question);
  const memoryTopic = topicOf(memory);
  const lexical = similarity(question, memory);
  const affinity = topicAffinity(question, memory);
  const overlap = Math.max(lexical, affinity);

  const [topicDefs, retrieveCallers, tests] = await Promise.all([
    findSymbolDefinitions("topicOf"),
    findCallers("retrieveCandidates"),
    findRelatedTests("recall"),
  ]);

  const questionWordAsTopic =
    questionTopic !== null && questionTokens[0] === questionTopic.toLowerCase();

  const chain: ChainStep[] = [
    {
      stage: "MEMORY",
      outcome: "PASS",
      detail: `Erinnerung ist gespeichert und belastbar (${isReliableMemoryContent(memory) ? "statement" : "nicht belastbar"}), Thema „${memoryTopic ?? "—"}“.`,
    },
    {
      stage: "RECALL",
      outcome: questionIntent ? "PASS" : "BLOCKED",
      detail: questionIntent
        ? `Informationsbereich der Frage: ${questionIntent}.`
        : "questionIntentOf() erkennt keinen Informationsbereich (nur vier Bereiche vorhanden).",
    },
    {
      stage: "CANDIDATE_SEARCH",
      outcome: questionWordAsTopic ? "BLOCKED" : overlap > 0 ? "PASS" : "BLOCKED",
      detail: questionWordAsTopic
        ? `topicOf("${question}") liefert das Fragewort „${questionTopic}“ als Thema – die Kandidatenabfrage läuft auf topic="${questionTopic}" und trifft nichts.`
        : `Kandidatenabfrage nutzt Thema „${questionTopic ?? "—"}“ und Tokens ${JSON.stringify(questionTokens.slice(0, 3))}.`,
    },
    {
      stage: "FILTER",
      outcome: overlap > 0 ? "PASS" : "BLOCKED",
      detail: `overlap = max(similarity ${lexical.toFixed(3)}, topicAffinity ${affinity.toFixed(3)}) = ${overlap.toFixed(3)}; Filter verlangt overlap > 0.`,
    },
    {
      stage: "RANKING",
      outcome: overlap > 0 ? "PASS" : "NOT_REACHED",
      detail: "memoryRelevance() wird nur für Kandidaten mit overlap > 0 berechnet.",
    },
    {
      stage: "ACTIVE_MEMORY",
      outcome: overlap > 0 ? "PASS" : "NOT_REACHED",
      detail: "selectByLevel(scored, RECALL_LIMIT=6) mit Ebenen A4/B4/C2.",
    },
    {
      stage: "CONTEXT",
      outcome: overlap > 0 ? "PASS" : "NOT_REACHED",
      detail: "Zeile „Aktive Erinnerungen“ im System-Prompt bleibt leer.",
    },
    {
      stage: "LLM",
      outcome: overlap > 0 ? "PASS" : "NOT_REACHED",
      detail:
        "Das Sprachmodell erhält keine passende Erinnerung – der Fehler liegt vor dem LLM, nicht im LLM.",
    },
  ];

  const proven = questionWordAsTopic && overlap === 0;

  return {
    caseId: "ORB-DIAG-MEMORY-RECALL-AGE",
    question,
    memory,
    observation:
      "ORB antwortet, es habe keine passende Erinnerung, obwohl die Erinnerung gespeichert ist.",
    reproduction: {
      questionTopic,
      questionIntent,
      questionTokens,
      memoryTopic,
      lexicalSimilarity: lexical,
      topicAffinity: affinity,
      overlap,
    },
    codeTrace: [...topicDefs, ...retrieveCallers].slice(0, 12),
    relatedTests: [...new Set(tests.map((t) => t.path))].slice(0, 12),
    chain,
    rootCause: proven
      ? "Das Fragewort wird in topicOf() zum Fallback-Thema; zusammen mit dem harten Filter overlap > 0 wird die passende Erinnerung bereits in der Kandidatensuche verworfen."
      : "Reproduktion ergab keine eindeutige Blockade in der Kandidatensuche.",
    rootCauseLevel: proven ? "ROOT_CAUSE_PROVEN" : "ROOT_CAUSE_PLAUSIBLE",
  };
}

const PROPOSED_DIFF = `--- a/src/orb-core/memory.ts
+++ b/src/orb-core/memory.ts
@@
+/** Reine Frage-/Funktionswörter dürfen kein Thema und kein Suchwort sein. */
+const QUESTION_WORDS = new Set([
+  "wie", "was", "wer", "wen", "wem", "wann", "wo", "woher", "wohin",
+  "warum", "wieso", "weshalb", "welche", "welcher", "welches", "welchen",
+  "welchem", "wieviel", "womit", "wozu",
+]);
@@ function contentTokenPairs
-    if (STOPWORDS.has(w) || AFFECT_WORDS.has(w)) continue;
+    if (STOPWORDS.has(w) || AFFECT_WORDS.has(w) || QUESTION_WORDS.has(w)) continue;
--- a/src/orb-core/recall.ts
+++ b/src/orb-core/recall.ts
@@ DOMAIN_PATTERNS
+  ["alter", /\\b(alt|alter|jahre|jahren|geburtstag|geboren|jahrgang)\\b/i],
+  ["wohnort", /\\b(wohne|wohnort|lebe|stadt|ort|adresse)\\b/i],
`;

/** Aus einer bewiesenen Diagnose einen gebundenen Fix-Vorschlag ableiten. */
export function proposalFromDiagnosis(
  diagnosis: Diagnosis,
  fixId: string,
): FixProposal | { error: string } {
  if (!mayProposeRepair(diagnosis.rootCauseLevel))
    return { error: `Ursache ist ${diagnosis.rootCauseLevel} – kein Fix-Vorschlag erlaubt.` };
  return {
    fixId,
    createdAt: new Date().toISOString(),
    createdBy: "orb_diagnostic",
    rootCause: diagnosis.rootCause,
    rootCauseLevel: diagnosis.rootCauseLevel,
    files: ["src/orb-core/memory.ts", "src/orb-core/recall.ts"],
    diff: PROPOSED_DIFF,
    operations: [
      { kind: "edit_file", path: "src/orb-core/memory.ts" },
      { kind: "edit_file", path: "src/orb-core/recall.ts" },
      { kind: "run_command", command: "bunx vitest run" },
    ],
    testPlan: [
      'topicOf("Wie alt bin ich?") ergibt nicht "wie"',
      "Recall findet „Ich bin 36 Jahre.“ zu „Wie alt bin ich?“",
      "bestehender Fall „Welche Grafikkarte habe ich?“ bleibt grün",
      "Schwelle 0.35, Wichtigkeits- und Relevanzformel unverändert",
      "Typecheck, Lint, Build, volle Regression",
    ],
    expectedEffects: [
      "Fragewörter erzeugen kein falsches Thema mehr",
      "Altersfrage findet die gespeicherte Erinnerung",
    ],
    risks: [
      "Fragewort-Filter könnte gültige Themen entfernen",
      "neue Bereichsmuster könnten sich überschneiden",
      "Auswahländerung könnte heute korrekte Antworten verschieben",
    ],
    rollbackPlan: [
      "Änderung in memory.ts und recall.ts zurücknehmen",
      "volle Regression erneut ausführen",
      "kein Datenbank- oder Schemaeingriff, daher kein Datenrollback nötig",
    ],
    state: "FIX_PROPOSED",
  };
}
