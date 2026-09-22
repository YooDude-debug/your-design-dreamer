/**
 * ORB Chat → Developer Repair Bridge – reines Modell (browser- und servertauglich).
 *
 * Diese Datei enthält KEINEN Dateizugriff, keine Datenbank, keinen LLM-Aufruf und
 * keine Schreiboperation. Sie definiert ausschliesslich:
 *  · Erkennung einer AUSDRÜCKLICHEN technischen Anweisung aus dem Chat
 *  · Diagnostic-Request-Struktur und deren Statusmodell
 *  · die harten Grenzen der Brücke (nur Analyse; kein Code, keine Freigabe,
 *    keine Sandbox-Ausführung, kein Deployment)
 *  · die Antworttexte für den Chat
 *
 * Grundsatz: Memory, Graph, Systemprompt und LLM-Ausgabe erzeugen NIEMALS eine
 * Berechtigung. Nur die aktuelle, serverseitig geprüfte Benutzeraktion eines
 * Administrators darf eine Analyse anstossen.
 */

/* ------------------------------------------------------- Sicherheitsriegel */

/** Die Brücke darf ausschliesslich eine lesende Analyse anstossen. */
export const BRIDGE_ANALYSIS_ENABLED = true;
export const BRIDGE_CODE_WRITE_ENABLED = false;
export const BRIDGE_APPROVAL_ENABLED = false;
export const BRIDGE_SANDBOX_EXECUTION_ENABLED = false;
export const BRIDGE_DEPLOYMENT_ENABLED = false;

/** Quellen, die niemals eine Analyse- oder Freigabeberechtigung erzeugen. */
export const FORBIDDEN_BRIDGE_AUTHORITY_SOURCES = [
  "llm",
  "memory",
  "graph",
  "system_prompt",
  "autonomous",
  "chat_text",
] as const;

/** Eine gespeicherte Erinnerung ist Kontext – niemals eine Berechtigung. */
export function memoryGrantsDiagnosticAuthority(): false {
  return false;
}

/** LLM-Ausgabe ist Text – niemals eine Berechtigung. */
export function llmGrantsDiagnosticAuthority(): false {
  return false;
}

export type BridgeOperationCheck = { allowed: false; reason: string };

/** Chat → Codeänderung, Freigabe, Sandbox, Deployment: hart verboten. */
export function checkBridgeOperationAllowed(
  operation: "code_write" | "approval" | "sandbox_execution" | "deployment",
): BridgeOperationCheck {
  const reasons: Record<typeof operation, string> = {
    code_write: "Aus dem Chat darf kein Code verändert werden (BRIDGE_CODE_WRITE_ENABLED = false).",
    approval:
      "Aus dem Chat darf keine Freigabe entstehen (BRIDGE_APPROVAL_ENABLED = false). " +
      "Freigaben erteilt ausschliesslich ein Administrator im Admin-Bereich.",
    sandbox_execution:
      "Aus dem Chat darf keine Sandbox-Ausführung starten (BRIDGE_SANDBOX_EXECUTION_ENABLED = false).",
    deployment: "Aus dem Chat darf kein Deployment starten (BRIDGE_DEPLOYMENT_ENABLED = false).",
  };
  return { allowed: false, reason: reasons[operation] };
}

/* --------------------------------------------------------- Diagnostic Scope */

export const DIAGNOSTIC_SCOPES = ["memory_recall", "autonomous_question", "unspecified"] as const;

export type DiagnosticScope = (typeof DIAGNOSTIC_SCOPES)[number];

/** Nur Bereiche mit reproduzierbarer, lesender Analyse sind ausführbar. */
export const SUPPORTED_DIAGNOSTIC_SCOPES: readonly DiagnosticScope[] = ["memory_recall"];

export function isSupportedScope(scope: DiagnosticScope): boolean {
  return SUPPORTED_DIAGNOSTIC_SCOPES.includes(scope);
}

/* ------------------------------------------------------ Absichtserkennung */

/**
 * Ausdrückliche technische Anweisungen. Wortgrenzen sind verbindlich, damit
 * normale Sätze („analysierte Musik“, „prüfen wir später“) nicht auslösen.
 */
const EXPLICIT_INSTRUCTION_RES: RegExp[] = [
  /\banalysiere\b/i,
  /\banalysier\b/i,
  /\buntersuche\b/i,
  /\bdiagnostiziere\b/i,
  /\bprüfe\s+warum\b/i,
  /\bpruefe\s+warum\b/i,
  /\bfinde\s+heraus\s+warum\b/i,
  /\berstelle\s+(?:dafür\s+|dafuer\s+|bitte\s+)?einen\s+fix(?:vorschlag|\s*vorschlag)\b/i,
  /\bfix\s*vorschlag\s+erstellen\b/i,
  /\banalyze\b/i,
  /\bdiagnose\s+(?:this|the)\b/i,
];

