/**
 * P21 – ORB Code Analysis: der einzige serverinterne Analysezugang auf den
 * Projekt-Code (`orb.code_analysis`).
 *
 * Er liegt bewusst im vorhandenen Toolbox-/Analysepfad und baut KEINE zweite
 * Analysearchitektur: gleicher Vertrag (`code-contract.ts`), gleicher
 * Resolver (`access.server.ts`), gleiche Grundsätze.
 *
 * Harte Grenzen:
 *  · rein lesend – keine Datei wird geschrieben, kein Patch angewendet,
 *    keine Migration, kein Deployment, keine Veröffentlichung,
 *  · keine Zugangsdaten: gelesene Inhalte werden vorher maskiert,
 *  · nur der vorgesehene Lesebereich (src, tests, docs),
 *  · bestehende Administratorprüfung (`has_role`) bleibt unverändert,
 *  · sie wirft nie: jeder Fehlerfall wird als CODE_ACCESS_UNAVAILABLE /
 *    ACCESS_DENIED / NO_FILES_FOUND / ANALYSIS_FAILED gemeldet, ORB läuft normal weiter,
 *  · gleiche `request_id` ⇒ dasselbe Ergebnis, keine zweite Ausführung,
 *  · 0 Modellaufrufe.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import {
  ORB_CODE_ANALYSIS_CAPABILITY_ID,
  checkCodeAnalysisRequest,
  checkCodeOperationAllowed,
  normalizeCodeTarget,
  type CodeAnalysisRequest,
  type CodeAnalysisResult,
  type CodeAnalysisStatus,
  type CodeEvidence,
  type CodeFinding,
  type CodeProposedChange,
} from "@/orb-core/toolbox/code-contract";
import {
  CodeAccessUnavailableError,
  collectCodeFiles,
  excerpt,
  getCodeSource,
  findImporters,
  readCodeFile,
  searchCode,
  symbolAt,
} from "@/orb-core/toolbox/code-read.server";

type Db = SupabaseClient<Database>;

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TARGET_FILES = 40;
const IDEMPOTENCY_LIMIT = 50;

/** Idempotenz: gleiche Anforderungskennung führt die Analyse nicht erneut aus. */
const resultsByRequestId = new Map<string, CodeAnalysisResult>();

function remember(result: CodeAnalysisResult): CodeAnalysisResult {
  resultsByRequestId.set(result.requestId, result);
  if (resultsByRequestId.size > IDEMPOTENCY_LIMIT) {
    const oldest = resultsByRequestId.keys().next().value;
    if (oldest !== undefined) resultsByRequestId.delete(oldest);
  }
  return result;
}

/** Nur für Tests/Diagnose: die Idempotenzablage leeren. Ändert keine Daten. */
export function clearCodeAnalysisCache(): void {
  resultsByRequestId.clear();
}

function base(
  request: Partial<CodeAnalysisRequest>,
  status: CodeAnalysisStatus,
  startedAt: number,
): CodeAnalysisResult {
  return {
    requestId: typeof request.requestId === "string" ? request.requestId : "orb_ca_00000000",
    capability: ORB_CODE_ANALYSIS_CAPABILITY_ID,
    mode: "read_only",
    source: request.source ?? "orb_internal",
    target: typeof request.target === "string" ? request.target : "",
    question: typeof request.question === "string" ? request.question : "",
    status,
    timestamp: new Date().toISOString(),
    durationMs: Math.max(0, Date.now() - startedAt),
    filesExamined: [],
    findings: [],
    evidence: [],
    confidence: "none",
    unknowns: [],
    proposedChange: [],
    affectedTests: [],
    failureKind: null,
    codeSource: null,
    readOnly: true,
    codeChanged: false,
    dbChanged: false,
    patchApplied: false,
    migrationRun: false,
    deployed: false,
    approvalCreated: false,
    secretsAccessed: false,
    modelCalls: 0,
  };
}

