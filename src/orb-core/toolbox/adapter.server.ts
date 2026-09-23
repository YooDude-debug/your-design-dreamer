/**
 * ORB Toolbox Adapter – dünne, lesende Verbindung zwischen ORB Core und der
 * vorhandenen Analysestrecke (`src/orb-dev/*`).
 *
 * Harte Grenzen dieser Datei:
 *  · sie verändert keinen Code und keine Datei,
 *  · sie verändert keine ORB-Daten (kein INSERT, UPDATE, DELETE),
 *  · sie erzeugt keinen Fix-Vorschlag, keine Freigabe, keine Sandbox,
 *    kein Deployment und keine Migration,
 *  · sie ruft kein Sprachmodell auf (0 Modellaufrufe, keine Kosten),
 *  · sie bildet keine ORB-Logik nach (Memory, Graph, Curiosity, Energy,
 *    autonome Fragen bleiben ausschliesslich in ORB Core),
 *  · sie wirft nie: ein Fehler der Analyse blockiert ORB Core nicht.
 *
 * Sie wird NICHT aus dem normalen ORB-Verarbeitungspfad aufgerufen.
 * `src/orb-core/engine.server.ts` importiert diese Datei bewusst nicht.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import {
  UNSUPPORTED_ANALYSIS_REASON,
  formatAnalysisId,
  isSupportedAnalysisType,
  type ToolboxAnalysisRequest,
  type ToolboxAnalysisResult,
  type ToolboxFinding,
  type ToolboxRecommendation,
} from "@/orb-core/toolbox/contract";

type Db = SupabaseClient<Database>;

const DEFAULT_TIMEOUT_MS = 10_000;

/** Zufällige technische Kennung – ohne Rückschluss auf Nutzerdaten. */
function newToken(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Nur technische Kennungen übernehmen – nie freien Text, nie Inhalte. */
function safeId(value: string | null, prefix: string): string | null {
  if (typeof value !== "string") return null;
  return new RegExp(`^${prefix}_[0-9a-fA-F-]{8,40}$`).test(value) ? value : null;
}

/** Fehlergrund ohne Inhalt: kein Nachrichtentext, kein Schlüssel, keine Daten. */
function failureKindOf(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError" || /timeout|zeitüberschreitung/i.test(error.message))
      return "timeout";
    if (/fetch|network|unreachable|ECONN/i.test(error.message)) return "unavailable";
    return "analysis_error";
  }
  return "unknown";
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error("timeout");
      error.name = "AbortError";
      reject(error);
    }, ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error("unknown"));
      },
    );
  });
}

type Payload = { findings: ToolboxFinding[]; recommendations: ToolboxRecommendation[] };

/**
 * Analyse „memory_recall“ – verwendet die vorhandene READ-ONLY-Diagnose
 * (`diagnoseMemoryRecallCase`). Keine eigene Recall-Logik, keine Datenbank.
 */
async function analyzeMemoryRecall(): Promise<Payload> {
  const { diagnoseMemoryRecallCase } = await import("@/orb-dev/diagnose.server");
  const diagnosis = await diagnoseMemoryRecallCase();
  const blocked = diagnosis.chain.filter((step) => step.outcome !== "PASS");

  const findings: ToolboxFinding[] = [
    {
      code: `DIAGNOSIS_${diagnosis.rootCauseLevel}`,
      severity: blocked.length > 0 ? "error" : "info",
      summary: diagnosis.rootCause,
      evidence: [
        `Überschneidung = max(${diagnosis.reproduction.lexicalSimilarity.toFixed(3)}, ${diagnosis.reproduction.topicAffinity.toFixed(3)}) = ${diagnosis.reproduction.overlap.toFixed(3)}`,
        ...blocked.map((step) => `${step.stage}: ${step.outcome} – ${step.detail}`),
        ...diagnosis.codeTrace.slice(0, 4).map((trace) => `${trace.path}:${trace.line}`),
      ],
    },
  ];

  const recommendations: ToolboxRecommendation[] =
    diagnosis.rootCauseLevel === "ROOT_CAUSE_PROVEN"
      ? [
          {
            summary:
              "Bestätigte Ursache. Ein Fix-Vorschlag kann über die vorhandene " +
              "Reparaturstrecke im Admin-Bereich erzeugt und dort menschlich freigegeben werden.",
            files: diagnosis.codeTrace.slice(0, 4).map((trace) => trace.path),
            requiresHumanApproval: true,
            applied: false,
            proposalCandidate: true,
          },
        ]
      : [
          {
            summary:
              "Ursache nicht bestätigt. Keine Empfehlung zur Änderung – nur weitere Beobachtung.",
            files: [],
            requiresHumanApproval: true,
            applied: false,
            proposalCandidate: false,
          },
        ];

  return { findings, recommendations };
}