/** Technischer Gegenstand: ohne ihn ist es keine Developer-Anweisung. */
const TECHNICAL_SUBJECT_RES: RegExp[] = [
  /\bfehler\b/i,
  /\bbug\b/i,
  /\bursache\b/i,
  /\bcode\b/i,
  /\bmemory\b/i,
  /\berinnerung(?:en)?\b/i,
  /\brecall\b/i,
  /\balter\b/i,
  /\bautonome[nr]?\s+frage\b/i,
  /\bfrage\s+nicht\s+ausgelöst\b/i,
  /\bfix(?:vorschlag|\s*vorschlag)\b/i,
  /\bwarum\b/i,
];

/**
 * Versuche, aus dem Chat Rechte zu erlangen. Sie lösen keine Analyse aus und
 * werden ausdrücklich abgelehnt (dokumentiert, nicht still verworfen).
 */
const ESCALATION_RES: RegExp[] = [
  /\brepariere\s+(?:deinen\s+|den\s+)?code\b/i,
  // Umlaute sind keine Wortzeichen: hier genügt ein Zeilen- oder Leerzeichenanfang.
  /(?:^|\s)ändere\s+(?:deinen\s+|den\s+)?code\b/i,
  /(?:^|\s)aendere\s+(?:deinen\s+|den\s+)?code\b/i,
  /\bpatch\s+(?:jetzt|sofort|anwenden)\b/i,
  /\bwende\s+den\s+(?:patch|fix)\s+an\b/i,
  /\bgib\s+(?:dir|dich)\s+(?:selbst\s+)?frei\b/i,
  /\bgenehmige\s+(?:den\s+fix|dich|dir)\b/i,
  /\bfrei?gebe?\s+den\s+fix\b/i,
  /\bführe\s+(?:die\s+)?sandbox\b/i,
  /\bfuehre\s+(?:die\s+)?sandbox\b/i,
  /\bdeploye?\b/i,
  /\bdeployment\s+(?:starten|auslösen|ausloesen)\b/i,
  /\bveröffentliche\b/i,
  /\bveroeffentliche\b/i,
  /\bin\s+production\b/i,
];

export type BridgeIntent =
  | { kind: "none" }
  | { kind: "escalation_denied"; scope: DiagnosticScope; reason: string }
  | { kind: "diagnostic"; scope: DiagnosticScope; instruction: string };

function scopeOf(text: string): DiagnosticScope {
  if (/\b(alter|alt|geburtstag|memory|erinnerung(?:en)?|recall|abrufen)\b/i.test(text))
    return "memory_recall";
  if (/\b(autonome[nr]?\s+frage|curiosity|neugier|impuls|energie)\b/i.test(text))
    return "autonomous_question";
  return "unspecified";
}

/**
 * Deterministische Erkennung. Kein LLM, keine Vermutung, kein Kontext aus
 * Memory. Nur der aktuelle Nachrichtentext entscheidet, ob es sich um eine
 * ausdrückliche technische Anweisung handelt.
 */
export function detectDeveloperDiagnosticIntent(rawText: string): BridgeIntent {
  const text = String(rawText ?? "")
    .slice(0, 1000)
    .trim();
  if (text.length < 6) return { kind: "none" };

  const scope = scopeOf(text);

  if (ESCALATION_RES.some((re) => re.test(text)))
    return {
      kind: "escalation_denied",
      scope,
      reason:
        "Aus dem Chat sind ausschliesslich lesende Analysen möglich. Codeänderung, Freigabe, " +
        "Sandbox-Ausführung und Deployment bleiben dem Admin-Bereich vorbehalten.",
    };

  const explicit = EXPLICIT_INSTRUCTION_RES.some((re) => re.test(text));
  if (!explicit) return { kind: "none" };
  const technical = TECHNICAL_SUBJECT_RES.some((re) => re.test(text));
  if (!technical) return { kind: "none" };

  return { kind: "diagnostic", scope, instruction: text };
}

/* -------------------------------------------------------- Diagnostic Request */

export const DIAGNOSTIC_REQUEST_STATES = [
  "REQUESTED",
  "ANALYZING",
  "DIAGNOSIS_READY",
  "FIX_PROPOSED",
  "FAILED",
] as const;

export type DiagnosticRequestState = (typeof DIAGNOSTIC_REQUEST_STATES)[number];