function refused(
  request: Partial<CodeAnalysisRequest>,
  status: CodeAnalysisStatus,
  failureKind: string,
  reason: string,
  startedAt: number,
): CodeAnalysisResult {
  const result = base(request, status, startedAt);
  return {
    ...result,
    failureKind,
    findings: [{ code: status, severity: "info", summary: reason, evidence: [] }],
  };
}

/**
 * Schreibende Anforderung an die Codeanalyse. Existiert, damit eine Ablehnung
 * nachvollziehbar dokumentiert wird – ausgeführt wird niemals etwas.
 */
export function requestCodeWriteOperation(operation: string): { allowed: false; reason: string } {
  const decision = checkCodeOperationAllowed(operation);
  return {
    allowed: false,
    reason: decision.allowed ? "Nur lesende Operationen sind erlaubt." : decision.reason,
  };
}

/* ------------------------------------------------------------- Analyse */

function evidenceFrom(file: string, lines: readonly string[], line: number): CodeEvidence {
  return {
    file,
    line,
    symbol: symbolAt(lines, line),
    excerpt: excerpt(lines[line - 1] ?? ""),
  };
}

/** Technische Suchbegriffe aus der Frage – ohne Füllwörter, ohne Chatinhalt. */
function questionTerms(question: string): string[] {
  const stop = new Set([
    "warum",
    "wieso",
    "weshalb",
    "kann",
    "nicht",
    "aktuell",
    "wird",
    "werden",
    "welche",
    "welcher",
    "welches",
    "eine",
    "einen",
    "einem",
    "eines",
    "der",
    "die",
    "das",
    "und",
    "oder",
    "ich",
    "als",
    "aufrufen",
    "mich",
    "sich",
    "ist",
    "sind",
    "wie",
    "was",
    "wer",
    "wo",
    "für",
    "mit",
    "von",
    "dem",
    "den",
    "bei",
    "auf",
    "dass",
  ]);
  return Array.from(
    new Set(
      question
        .toLowerCase()
        .split(/[^a-z0-9_.]+/)
        .filter((w) => w.length >= 4 && !stop.has(w)),
    ),
  ).slice(0, 6);
}

