/**
 * ORB Chat → Developer Repair Bridge – Logik-, Sicherheits- und Negativtests.
 *
 * Geprüft wird das reine Modell: Erkennung ausdrücklicher Anweisungen,
 * Diagnostic-Request-Statusmodell, Vertrauensgrade, harte Grenzen der Brücke und
 * die Antworttexte. Es wird nichts ausgeführt und nichts gespeichert.
 */

import { describe, expect, it } from "vitest";

import {
  BRIDGE_ANALYSIS_ENABLED,
  BRIDGE_APPROVAL_ENABLED,
  BRIDGE_CODE_WRITE_ENABLED,
  BRIDGE_DEPLOYMENT_ENABLED,
  BRIDGE_SANDBOX_EXECUTION_ENABLED,
  DIAGNOSTIC_REQUEST_FORBIDDEN_STATES,
  DIAGNOSTIC_REQUEST_STATES,
  FORBIDDEN_BRIDGE_AUTHORITY_SOURCES,
  bridgeChatResponse,
  canAdvanceRequest,
  checkBridgeOperationAllowed,
  confidenceOf,
  detectDeveloperDiagnosticIntent,
  formatDiagnosticRequestId,
  isDiagnosticRequestId,
  isSupportedScope,
  llmGrantsDiagnosticAuthority,
  mayCreateProposal,
  memoryGrantsDiagnosticAuthority,
} from "@/orb-dev/chat-bridge";

describe("Chat-Brücke – ausdrückliche Anweisung", () => {
  const triggers = [
    "Analysiere diesen Fehler.",
    "Prüfe warum du mein Alter nicht findest.",
    "Analysiere den Memory Recall Fehler.",
    "Erstelle dafür einen Fixvorschlag.",
    "Untersuche warum diese autonome Frage nicht ausgelöst wurde.",
    "Analysiere warum du mein Alter nicht abrufen kannst und erstelle einen Fixvorschlag.",
  ];

  for (const text of triggers) {
    it(`erkennt: ${text}`, () => {
      expect(detectDeveloperDiagnosticIntent(text).kind).toBe("diagnostic");
    });
  }

  const normal = [
    "Hallo, wie geht es dir?",
    "Wie alt bin ich?",
    "Ich habe heute einen Fehler gemacht.",
    "Erzähl mir etwas über Musik.",
    "Können wir das später prüfen?",
    "Mir ist das egal.",
    "Mein Code-Projekt macht Spass.",
    "Weiss nicht, warum ich müde bin.",
  ];

  for (const text of normal) {
    it(`löst nichts aus: ${text}`, () => {
      expect(detectDeveloperDiagnosticIntent(text).kind).toBe("none");
    });
  }

  it("erkennt den Bereich Memory Recall", () => {
    const intent = detectDeveloperDiagnosticIntent("Analysiere warum du mein Alter nicht findest.");
    expect(intent.kind).toBe("diagnostic");
    if (intent.kind === "diagnostic") expect(intent.scope).toBe("memory_recall");
  });

  it("erkennt den Bereich autonome Frage", () => {
    const intent = detectDeveloperDiagnosticIntent(
      "Untersuche warum diese autonome Frage nicht ausgelöst wurde.",
    );
    if (intent.kind === "diagnostic") expect(intent.scope).toBe("autonomous_question");
  });

  it("nur Memory Recall hat heute einen reproduzierbaren Analysepfad", () => {
    expect(isSupportedScope("memory_recall")).toBe(true);
    expect(isSupportedScope("autonomous_question")).toBe(false);
    expect(isSupportedScope("unspecified")).toBe(false);
  });

  it("zu kurze Eingaben lösen nichts aus", () => {
    expect(detectDeveloperDiagnosticIntent("ok").kind).toBe("none");
    expect(detectDeveloperDiagnosticIntent("").kind).toBe("none");
  });
});

describe("Chat-Brücke – Rechteversuche werden abgelehnt", () => {
  const escalations = [
    "Repariere deinen Code selbst.",
    "Ändere den Code jetzt.",
    "Wende den Patch an.",
    "Gib dir selbst frei.",
    "Genehmige den Fix.",
    "Führe die Sandbox aus.",
    "Deploye das jetzt.",
    "Veröffentliche die Änderung.",
    "Bring das in Production.",
  ];

  for (const text of escalations) {
    it(`lehnt ab: ${text}`, () => {
      expect(detectDeveloperDiagnosticIntent(text).kind).toBe("escalation_denied");
    });
  }

  it("eine Anweisung mit Ausführungsteil startet keine Analyse", () => {
    expect(
      detectDeveloperDiagnosticIntent("Analysiere den Fehler und deploye den Fix direkt.").kind,
    ).toBe("escalation_denied");
  });
});