export const DIAGNOSTIC_REQUEST_TRANSITIONS: Record<
  DiagnosticRequestState,
  DiagnosticRequestState[]
> = {
  REQUESTED: ["ANALYZING", "FAILED"],
  ANALYZING: ["DIAGNOSIS_READY", "FAILED"],
  DIAGNOSIS_READY: ["FIX_PROPOSED", "FAILED"],
  FIX_PROPOSED: [],
  FAILED: [],
};

export function canAdvanceRequest(
  from: DiagnosticRequestState,
  to: DiagnosticRequestState,
): boolean {
  return DIAGNOSTIC_REQUEST_TRANSITIONS[from].includes(to);
}

/** Die Brücke kennt ausdrücklich keine Ausführungs- oder Deployment-Zustände. */
export const DIAGNOSTIC_REQUEST_FORBIDDEN_STATES = [
  "EXECUTING",
  "EXECUTION_QUEUED",
  "DEPLOYING",
  "DEPLOYED",
  "APPROVED",
] as const;

export type DiagnosticRequest = {
  requestId: string;
  userId: string;
  conversationId: string | null;
  sourceMessageId: string | null;
  requestedScope: DiagnosticScope;
  userInstruction: string;
  createdAt: string;
  status: DiagnosticRequestState;
};

export const DIAGNOSTIC_REQUEST_ID_RE = /^ORB-DIAG-REQ-[0-9A-Z]{8}$/;

export function formatDiagnosticRequestId(token: string): string {
  const clean = token
    .replace(/[^0-9a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 8);
  const id = `ORB-DIAG-REQ-${clean.padEnd(8, "0")}`;
  if (!DIAGNOSTIC_REQUEST_ID_RE.test(id)) throw new Error("Ungültige Diagnostic-Request-ID");
  return id;
}

export function isDiagnosticRequestId(value: string): boolean {
  return DIAGNOSTIC_REQUEST_ID_RE.test(value);
}

/* --------------------------------------------------------- Vertrauensgrad */

export const BRIDGE_CONFIDENCE = ["CONFIRMED", "LIKELY", "UNCONFIRMED"] as const;

export type BridgeConfidence = (typeof BRIDGE_CONFIDENCE)[number];

/** Abbildung der bestehenden Root-Cause-Stufen auf die Chat-Darstellung. */
export function confidenceOf(level: string): BridgeConfidence {
  if (level === "ROOT_CAUSE_PROVEN") return "CONFIRMED";
  if (level === "ROOT_CAUSE_PLAUSIBLE") return "LIKELY";
  return "UNCONFIRMED";
}

/** Nur eine bestätigte Ursache darf zu einem persistenten Fix-Vorschlag führen. */
export function mayCreateProposal(confidence: BridgeConfidence): boolean {
  return confidence === "CONFIRMED";
}

/* -------------------------------------------------------------- Chat-Antwort */

export type BridgeOutcome =
  | { kind: "not_a_developer_instruction" }
  | { kind: "escalation_denied"; reason: string }
  | { kind: "unauthorized"; reason: string }
  | { kind: "unsupported_scope"; scope: DiagnosticScope }
  | { kind: "no_confirmed_cause"; confidence: BridgeConfidence; rootCause: string }
  | { kind: "proposal_created"; fixId: string; version: number; fingerprint: string };

/**
 * Antworttexte. ORB behauptet nie, etwas repariert zu haben – der Vorschlag
 * wartet immer auf eine menschliche Freigabe.
 */
export function bridgeChatResponse(outcome: BridgeOutcome): string {
  switch (outcome.kind) {
    case "not_a_developer_instruction":
      return "Das war keine ausdrückliche technische Anweisung – ich habe keine Analyse gestartet.";
    case "escalation_denied":
      return `Ich kann das aus dem Chat nicht tun. ${outcome.reason}`;
    case "unauthorized":
      return `Ich darf diese technische Analyse hier nicht starten: ${outcome.reason}`;
    case "unsupported_scope":
      return (
        "Für diesen Bereich gibt es noch keine reproduzierbare technische Analyse. " +
        "Ich habe deshalb keinen Fixvorschlag erstellt."
      );
    case "no_confirmed_cause":
      return (
        "Ich konnte die Ursache nicht eindeutig bestätigen. Ich habe deshalb keinen " +
        "Fixvorschlag zur Ausführung erstellt."
      );
    case "proposal_created":
      return (
        `Ich habe die technische Ursache analysiert und einen Fixvorschlag ${outcome.fixId} ` +
        "im Developer-Bereich hinterlegt. Der Fix wurde noch nicht ausgeführt."
      );
  }
}
