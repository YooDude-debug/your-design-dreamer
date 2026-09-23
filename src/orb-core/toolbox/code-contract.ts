/**
 * P21 – ORB Code Analysis: reiner Vertrag (browser- und servertauglich).
 *
 * Diese Datei enthält KEINEN Dateizugriff, KEINEN Datenbankzugriff, KEINEN
 * Modellaufruf und KEINE Schreiboperation. Sie definiert ausschliesslich:
 *  · die eindeutige Fähigkeitskennung `orb.code_analysis`,
 *  · die harte Trennung READ (erlaubt) / WRITE (gesperrt),
 *  · den Lesebereich (Scope) und die Entfernung von Zugangsdaten,
 *  · die Form von Anforderung und strukturiertem Befund,
 *  · welche Quellen überhaupt eine Codeanalyse anfordern dürfen.
 *
 * Grundsatz unverändert: ANALYSE ≠ FREIGABE, VORSCHLAG ≠ PATCH,
 * PATCH ≠ DEPLOYMENT. Der Mensch bleibt Freigabeinstanz.
 */

/* ------------------------------------------------------- Harte Grenzen */

export const ORB_CODE_ANALYSIS_CAPABILITY_ID = "orb.code_analysis" as const;

/** P21 ist rein lesend. Jede schreibende Richtung ist abgeschaltet. */
export const CODE_ANALYSIS_READ_ENABLED = true;
export const CODE_ANALYSIS_WRITE_ENABLED = false;
export const CODE_ANALYSIS_PATCH_ENABLED = false;
export const CODE_ANALYSIS_MIGRATION_ENABLED = false;
export const CODE_ANALYSIS_DEPLOYMENT_ENABLED = false;
export const CODE_ANALYSIS_SECRET_ACCESS_ENABLED = false;

/** Lesende Teilfähigkeiten – vollständige, abgeschlossene Aufzählung. */
export const CODE_READ_OPERATIONS = [
  "read_file",
  "list_directory",
  "search_code",
  "follow_reference",
  "read_test",
  "read_report",
] as const;

export type CodeReadOperation = (typeof CODE_READ_OPERATIONS)[number];

/** Schreibende Operationen – in P21 ausnahmslos gesperrt. */
export const CODE_WRITE_OPERATIONS = [
  "write_file",
  "apply_patch",
  "migration",
  "deployment",
  "publish",
  "secret_access",
] as const;

export type CodeWriteOperation = (typeof CODE_WRITE_OPERATIONS)[number];

export type CodeOperationCheck = { allowed: boolean; reason: string };

export function isCodeReadOperation(op: string): op is CodeReadOperation {
  return (CODE_READ_OPERATIONS as readonly string[]).includes(op);
}

export function isCodeWriteOperation(op: string): op is CodeWriteOperation {
  return (CODE_WRITE_OPERATIONS as readonly string[]).includes(op);
}

/**
 * Einzige Entscheidungsstelle über Lesen/Schreiben. Lesen ist erlaubt,
 * Schreiben wird mit nachvollziehbarer Begründung abgelehnt – nie still.
 */
export function checkCodeOperationAllowed(operation: string): CodeOperationCheck {
  if (isCodeReadOperation(operation))
    return { allowed: true, reason: "Lesende Codeanalyse ist erlaubt (READ-ONLY)." };

  const reasons: Record<CodeWriteOperation, string> = {
    write_file: "Die Codeanalyse darf keine Datei schreiben (CODE_ANALYSIS_WRITE_ENABLED = false).",
    apply_patch:
      "Die Codeanalyse darf keinen Patch anwenden (CODE_ANALYSIS_PATCH_ENABLED = false). " +
      "Ein Vorschlag wird ausschliesslich über die bestehende Reparaturstrecke mit " +
      "menschlicher Freigabe wirksam.",
    migration:
      "Die Codeanalyse darf keine Migration ausführen (CODE_ANALYSIS_MIGRATION_ENABLED = false).",
    deployment:
      "Die Codeanalyse darf kein Deployment auslösen (CODE_ANALYSIS_DEPLOYMENT_ENABLED = false).",
    publish:
      "Die Codeanalyse darf nichts veröffentlichen; die Veröffentlichung ist eine " +
      "getrennte menschliche Freigabe.",
    secret_access:
      "Die Codeanalyse erhält keine Zugangsdaten (CODE_ANALYSIS_SECRET_ACCESS_ENABLED = false).",
  };
  if (isCodeWriteOperation(operation)) return { allowed: false, reason: reasons[operation] };
  return { allowed: false, reason: `Unbekannte Operation „${operation}" – abgelehnt.` };
}

