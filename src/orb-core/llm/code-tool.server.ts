/**
 * P22 – Runtime-Wiring für genau EIN Werkzeug: `orb.code_analysis`.
 *
 * Kein allgemeines Tool-System. Diese Datei:
 *  · erkennt eine AUSDRÜCKLICHE technische Analyseanforderung (fester Marker),
 *  · prüft die bestehende Administratorrolle (`has_role`), bevor überhaupt ein
 *    Werkzeug an das Modell gereicht wird,
 *  · beschreibt das eine Werkzeug für die Sprachschicht,
 *  · führt Werkzeugaufrufe ausschliesslich über den bestehenden P21-Zugang
 *    (`requestOrbCodeAnalysis` → `runCodeAnalysis`) aus – keine Duplikation,
 *  · gibt das Ergebnis an das Modell zurück.
 *
 * Harte Grenzen: nur lesen; keine Credentials im Werkzeugkontext; höchstens
 * MAX_TOOL_ROUNDS Werkzeugrunden; jeder Fehler wird isoliert und als
 * Werkzeugergebnis gemeldet – ORB antwortet immer weiter.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  ORB_CODE_ANALYSIS_CAPABILITY_ID,
  formatCodeRequestId,
  type CodeAnalysisResult,
} from "@/orb-core/toolbox/code-contract";

type Db = SupabaseClient<Database>;

/** Modellseitiger Name (Punkte sind in Funktionsnamen nicht zulässig). */
export const CODE_TOOL_MODEL_NAME = "orb_code_analysis";
/** Laufzeit-Zuordnung Modellname → Fähigkeit. Genau ein Eintrag. */
export const CODE_TOOL_CAPABILITY = ORB_CODE_ANALYSIS_CAPABILITY_ID;
export const MAX_TOOL_ROUNDS = 3;
const MAX_TOOL_OUTPUT_CHARS = 12_000;

/**
 * Ausdrückliche Anforderung: die Nachricht beginnt mit „Codeanalyse:“ oder
 * „/codeanalyse“. Alles andere ist eine normale Nachricht und erhält KEIN
 * Werkzeug.
 */
const EXPLICIT_MARKER = /^\s*(?:\/codeanalyse\b|codeanalyse\s*:)/i;

export function isExplicitCodeAnalysisRequest(text: string): boolean {
  return EXPLICIT_MARKER.test(text);
}

/** Werkzeugdefinition (Responses-API-Format) – genau ein Werkzeug. */
export const CODE_TOOL_DEFINITION = {
  type: "function",
  name: CODE_TOOL_MODEL_NAME,
  description:
    "orb.code_analysis – rein lesende technische Codeanalyse des ORB-Projekts. " +
    "Liest Dateien/Ordner ausschliesslich in src/, tests/ oder docs/, sucht Referenzen " +
    "und liefert Befunde mit Code-Belegen. Schreibt nichts, wendet nichts an. " +
    "Nur bei status SUCCESS_WITH_FILES wurde Code gelesen; sonst den Status wörtlich nennen.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      target: {
        type: "string",
        description: "Projektrelativer Pfad in src/, tests/ oder docs/, z.B. src/orb-core/llm",
      },
      question: { type: "string", description: "Technische Frage an diesen Code." },
      reason: { type: "string", description: "Technischer Grund der Analyse (min. 12 Zeichen)." },
    },
    required: ["target", "question", "reason"],
  },
} as const;

export type CodeToolCall = { callId: string; name: string; arguments: string };

/** Protokoll eines Werkzeugaufrufs – nur Kennungen und Kennzahlen. */
export type CodeToolTrace = {
  requestId: string;
  target: string;
  status: CodeAnalysisResult["status"] | "REJECTED";
  filesExamined: string[];
  findings: number;
};

export type CodeToolRuntime = {
  capability: typeof CODE_TOOL_CAPABILITY;
  execute: (call: CodeToolCall, index: number) => Promise<{ output: string; trace: CodeToolTrace }>;
};

function eventHex(eventId: string): string {
  return eventId.replace(/[^0-9a-f]/gi, "").toLowerCase();
}

/** Gleiche Ereigniskennung + gleicher Index ⇒ gleiche Anforderungskennung (Idempotenz). */
export function codeToolRequestId(eventId: string, index: number): string {
  const hex = eventHex(eventId).slice(0, 30).padEnd(30, "0");
  return formatCodeRequestId(`${hex}${index.toString(16).padStart(2, "0").slice(-2)}`);
}