async function analyseTarget(request: CodeAnalysisRequest): Promise<{
  filesExamined: string[];
  findings: CodeFinding[];
  evidence: CodeEvidence[];
  unknowns: string[];
  proposedChange: CodeProposedChange[];
  affectedTests: string[];
}> {
  const scope = normalizeCodeTarget(request.target);
  if (!scope.ok) throw new Error("scope");

  const files = await collectCodeFiles(scope.path, MAX_TARGET_FILES);
  const filesExamined: string[] = [];
  const findings: CodeFinding[] = [];
  const evidence: CodeEvidence[] = [];
  const unknowns: string[] = [];
  const proposedChange: CodeProposedChange[] = [];
  const affectedTests: string[] = [];

  // 1) Struktur des Ziels: welche Symbole existieren, wo?
  const structure: CodeEvidence[] = [];
  for (const file of files) {
    const read = await readCodeFile(file);
    if (!read.ok) {
      unknowns.push(`${file}: ${read.reason}`);
      continue;
    }
    filesExamined.push(file);
    for (let i = 0; i < read.lines.length && structure.length < 25; i += 1) {
      if (/^export\s+(async\s+)?(function|const|class|type|interface)\s/.test(read.lines[i] ?? ""))
        structure.push(evidenceFrom(file, read.lines, i + 1));
    }
  }
  if (structure.length > 0)
    findings.push({
      code: "CODE_STRUCTURE",
      severity: "info",
      summary: `Ziel gelesen: ${filesExamined.length} Datei(en), ${structure.length} öffentliche Symbole nachgewiesen.`,
      evidence: structure.slice(0, 10),
    });
  evidence.push(...structure.slice(0, 10));

  // 2) Fragebezogene Treffer im Ziel – jeder Befund mit Datei/Zeile.
  const terms = questionTerms(request.question);
  for (const term of terms) {
    const matches = await searchCode(term, {
      target: scope.path,
      maxMatches: 8,
      maxFiles: MAX_TARGET_FILES,
    });
    if (matches.length === 0) {
      unknowns.push(`Begriff „${term}" kommt im Ziel nicht vor.`);
      continue;
    }
    const ev: CodeEvidence[] = [];
    for (const m of matches) {
      const read = await readCodeFile(m.file);
      ev.push(
        read.ok
          ? evidenceFrom(m.file, read.lines, m.line)
          : { file: m.file, line: m.line, symbol: null, excerpt: m.excerpt },
      );
    }
    findings.push({
      code: "CODE_REFERENCE",
      severity: "info",
      summary: `„${term}": ${matches.length} Codestelle(n) im Ziel.`,
      evidence: ev,
    });
    evidence.push(...ev.slice(0, 3));
  }

  // 3) Feste technische Sonde: Werkzeug-Verdrahtung (P17 nachvollziehen).
  const asksAboutTools = /tool|werkzeug|orb\.analysis|callable|aufrufbar|wiring/i.test(
    `${request.question} ${request.reason}`,
  );
  // P25: Aussagen über die Sprachschicht nur, wenn sie tatsächlich gelesen wurde.
  const llmReadable =
    asksAboutTools && (await collectCodeFiles("src/orb-core/llm", MAX_TARGET_FILES)).length > 0;
  if (asksAboutTools && !llmReadable)
    unknowns.push(
      "Sprachschicht (src/orb-core/llm) nicht lesbar – keine Aussage über ein Werkzeugprotokoll.",
    );
  if (llmReadable) {
    const toolMatches = await searchCode(/\btools?\s*:|\btool_choice\b/, {
      target: "src/orb-core/llm",
      maxMatches: 10,
    });
    const requestLines = await searchCode(/messages\s*:/, {
      target: "src/orb-core/llm",
      maxMatches: 6,
    });
    const requestEvidence: CodeEvidence[] = [];
    for (const m of requestLines) {
      const read = await readCodeFile(m.file);
      requestEvidence.push(
        read.ok
          ? evidenceFrom(m.file, read.lines, m.line)
          : { file: m.file, line: m.line, symbol: null, excerpt: m.excerpt },
      );
    }
    if (toolMatches.length === 0) {
      findings.push({
        code: "CODE_NO_TOOL_PROTOCOL",
        severity: "error",
        summary:
          "Die Sprachschicht besitzt kein Werkzeug-Protokoll: in den Modellanfragen unter " +
          "src/orb-core/llm existiert keine Werkzeugliste (`tools` / `tool_choice`). Das Modell kann " +
          "`orb.analysis` deshalb nicht als Werkzeug aufrufen – der Zugang ist ausschliesslich " +
          "serverintern aufrufbar.",
        evidence: requestEvidence.slice(0, 4),
      });
      evidence.push(...requestEvidence.slice(0, 2));
      proposedChange.push({
        summary:
          "Beschrieben, nicht angewendet (P17/F1): den vorhandenen adminpflichtigen Analysezugang an " +
          "eine Oberfläche bzw. Serverfunktion anbinden. Alternative F2 (echtes Werkzeug-Protokoll im " +
          "Prompt-/Antwortpfad) ist ein grösserer Eingriff und benötigt eine eigene Freigabe.",
        files: ["src/orb-core/llm/provider.server.ts", "src/lib/orb-toolbox.functions.ts"],
        requiresHumanApproval: true,
        applied: false,
      });
    } else {
      findings.push({
        code: "CODE_TOOL_PROTOCOL_PRESENT",
        severity: "info",
        summary: `Werkzeugfeld in ${toolMatches.length} Codestelle(n) gefunden.`,
        evidence: toolMatches
          .slice(0, 4)
          .map((m) => ({ file: m.file, line: m.line, symbol: null, excerpt: m.excerpt })),
      });
    }

    const importers = await findImporters("src/lib/orb-toolbox.functions.ts", "src");
    if (importers.length === 0 && filesExamined.length > 0)
      findings.push({
        code: "CODE_ACCESS_WITHOUT_UI",
        severity: "warning",
        summary:
          "Die adminpflichtigen Analyse-Serverfunktionen in src/lib/orb-toolbox.functions.ts haben " +
          "keinen Importeur im Projektcode: vorhanden und geschützt, aber von keiner Oberfläche benutzt.",
        evidence: [],
      });

    for (const t of await searchCode("orb.analysis", { target: "tests", maxMatches: 6 }))
      if (!affectedTests.includes(t.file)) affectedTests.push(t.file);
  }

  for (const t of await searchCode("code_analysis", { target: "tests", maxMatches: 6 }))
    if (!affectedTests.includes(t.file)) affectedTests.push(t.file);

  return { filesExamined, findings, evidence, unknowns, proposedChange, affectedTests };
}

