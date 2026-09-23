/**
 * Reparaturstrecke – synthetische Fallvorlage (P16).
 *
 * Die Phase-3-/Phase-4-Tests prüfen Freigabe-Bindung, Sandbox-Ausführung,
 * Diff-Integrität und Rollout. Sie brauchen dafür einen reproduzierbaren
 * Ausgangszustand – aber KEINEN echten ORB-Fehler. Nach P15 ist der frühere
 * Beispielfehler behoben; diese Vorlage ersetzt ihn.
 *
 * Eigenschaften:
 *  · vollständig synthetisch: der Patch legt nur zwei neue Dateien an
 *  · der mitgelieferte Testnachweis scheitert im Basisstand (Modul fehlt) und
 *    ist nach dem Patch grün – exakt der von der Sandbox verlangte Nachweis
 *  · keine Produktionslogik, keine Schwelle, kein Prompt, keine Datenbank
 *  · der Produktionscode wird NICHT in einen alten Fehlerzustand zurückversetzt
 */
import type { FixOperation, FixProposal, RootCauseLevel } from "@/orb-dev/fix-model";
import type { Diagnosis } from "@/orb-dev/types";

export const SYNTHETIC_PROBE_FILE = "src/orb-core/sandbox-probe.p16.ts";
export const SYNTHETIC_REGRESSION_TEST = "tests/orb-sandbox-probe.regression.test.ts";

/** Exakter, anwendbarer Patch – legt ausschliesslich zwei neue Dateien an. */
export const SYNTHETIC_DIFF = `diff --git a/src/orb-core/sandbox-probe.p16.ts b/src/orb-core/sandbox-probe.p16.ts
new file mode 100644
--- /dev/null
+++ b/src/orb-core/sandbox-probe.p16.ts
@@ -0,0 +1,13 @@
+/**
+ * Synthetische Sandbox-Vorlage (P16).
+ *
+ * Diese Datei existiert NICHT im Basisstand. Sie wird ausschliesslich vom
+ * synthetischen Fix-Vorschlag der Reparaturstrecken-Tests innerhalb der
+ * isolierten Sandbox angelegt. Sie enthaelt keine ORB-Logik.
+ */
+
+export const SANDBOX_PROBE_MARKER = "orb-sandbox-probe-ok";
+
+export function sandboxProbe(): string {
+  return SANDBOX_PROBE_MARKER;
+}
diff --git a/tests/orb-sandbox-probe.regression.test.ts b/tests/orb-sandbox-probe.regression.test.ts
new file mode 100644
--- /dev/null
+++ b/tests/orb-sandbox-probe.regression.test.ts
@@ -0,0 +1,16 @@
+/**
+ * Synthetischer Regressionsnachweis der Reparaturstrecke (P16).
+ *
+ * Vor dem Patch fehlt das geprueffte Modul: der Test schlaegt fehl und belegt
+ * damit den reproduzierbaren Ausgangszustand. Nach dem Patch ist er gruen.
+ * Es wird keine ORB-Produktionslogik geprueft.
+ */
+import { describe, expect, it } from "vitest";
+
+import { SANDBOX_PROBE_MARKER, sandboxProbe } from "@/orb-core/sandbox-probe.p16";
+
+describe("Synthetische Sandbox-Vorlage", () => {
+  it("ist erst nach dem genehmigten Patch vorhanden", () => {
+    expect(sandboxProbe()).toBe(SANDBOX_PROBE_MARKER);
+  });
+});
`;

/**
 * Synthetische, bewiesene Diagnose. Der Befund beschreibt den synthetischen
 * Fall selbst – er behauptet keinen ORB-Fehler.
 */
export function syntheticProvenDiagnosis(level: RootCauseLevel = "ROOT_CAUSE_PROVEN"): Diagnosis {
  return {
    caseId: "ORB-DIAG-SANDBOX-PROBE",
    question: "(synthetischer Fall – keine Nutzerfrage)",
    memory: "(synthetischer Fall – keine Erinnerung)",
    observation:
      "Der mitgelieferte Regressionsnachweis scheitert im Basisstand, weil das geprüfte Modul fehlt.",
    reproduction: {
      questionTopic: null,
      questionIntent: null,
      questionTokens: [],
      memoryTopic: null,
      lexicalSimilarity: 0,
      topicAffinity: 0,
      overlap: 0,
    },
    codeTrace: [
      { path: SYNTHETIC_PROBE_FILE, line: 1, text: "Datei existiert im Basisstand nicht." },
    ],
    relatedTests: [SYNTHETIC_REGRESSION_TEST],
    chain: [
      {
        stage: "MEMORY",
        outcome: "PASS",
        detail: "Synthetische Vorlage – keine Erinnerung beteiligt.",
      },
    ],
    rootCause:
      "Das im Nachweis geforderte Modul fehlt im Basisstand; der genehmigte Patch legt es an.",
    rootCauseLevel: level,
  };
}

/** Synthetischer Fix-Vorschlag. Erzeugt keine Freigabe – die bleibt menschlich. */
export function syntheticProposal(fixId: string, operations?: FixOperation[]): FixProposal {
  const diagnosis = syntheticProvenDiagnosis();
  return {
    fixId,
    createdAt: new Date().toISOString(),
    createdBy: "admin",
    rootCause: diagnosis.rootCause,
    rootCauseLevel: diagnosis.rootCauseLevel,
    files: [SYNTHETIC_PROBE_FILE, SYNTHETIC_REGRESSION_TEST],
    diff: SYNTHETIC_DIFF,
    operations: operations ?? [
      { kind: "edit_file", path: SYNTHETIC_PROBE_FILE },
      { kind: "edit_file", path: SYNTHETIC_REGRESSION_TEST },
      { kind: "run_command", command: `bunx vitest run ${SYNTHETIC_REGRESSION_TEST}` },
    ],
    testPlan: [
      "Nachweis scheitert im unveränderten Basisstand",
      "Nachweis ist nach dem genehmigten Patch grün",
      "keine Änderung außerhalb der zwei genehmigten Dateien",
    ],
    expectedEffects: ["Das geprüfte Modul existiert nach dem Patch."],
    risks: ["Keine – die Vorlage berührt keine ORB-Logik."],
    rollbackPlan: ["Die zwei neu angelegten Dateien entfernen."],
    state: "APPROVED",
  };
}
