/**
 * ORB Developer / Repair Environment – Phase 3.
 *
 * Genehmigter Patch-Inhalt zum bekannten Fehlerfall ORB-DIAG-MEMORY-RECALL-AGE
 * („Wie alt bin ich?“ findet die gespeicherte Erinnerung „Ich bin 36 Jahre.“
 * nicht). Der Text ist ein echter, anwendbarer Unified-Diff gegen den
 * Basisstand und wird ausschliesslich in der isolierten Sandbox angewendet.
 *
 * Diese Datei verändert keinen Produktivcode – sie enthält nur Text.
 */

export const MEMORY_RECALL_AGE_PATCH = `diff --git a/src/orb-core/memory.ts b/src/orb-core/memory.ts
--- a/src/orb-core/memory.ts
+++ b/src/orb-core/memory.ts
@@ -250,12 +250,39 @@ function stem(word: string): string {
   return w;
 }
 
+/**
+ * Reine Frage- und Funktionswörter. Sie beschreiben kein Wissensgebiet und
+ * dürfen daher weder Thema noch Suchwort werden. Ohne diesen Filter wird
+ * „Wie alt bin ich?“ auf das Thema „wie“ abgebildet und findet nichts.
+ */
+const QUESTION_WORDS = new Set([
+  "wie",
+  "was",
+  "wer",
+  "wen",
+  "wem",
+  "wann",
+  "wieso",
+  "warum",
+  "weshalb",
+  "woher",
+  "wohin",
+  "womit",
+  "wozu",
+  "wieviel",
+  "welche",
+  "welcher",
+  "welches",
+  "welchen",
+  "welchem",
+]);
+
 /** Inhaltswörter einer Eingabe (ohne Füll- und Bewertungswörter), als Grundform. */
 export function contentTokens(text: string): string[] {
   const out: string[] = [];
   for (const w of words(text)) {
     if (w.length < 3) continue;
-    if (STOPWORDS.has(w) || AFFECT_WORDS.has(w)) continue;
+    if (STOPWORDS.has(w) || AFFECT_WORDS.has(w) || QUESTION_WORDS.has(w)) continue;
     const s = stem(w);
     if (s.length < 3) continue;
     if (!out.includes(s)) out.push(s);
@@ -434,7 +461,7 @@ function contentTokenPairs(text: string): { word: string; stem: string }[] {
   const out: { word: string; stem: string }[] = [];
   for (const w of words(text)) {
     if (w.length < 3) continue;
-    if (STOPWORDS.has(w) || AFFECT_WORDS.has(w)) continue;
+    if (STOPWORDS.has(w) || AFFECT_WORDS.has(w) || QUESTION_WORDS.has(w)) continue;
     const s = stem(w);
     if (s.length < 3) continue;
     if (!out.some((p) => p.stem === s)) out.push({ word: w, stem: s });
diff --git a/src/orb-core/recall.ts b/src/orb-core/recall.ts
--- a/src/orb-core/recall.ts
+++ b/src/orb-core/recall.ts
@@ -25,6 +25,8 @@ const DOMAIN_PATTERNS: [string, RegExp][] = [
     "essen",
     /\\b(esse|essen|isst|esst|lieblingsessen|ernährung|ernaehrung|gericht|gerichte|schnitzel|brokkoli|pizza|pasta|sushi|burger|koche|kochen)\\b/i,
   ],
+  ["alter", /\\b(alt|alter|jahre|jahren|jahr|geburtstag|geboren|jahrgang|lebensjahr)\\b/i],
+  ["wohnort", /\\b(wohne|wohnort|wohnst|lebe|lebst|stadt|heimatstadt|adresse|umgezogen)\\b/i],
 ];
 
 /**
diff --git a/tests/orb-memory-recall-age.regression.test.ts b/tests/orb-memory-recall-age.regression.test.ts
new file mode 100644
--- /dev/null
+++ b/tests/orb-memory-recall-age.regression.test.ts
@@ -0,0 +1,38 @@
+/**
+ * Regressionsnachweis zum bekannten Fehler „Wie alt bin ich?“ (ORB-DIAG-MEMORY-RECALL-AGE).
+ *
+ * Vor dem genehmigten Fix schlägt diese Datei fehl: das Fragewort „wie“ wird
+ * zum Thema und die gespeicherte Erinnerung „Ich bin 36 Jahre.“ erreicht die
+ * Kandidatensuche nie (overlap = 0). Nach dem Fix muss sie grün sein.
+ */
+import { describe, expect, it } from "vitest";
+
+import { contentTokens, similarity, topicOf } from "@/orb-core/memory";
+import { infoDomainOf, questionIntentOf, topicAffinity } from "@/orb-core/recall";
+
+const AGE_MEMORY = "Ich bin 36 Jahre.";
+
+describe("Bekannter Fehler: Altersfrage erreicht die Erinnerung nicht", () => {
+  it("das Fragewort wird nicht zum Thema", () => {
+    expect(topicOf("Wie alt bin ich?")).not.toBe("wie");
+    expect(contentTokens("Wie alt bin ich?")).not.toContain("wie");
+  });
+
+  it("die Altersfrage hat einen erkannten Informationsbereich", () => {
+    expect(questionIntentOf("Wie alt bin ich?")).toBe("alter");
+    expect(infoDomainOf(AGE_MEMORY)).toBe("alter");
+  });
+
+  it("die gespeicherte Erinnerung überlebt den Kandidatenfilter", () => {
+    const overlap = Math.max(
+      similarity("Wie alt bin ich?", AGE_MEMORY),
+      topicAffinity("Wie alt bin ich?", AGE_MEMORY),
+    );
+    expect(overlap).toBeGreaterThan(0);
+  });
+
+  it("fremde Bereiche werden nicht verbunden", () => {
+    expect(topicAffinity("Wie alt bin ich?", "Der Nutzer besitzt eine RTX 5070 OC.")).toBe(0);
+    expect(questionIntentOf("Wie geht es dir?")).toBeNull();
+  });
+});
`;