/* -------------------------------------------------------------- Scope */

/** Nur der vorgesehene Projekt-Code. Kein beliebiger Dateisystemzugriff. */
export const CODE_ANALYSIS_SCOPE = ["src", "tests", "docs"] as const;

/**
 * Ausgeschlossene Pfade: Zugangsdaten, Abhängigkeiten, Build-Ergebnisse,
 * Versionsverwaltung, Arbeitsbereichsdaten, Schlüsseldateien.
 */
export const CODE_ANALYSIS_DENY_PATTERNS: readonly RegExp[] = [
  /(^|\/)\.env(\.|$)/i,
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)(dist|build|coverage|\.output|\.vinxi|\.nitro)(\/|$)/,
  /(^|\/)\.lovable(\/|$)/,
  /(^|\/)\.workspace(\/|$)/,
  /(^|\/)\.agents(\/|$)/,
  /(^|\/)\.claude(\/|$)/,
  /\.(pem|key|p12|pfx|keystore)$/i,
  /(^|\/)(secrets?|credentials?)\.(json|ya?ml|ts|js)$/i,
];

export type ScopeCheck = { ok: true; path: string } | { ok: false; reason: string };

/**
 * Normalisierung und Scope-Prüfung eines angeforderten Ziels. Absolute Pfade,
 * `..`, Backslashes, Null-Bytes und alles ausserhalb des Scopes werden
 * abgelehnt – ohne Dateizugriff, rein textuell.
 */
export function normalizeCodeTarget(target: unknown): ScopeCheck {
  if (typeof target !== "string" || target.trim() === "")
    return { ok: false, reason: "Kein Ziel angegeben." };
  const raw = target.trim();
  if (raw.includes("\0")) return { ok: false, reason: "Ungültiges Zeichen im Ziel." };
  if (raw.includes("\\")) return { ok: false, reason: "Backslashes sind im Ziel nicht erlaubt." };
  if (raw.startsWith("/") || /^[A-Za-z]:/.test(raw))
    return { ok: false, reason: "Absolute Pfade sind nicht erlaubt." };

  const parts = raw.split("/").filter((p) => p !== "" && p !== ".");
  if (parts.some((p) => p === ".."))
    return { ok: false, reason: "Pfadwechsel nach oben (`..`) ist nicht erlaubt." };

  const path = parts.join("/");
  const root = parts[0] ?? "";
  if (!(CODE_ANALYSIS_SCOPE as readonly string[]).includes(root))
    return {
      ok: false,
      reason: `Ziel liegt aussenhalb des Lesebereichs (erlaubt: ${CODE_ANALYSIS_SCOPE.join(", ")}).`,
    };
  if (CODE_ANALYSIS_DENY_PATTERNS.some((re) => re.test(path)))
    return { ok: false, reason: "Ziel ist ausdrücklich vom Lesen ausgeschlossen." };
  return { ok: true, path };
}

export function isPathInCodeScope(path: string): boolean {
  return normalizeCodeTarget(path).ok;
}

/* ------------------------------------------------- Zugangsdaten sperren */

/**
 * Entfernt mögliche Zugangsdaten aus gelesenem Code, bevor er zu einem Befund
 * wird. Die Maskierung ist absichtlich grob: lieber zu viel entfernen.
 */
export const SECRET_MASK = "[ENTFERNT]";

const SECRET_PATTERNS: readonly RegExp[] = [
  /\b(sk|rk)-[A-Za-z0-9_-]{8,}/g,
  /\bsb_(secret|publishable)_[A-Za-z0-9_-]{8,}/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g,
  /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  /\bwhsec_[A-Za-z0-9]{8,}/g,
  /\bghp_[A-Za-z0-9]{20,}/g,
];