function compact(result: CodeAnalysisResult): string {
  const payload = {
    capability: result.capability,
    requestId: result.requestId,
    status: result.status,
    failureKind: result.failureKind,
    codeSource: result.codeSource,
    filesRead: result.filesExamined.length,
    note:
      result.status === "SUCCESS_WITH_FILES"
        ? `Es wurden ${result.filesExamined.length} Datei(en) tatsächlich gelesen.`
        : `Es wurde KEINE Datei gelesen (Status ${result.status}). Das Werkzeug ist vorhanden. ` +
          "Behaupte nicht, Code analysiert zu haben; nenne diesen Status ausdrücklich.",
    target: result.target,
    filesExamined: result.filesExamined,
    findings: result.findings,
    evidence: result.evidence,
    unknowns: result.unknowns,
    proposedChange: result.proposedChange,
    confidence: result.confidence,
    readOnly: result.readOnly,
    patchApplied: result.patchApplied,
  };
  const json = JSON.stringify(payload);
  return json.length > MAX_TOOL_OUTPUT_CHARS ? `${json.slice(0, MAX_TOOL_OUTPUT_CHARS)}…` : json;
}

/**
 * Laufzeitkontext für eine ausdrückliche Anforderung. Liefert `null`, wenn die
 * Nachricht nicht ausdrücklich ist oder die Administratorrolle fehlt – dann
 * sieht das Modell kein Werkzeug.
 */
export async function prepareCodeToolRuntime(
  db: Db,
  userId: string,
  text: string,
  eventId: string,
): Promise<CodeToolRuntime | null> {
  if (!isExplicitCodeAnalysisRequest(text)) return null;
  try {
    const { data, error } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (error || data !== true) return null;
  } catch {
    return null;
  }
  return {
    capability: CODE_TOOL_CAPABILITY,
    async execute(call, index) {
      const requestId = codeToolRequestId(eventId, index);
      const reject = (reason: string) => ({
        output: JSON.stringify({ capability: CODE_TOOL_CAPABILITY, status: "REJECTED", reason }),
        trace: {
          requestId,
          target: "",
          status: "REJECTED" as const,
          filesExamined: [],
          findings: 0,
        },
      });
      if (call.name !== CODE_TOOL_MODEL_NAME) return reject("Unbekanntes Werkzeug.");
      let args: { target?: unknown; question?: unknown; reason?: unknown };
      try {
        args = JSON.parse(call.arguments || "{}");
      } catch {
        return reject("Ungültige Werkzeugargumente.");
      }
      try {
        const { requestOrbCodeAnalysis } = await import("@/orb-core/toolbox/access.server");
        // Bestehender P21-Zugang: Vertrag, Idempotenz, Adminprüfung, Lesebereich.
        const result = await requestOrbCodeAnalysis(db, userId, {
          capability: CODE_TOOL_CAPABILITY,
          mode: "read_only",
          target: String(args.target ?? ""),
          question: String(args.question ?? ""),
          reason: String(args.reason ?? ""),
          requestId,
          source: "admin_chat",
        });
        return {
          output: compact(result),
          trace: {
            requestId,
            target: result.target,
            status: result.status,
            filesExamined: result.filesExamined,
            findings: result.findings.length,
          },
        };
      } catch {
        return reject("Codeanalyse nicht erreichbar – ORB arbeitet normal weiter.");
      }
    },
  };
}

/** Ein Modellschritt: liefert Text und/oder Werkzeugaufrufe. */
export type ToolModelStep = (input: {
  items: unknown[];
  toolsAllowed: boolean;
}) => Promise<{ text: string; calls: CodeToolCall[] } | null>;

/**
 * Begrenzte Werkzeugschleife. Nach MAX_TOOL_ROUNDS wird das Werkzeug
 * entzogen und eine Textantwort erzwungen.
 */
export async function runCodeToolLoop(input: {
  userText: string;
  runtime: CodeToolRuntime;
  step: ToolModelStep;
}): Promise<{ reply: string; traces: CodeToolTrace[] } | null> {
  const items: unknown[] = [
    { role: "user", content: [{ type: "input_text", text: input.userText }] },
  ];
  const traces: CodeToolTrace[] = [];
  let index = 0;
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const toolsAllowed = round < MAX_TOOL_ROUNDS;
    const res = await input.step({ items, toolsAllowed });
    if (!res) return null;
    if (res.calls.length === 0 || !toolsAllowed) {
      const reply = res.text.trim();
      return reply ? { reply, traces } : null;
    }
    for (const call of res.calls) {
      const { output, trace } = await input.runtime.execute(call, index++);
      traces.push(trace);
      items.push({
        type: "function_call",
        call_id: call.callId,
        name: call.name,
        arguments: call.arguments,
      });
      items.push({ type: "function_call_output", call_id: call.callId, output });
    }
  }
  return null;
}