/**
 * Analyse „repair_pipeline_state“ – liest ausschliesslich den Zustand der
 * bestehenden Reparaturstrecke über deren vorhandene Leseschnittstellen.
 */
async function analyzeRepairPipeline(db: Db): Promise<Payload> {
  const repo = await import("@/orb-dev/repo.server");
  const proposals = await repo.listProposals(db, 50);
  const waiting = proposals.filter((p) => p.state === "WAITING_FOR_ADMIN_APPROVAL");

  const findings: ToolboxFinding[] = [
    {
      code: "REPAIR_PIPELINE_STATE",
      severity: waiting.length > 0 ? "warning" : "info",
      summary:
        `${proposals.length} Fix-Vorschläge gelesen, davon ${waiting.length} ` +
        "wartend auf menschliche Freigabe.",
      evidence: proposals
        .slice(0, 10)
        .map((p) => `${p.fixId} · ${p.state} · v${p.version} · ${p.files.length} Datei(en)`),
    },
  ];

  const recommendations: ToolboxRecommendation[] =
    waiting.length > 0
      ? [
          {
            summary: `${waiting.length} Vorschlag/Vorschläge warten auf eine Entscheidung im Admin-Bereich.`,
            files: [],
            requiresHumanApproval: true,
            applied: false,
            proposalCandidate: false,
          },
        ]
      : [];

  return { findings, recommendations };
}

/**
 * Einzige Schnittstelle ORB Core → Toolbox Analyse.
 *
 * Fehlerisolation: die Funktion wirft nie. Ist die Analyse nicht möglich,
 * nicht erreichbar oder zu langsam, liefert sie `status: "FAILED"` mit einem
 * technischen Fehlergrund. Der Aufrufer kann ohne Analyse normal weiterlaufen.
 */
export async function runToolboxAnalysis(
  db: Db,
  request: ToolboxAnalysisRequest,
): Promise<ToolboxAnalysisResult> {
  const startedAt = Date.now();
  const base = {
    analysisId: formatAnalysisId(newToken()),
    analysisType: request.analysisType,
    source: request.source,
    eventId: safeId(request.eventId, "evt"),
    requestId: safeId(request.requestId, "mrq"),
    timestamp: new Date().toISOString(),
    readOnly: true as const,
    codeChanged: false as const,
    dbChanged: false as const,
    proposalCreated: false as const,
    approvalCreated: false as const,
    deployed: false as const,
    modelCalls: 0 as const,
  };

  if (!isSupportedAnalysisType(request.analysisType)) {
    return {
      ...base,
      status: "UNSUPPORTED",
      durationMs: Date.now() - startedAt,
      findings: [
        {
          code: "ANALYSIS_NOT_SUPPORTED",
          severity: "info",
          summary:
            UNSUPPORTED_ANALYSIS_REASON[request.analysisType] ??
            "Für diese Analyseart existiert keine vorhandene Leseschnittstelle.",
          evidence: [],
        },
      ],
      recommendations: [],
      failureKind: null,
    };
  }

  try {
    const work =
      request.analysisType === "memory_recall" ? analyzeMemoryRecall() : analyzeRepairPipeline(db);
    const payload = await withTimeout(work, request.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    return {
      ...base,
      status: "COMPLETED",
      durationMs: Date.now() - startedAt,
      findings: payload.findings,
      recommendations: payload.recommendations,
      failureKind: null,
    };
  } catch (error) {
    return {
      ...base,
      status: "FAILED",
      durationMs: Date.now() - startedAt,
      findings: [],
      recommendations: [],
      failureKind: failureKindOf(error),
    };
  }
}