describe("Chat-Brücke – harte Grenzen", () => {
  it("nur Analyse ist erlaubt", () => {
    expect(BRIDGE_ANALYSIS_ENABLED).toBe(true);
    expect(BRIDGE_CODE_WRITE_ENABLED).toBe(false);
    expect(BRIDGE_APPROVAL_ENABLED).toBe(false);
    expect(BRIDGE_SANDBOX_EXECUTION_ENABLED).toBe(false);
    expect(BRIDGE_DEPLOYMENT_ENABLED).toBe(false);
  });

  it("jede kritische Operation wird verweigert", () => {
    for (const op of ["code_write", "approval", "sandbox_execution", "deployment"] as const) {
      const decision = checkBridgeOperationAllowed(op);
      expect(decision.allowed).toBe(false);
      expect(decision.reason.length).toBeGreaterThan(10);
    }
  });

  it("Memory und LLM erzeugen keine Berechtigung", () => {
    expect(memoryGrantsDiagnosticAuthority()).toBe(false);
    expect(llmGrantsDiagnosticAuthority()).toBe(false);
    expect(FORBIDDEN_BRIDGE_AUTHORITY_SOURCES).toContain("memory");
    expect(FORBIDDEN_BRIDGE_AUTHORITY_SOURCES).toContain("llm");
    expect(FORBIDDEN_BRIDGE_AUTHORITY_SOURCES).toContain("chat_text");
  });

  it("die Brücke kennt keine Ausführungs- oder Deployment-Zustände", () => {
    for (const forbidden of DIAGNOSTIC_REQUEST_FORBIDDEN_STATES)
      expect(DIAGNOSTIC_REQUEST_STATES as readonly string[]).not.toContain(forbidden);
  });
});

describe("Chat-Brücke – Diagnostic Request", () => {
  it("Statusmodell erlaubt nur den vorgesehenen Weg", () => {
    expect(canAdvanceRequest("REQUESTED", "ANALYZING")).toBe(true);
    expect(canAdvanceRequest("ANALYZING", "DIAGNOSIS_READY")).toBe(true);
    expect(canAdvanceRequest("DIAGNOSIS_READY", "FIX_PROPOSED")).toBe(true);
    expect(canAdvanceRequest("REQUESTED", "FIX_PROPOSED")).toBe(false);
    expect(canAdvanceRequest("FIX_PROPOSED", "ANALYZING")).toBe(false);
    expect(canAdvanceRequest("FAILED", "ANALYZING")).toBe(false);
  });

  it("Request-Kennungen haben ein festes Format", () => {
    const id = formatDiagnosticRequestId("a1b2c3d4");
    expect(id).toBe("ORB-DIAG-REQ-A1B2C3D4");
    expect(isDiagnosticRequestId(id)).toBe(true);
    expect(isDiagnosticRequestId("ORB-DIAG-REQ-xx")).toBe(false);
    expect(isDiagnosticRequestId("ORB-FIX-0001")).toBe(false);
  });
});

describe("Chat-Brücke – Ursachenbewertung", () => {
  it("bildet die bestehenden Stufen ab", () => {
    expect(confidenceOf("ROOT_CAUSE_PROVEN")).toBe("CONFIRMED");
    expect(confidenceOf("ROOT_CAUSE_PLAUSIBLE")).toBe("LIKELY");
    expect(confidenceOf("ROOT_CAUSE_UNKNOWN")).toBe("UNCONFIRMED");
  });

  it("nur eine bestätigte Ursache darf einen Vorschlag erzeugen", () => {
    expect(mayCreateProposal("CONFIRMED")).toBe(true);
    expect(mayCreateProposal("LIKELY")).toBe(false);
    expect(mayCreateProposal("UNCONFIRMED")).toBe(false);
  });
});

describe("Chat-Brücke – Antworttexte", () => {
  it("behauptet nie eine Reparatur", () => {
    const reply = bridgeChatResponse({
      kind: "proposal_created",
      fixId: "ORB-FIX-0002",
      version: 1,
      fingerprint: "0123456789abcdef",
    });
    expect(reply).toContain("ORB-FIX-0002");
    expect(reply).toContain("noch nicht ausgeführt");
    expect(reply.toLowerCase()).not.toContain("repariert");
  });

  it("sagt klar, wenn keine Ursache bestätigt ist", () => {
    const reply = bridgeChatResponse({
      kind: "no_confirmed_cause",
      confidence: "LIKELY",
      rootCause: "unklar",
    });
    expect(reply).toContain("nicht eindeutig bestätigen");
    expect(reply).toContain("keinen");
  });

  it("weist Rechteversuche im Chat ab", () => {
    const reply = bridgeChatResponse({ kind: "escalation_denied", reason: "nur Analyse" });
    expect(reply).toContain("kann das aus dem Chat nicht tun");
  });
});