/* --------------------------------------------------------- Einstiegspunkt */

/**
 * Einziger Einstieg in die Codeanalyse. Reihenfolge: Vertrag → Idempotenz →
 * bestehende Administratorprüfung → lesende Analyse.
 */
export async function runCodeAnalysis(
  db: Db,
  userId: string,
  request: CodeAnalysisRequest,
): Promise<CodeAnalysisResult> {
  const startedAt = Date.now();

  const check = checkCodeAnalysisRequest(request);
  if (!check.ok) return refused(request, check.status, "invalid_request", check.reason, startedAt);

  const cached = resultsByRequestId.get(request.requestId);
  if (cached) return cached;

  // Bestehende Administratorprüfung – unverändert, nicht aufgeweicht.
  try {
    const { data, error } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (error || data !== true)
      return refused(
        request,
        "ACCESS_DENIED",
        "unauthorized",
        "Die technische Codeanalyse ist ausschliesslich für Administratoren zugänglich.",
        startedAt,
      );
  } catch {
    return refused(
      request,
      "ACCESS_DENIED",
      "unauthorized",
      "Berechtigung konnte nicht bestätigt werden – keine Analyse ausgeführt.",
      startedAt,
    );
  }

  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const analysis = await Promise.race([
      analyseTarget(request),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);
    const source = await getCodeSource();
    if (analysis.filesExamined.length === 0) {
      // P25: ohne gelesene Datei niemals Erfolg, keine Befunde, keine Vorschläge.
      return remember({
        ...base(request, "NO_FILES_FOUND", startedAt),
        failureKind: "no_files",
        codeSource: source.kind,
        unknowns: analysis.unknowns,
        findings: [
          {
            code: "NO_FILES_FOUND",
            severity: "info",
            summary:
              `Codezugang vorhanden (${source.kind}), aber im Ziel „${request.target}" wurde keine ` +
              "lesbare Datei gefunden. Es wurde nichts analysiert.",
            evidence: [],
          },
        ],
      });
    }
    const evidenceCount = analysis.evidence.length;
    const result: CodeAnalysisResult = {
      ...base(request, "SUCCESS_WITH_FILES", startedAt),
      codeSource: source.kind,
      filesExamined: analysis.filesExamined,
      findings: analysis.findings,
      evidence: analysis.evidence,
      unknowns: analysis.unknowns,
      proposedChange: analysis.proposedChange,
      affectedTests: analysis.affectedTests,
      confidence: evidenceCount >= 4 ? "high" : evidenceCount >= 1 ? "medium" : "none",
    };
    return remember(result);
  } catch (error) {
    if (error instanceof CodeAccessUnavailableError)
      return refused(
        request,
        "CODE_ACCESS_UNAVAILABLE",
        "unavailable",
        "Das Werkzeug ist vorhanden, aber im aktuellen Laufzeitumfeld ist kein Projektcode " +
          "erreichbar. Es wurde keine Datei gelesen – ORB arbeitet normal weiter.",
        startedAt,
      );
    const kind =
      error instanceof Error && error.message === "timeout" ? "timeout" : "analysis_error";
    return refused(
      request,
      "ANALYSIS_FAILED",
      kind,
      "Die Codeanalyse konnte nicht abgeschlossen werden – ORB arbeitet normal weiter.",
      startedAt,
    );
  }
}