const SECRET_ASSIGNMENT =
  /((?:API_?KEY|SECRET|SECRET_?KEY|TOKEN|PASSWORD|PASSWD|CREDENTIAL|PRIVATE_?KEY|SERVICE_?ROLE_?KEY)[A-Z0-9_]*)(\s*[:=]\s*)(["'`]?)([^\s"'`,;)]{4,})\3/gi;

export function redactSecrets(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) out = out.replace(re, SECRET_MASK);
  out = out.replace(
    SECRET_ASSIGNMENT,
    (_m, key, sep, quote) => `${key}${sep}${quote}${SECRET_MASK}${quote}`,
  );
  return out;
}

/** Wahr, wenn die Zeile nach der Maskierung noch wie ein Schlüssel aussieht. */
export function containsSecretMaterial(text: string): boolean {
  return redactSecrets(text) !== text;
}

/* -------------------------------------------------------- Anforderung */

export const CODE_ANALYSIS_MODES = ["read_only"] as const;
export type CodeAnalysisMode = (typeof CODE_ANALYSIS_MODES)[number];

/** Quellen, die eine Codeanalyse anfordern dürfen. */
export const CODE_ANALYSIS_SOURCES = ["orb_internal", "admin_ui", "admin_chat"] as const;
export type CodeAnalysisSource = (typeof CODE_ANALYSIS_SOURCES)[number];

/**
 * Quellen, die NIE eine Codeanalyse auslösen dürfen: normale Nachrichten,
 * autonome Fragen, Neugier, Gedächtnis, Graph, Sprachmodell.
 */
export const FORBIDDEN_CODE_ANALYSIS_SOURCES = [
  "orb_chat_message",
  "orb_autonomous_question",
  "orb_curiosity",
  "orb_memory",
  "orb_graph",
  "llm",
  "system_prompt",
] as const;

export function isAllowedCodeAnalysisSource(source: string): source is CodeAnalysisSource {
  return (CODE_ANALYSIS_SOURCES as readonly string[]).includes(source);
}

export const CODE_REQUEST_ID_RE = /^orb_ca_[0-9a-f]{8,32}$/;

export function formatCodeRequestId(token: string): string {
  const clean = token
    .replace(/[^0-9a-f]/gi, "")
    .toLowerCase()
    .slice(0, 32);
  const id = `orb_ca_${clean.padEnd(8, "0")}`;
  if (!CODE_REQUEST_ID_RE.test(id)) throw new Error("Ungültige Code-Analyse-Kennung");
  return id;
}

export function isCodeRequestId(value: string): boolean {
  return CODE_REQUEST_ID_RE.test(value);
}

export type CodeAnalysisRequest = {
  capability: typeof ORB_CODE_ANALYSIS_CAPABILITY_ID;
  mode: CodeAnalysisMode;
  /** Projektrelatives Ziel innerhalb des Lesebereichs. */
  target: string;
  /** Technische Frage – kein Chattext, keine personenbezogenen Inhalte. */
  question: string;
  /** Technischer Analysegrund; ohne ihn wird nicht analysiert. */
  reason: string;
  requestId: string;
  source: CodeAnalysisSource;
  timeoutMs?: number;
};

export type CodeRequestCheck =
  | { ok: true }
  | { ok: false; status: CodeAnalysisStatus; reason: string };

/** Mindestlänge eines technischen Grundes – verhindert Leerbegründungen. */
export const MIN_REASON_LENGTH = 12;

/**
 * Vollständige, rein textuelle Prüfung einer Anforderung: Fähigkeit, Modus,
 * Quelle, Grund, Kennung und Lesebereich. Keine Berechtigungsprüfung (die
 * erfolgt serverseitig gegen die bestehende Administratorprüfung).
 */
export function checkCodeAnalysisRequest(request: unknown): CodeRequestCheck {
  const r = request as Partial<CodeAnalysisRequest> | null;
  if (!r || typeof r !== "object")
    return { ok: false, status: "ANALYSIS_DENIED", reason: "Keine Anforderung übergeben." };
  if (r.capability !== ORB_CODE_ANALYSIS_CAPABILITY_ID)
    return { ok: false, status: "ANALYSIS_DENIED", reason: "Unbekannte Fähigkeit angefordert." };
  if (r.mode !== "read_only")
    return {
      ok: false,
      status: "ANALYSIS_DENIED",
      reason: "Nur der Modus `read_only` ist zulässig; schreibende Modi sind gesperrt.",
    };
  if (typeof r.source !== "string" || !isAllowedCodeAnalysisSource(r.source))
    return {
      ok: false,
      status: "ANALYSIS_DENIED",
      reason:
        "Diese Quelle darf keine Codeanalyse anfordern (normale Nachrichten, autonome Fragen, " +
        "Neugier und Gedächtnis sind ausgeschlossen).",
    };
  if (typeof r.requestId !== "string" || !isCodeRequestId(r.requestId))
    return { ok: false, status: "ANALYSIS_DENIED", reason: "Ungültige Anforderungskennung." };
  if (typeof r.question !== "string" || r.question.trim().length < 5)
    return { ok: false, status: "ANALYSIS_DENIED", reason: "Keine technische Frage angegeben." };
  if (typeof r.reason !== "string" || r.reason.trim().length < MIN_REASON_LENGTH)
    return {
      ok: false,
      status: "ANALYSIS_DENIED",
      reason: "Es fehlt ein klarer technischer Analysegrund.",
    };
  const scope = normalizeCodeTarget(r.target);
  if (!scope.ok) return { ok: false, status: "ANALYSIS_DENIED", reason: scope.reason };
  return { ok: true };
}

/* ------------------------------------------------------------ Ergebnis */

export const CODE_ANALYSIS_STATES = [
  "COMPLETED",
  "ANALYSIS_UNAVAILABLE",
  "ANALYSIS_DENIED",
  "ANALYSIS_FAILED",
] as const;

export type CodeAnalysisStatus = (typeof CODE_ANALYSIS_STATES)[number];

export type CodeEvidence = {
  /** Projektrelative Datei innerhalb des Lesebereichs. */
  file: string;
  /** 1-basierte Zeile, wenn eindeutig bestimmbar. */
  line: number | null;
  /** Funktion/Symbol oder eindeutiger Codebereich. */
  symbol: string | null;
  /** Codeauszug – Zugangsdaten sind vorher entfernt. */
  excerpt: string;
};

export type CodeFinding = {
  code: string;
  severity: "info" | "warning" | "error";
  summary: string;
  /** Jeder Befund ist auf Code zurückführbar – niemals eine freie Behauptung. */
  evidence: CodeEvidence[];
};

export type CodeProposedChange = {
  summary: string;
  files: string[];
  /** Immer true – ein Vorschlag wird nie ohne Menschen wirksam. */
  requiresHumanApproval: true;
  /** Immer false – P21 wendet nichts an. */
  applied: false;
};

export type CodeAnalysisResult = {
  requestId: string;
  capability: typeof ORB_CODE_ANALYSIS_CAPABILITY_ID;
  mode: CodeAnalysisMode;
  source: CodeAnalysisSource;
  target: string;
  question: string;
  status: CodeAnalysisStatus;
  timestamp: string;
  durationMs: number;
  filesExamined: string[];
  findings: CodeFinding[];
  evidence: CodeEvidence[];
  confidence: "high" | "medium" | "low" | "none";
  unknowns: string[];
  proposedChange: CodeProposedChange[];
  affectedTests: string[];
  /** Technischer Fehlergrund ohne Inhalt. */
  failureKind: string | null;
  /** Unveränderliche Nachweise der Read-only-Grenze. */
  readOnly: true;
  codeChanged: false;
  dbChanged: false;
  patchApplied: false;
  migrationRun: false;
  deployed: false;
  approvalCreated: false;
  secretsAccessed: false;
  modelCalls: 0;
};

/* ---------------------------------------------- Selbstfeststellung (P21) */

/**
 * „Brauche ich eine Codeanalyse?" ORB darf das feststellen – aber nur im
 * ausdrücklich erlaubten Analysepfad. Für normale Nachrichten, autonome
 * Fragen, Neugier und Gedächtnis ist die Antwort immer `false`.
 */
export function assessCodeAnalysisNeed(input: {
  source: string;
  question: string;
  reason?: string;
}): { needed: boolean; reason: string } {
  if (!isAllowedCodeAnalysisSource(input.source))
    return {
      needed: false,
      reason: "Diese Quelle löst grundsätzlich keine Codeanalyse aus.",
    };
  const text = `${input.question} ${input.reason ?? ""}`.toLowerCase();
  const technical =
    /\b(code|datei|funktion|import|modul|capability|tool|wiring|runtime|fehler|exception|test|typ|build|adapter|resolver|registry)\b/.test(
      text,
    ) || /orb\.(analysis|code_analysis)/.test(text);
  return technical
    ? { needed: true, reason: "Die Frage besitzt einen technischen Analysegrund." }
    : { needed: false, reason: "Kein technischer Analysegrund erkennbar." };
}
