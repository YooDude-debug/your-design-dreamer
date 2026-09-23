/**
 * ORB Core → vorhandene Analyse-Schnittstelle: minimaler interner Zugang (P10).
 *
 * Diese Datei schliesst genau eine Lücke: ORB Core konnte die bereits
 * vorhandene Analysestrecke bisher nicht erreichen, weil sie ausschliesslich
 * über administratorgeschützte Serverfunktionen (Admin-Oberfläche) zugänglich
 * war. Hier entsteht kein neuer Endpunkt, keine zweite Architektur und keine
 * neue Datenstruktur – nur ein interner Server-zu-Server-Aufruf auf den
 * vorhandenen lesenden Adapter (`runToolboxAnalysis`).
 *
 * Harte Grenzen:
 *  · rein lesend – kein Code, keine Datenänderung, keine Migration,
 *    kein Deployment, keine Freigabe, keine Konfiguration, keine Schlüssel,
 *  · die bestehende Administratorprüfung (`has_role`) bleibt erhalten;
 *    Berechtigungen werden NICHT aufgeweicht,
 *  · sie wirft nie: jeder Fehlerfall wird als `status: "FAILED"` mit
 *    technischem Grund gemeldet, damit ORB Core normal weiterläuft,
 *  · sie wird nur auf ausdrückliche Anforderung aufgerufen; der normale
 *    Verarbeitungspfad (Nachricht, Memory, Graph, Energy, Curiosity,
 *    autonome Fragen) ruft sie nicht auf,
 *  · keine Chattexte, keine personenbezogenen Inhalte – nur technische
 *    Kennungen (analysis_id, event_id, request_id).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CodeAnalysisRequest, CodeAnalysisResult } from "@/orb-core/toolbox/code-contract";

import {
  ORB_ANALYSIS_CAPABILITY_ID,
  ORB_INTERNAL_SOURCE,
  TOOLBOX_ANALYSIS_TYPES,
  findOrbCapability,
  formatAnalysisId,
  isSupportedAnalysisType,
  listOrbCapabilities,
  toolboxCapabilities,
  type OrbCapabilityDescriptor,
  type ToolboxAnalysisResult,
  type ToolboxAnalysisType,
} from "@/orb-core/toolbox/contract";

type Db = SupabaseClient<Database>;

/** Beschreibung des gefundenen Zugangs – rein statisch, ohne Datenbank. */
export type OrbAnalysisAccess = {
  available: true;
  /** Eindeutige Fähigkeitskennung (P12) – genau ein Name, kein zweiter. */
  capabilityId: typeof ORB_ANALYSIS_CAPABILITY_ID;
  /** Interner Server-zu-Server-Aufruf, keine Oberfläche, kein HTTP-Endpunkt. */
  transport: "internal_server_call";
  adapter: "src/orb-core/toolbox/adapter.server.ts#runToolboxAnalysis";
  source: typeof ORB_INTERNAL_SOURCE;
  /** Erforderliche Berechtigung – unverändert die bestehende Prüfung. */
  requiresAdminRole: true;
  readOnly: true;
  requiresHumanApprovalForAnyChange: true;
  analysis: readonly ToolboxAnalysisType[];
  supported: readonly ToolboxAnalysisType[];
};

/**
 * Auffindbarkeit: ORB Core kann den vorhandenen Analysezugang erkennen, ohne
 * ihn zu benutzen. Kein Datenbankzugriff, kein Modellaufruf, keine Kosten.
 */
export function discoverAnalysisAccess(): OrbAnalysisAccess {
  const caps = toolboxCapabilities();
  return {
    available: true,
    capabilityId: ORB_ANALYSIS_CAPABILITY_ID,
    transport: "internal_server_call",
    adapter: "src/orb-core/toolbox/adapter.server.ts#runToolboxAnalysis",
    source: ORB_INTERNAL_SOURCE,
    requiresAdminRole: true,
    readOnly: true,
    requiresHumanApprovalForAnyChange: true,
    analysis: caps.analysis,
    supported: caps.supported,
  };
}

/**
 * Discovery (P12): „Welche Analysefähigkeiten stehen ORB zur Verfügung?"
 * Reine Aufzählung des Verzeichnisses – kein Datenbankzugriff, kein
 * Modellaufruf, keine Analyse, keine Berechtigungsprüfung (es wird nichts
 * gelesen). Die Administratorprüfung erfolgt erst beim Auflösen bzw. Anfordern.
 */
export function listAnalysisCapabilities(): readonly OrbCapabilityDescriptor[] {
  return listOrbCapabilities();
}

/** Aufgelöste, rein lesende Fähigkeit: Anforderung möglich, Änderung nie. */
export type ResolvedOrbCapability = OrbCapabilityDescriptor & {
  /** Der vorhandene Zugang – kein neuer Pfad, nur eine Referenz darauf. */
  request: (
    db: Db,
    userId: string,
    request: OrbAnalysisRequest | CodeAnalysisRequest,
  ) => Promise<ToolboxAnalysisResult | CodeAnalysisResult>;
};

/**
 * Resolver: Fähigkeitskennung → vorhandener interner Zugang. Unbekannte
 * Kennungen ergeben `null` statt einer Ausnahme, damit ORB normal weiterläuft.
 */
export function resolveOrbCapability(capabilityId: string): ResolvedOrbCapability | null {
  const descriptor = findOrbCapability(capabilityId);
  if (!descriptor) return null;
  if (descriptor.kind === "code_analysis")
    return {
      ...descriptor,
      request: async (db, userId, request) => {
        const { runCodeAnalysis } = await import("@/orb-core/toolbox/code-analysis.server");
        return runCodeAnalysis(db, userId, request as CodeAnalysisRequest);
      },
    };
  return {
    ...descriptor,
    request: (db, userId, request) => requestOrbAnalysis(db, userId, request as OrbAnalysisRequest),
  };
}

/**
 * P21 – ausdrückliche, rein lesende Codeanalyse über den vorhandenen
 * Analysepfad. Fehlerisoliert: ein Ladefehler blockiert ORB nicht.
 */
export async function requestOrbCodeAnalysis(
  db: Db,
  userId: string,
  request: CodeAnalysisRequest,
): Promise<CodeAnalysisResult> {
  const { runCodeAnalysis } = await import("@/orb-core/toolbox/code-analysis.server");
  return runCodeAnalysis(db, userId, request);
}

/** Fehlerergebnis in der bestehenden Ergebnisform – ORB läuft normal weiter. */
function failed(
  analysisType: ToolboxAnalysisType,
  failureKind: string,
  summary: string,
  identity: { eventId: string | null; requestId: string | null },
): ToolboxAnalysisResult {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return {
    analysisId: formatAnalysisId(
      Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""),
    ),
    analysisType,
    status: "FAILED",
    source: ORB_INTERNAL_SOURCE,
    eventId: identity.eventId,
    requestId: identity.requestId,
    timestamp: new Date().toISOString(),
    durationMs: 0,
    findings: [{ code: "ANALYSIS_ACCESS_DENIED", severity: "info", summary, evidence: [] }],
    recommendations: [],
    failureKind,
    readOnly: true,
    codeChanged: false,
    dbChanged: false,
    proposalCreated: false,
    approvalCreated: false,
    deployed: false,
    modelCalls: 0,
  };
}

export type OrbAnalysisRequest = {
  analysisType: ToolboxAnalysisType;
  /** Technische Ereigniskennung (evt_…) aus der Beobachtungsschicht. */
  eventId?: string | null;
  /** Technische Modellaufrufkennung (mrq_…). */
  requestId?: string | null;
  timeoutMs?: number;
};

/**
 * Einziger interner Zugang ORB Core → vorhandene Analyse.
 *
 * Der übergebene Datenzugang ist der angemeldete (RLS-gebundene) Client des
 * Benutzers; die Administratorrolle wird darüber mit der bestehenden
 * `has_role`-Prüfung bestätigt. Fehlt sie, entsteht ein sauberer Fehler statt
 * einer Analyse – und keine Ausnahme.
 */
export async function requestOrbAnalysis(
  db: Db,
  userId: string,
  request: OrbAnalysisRequest,
): Promise<ToolboxAnalysisResult> {
  const identity = { eventId: request.eventId ?? null, requestId: request.requestId ?? null };

  if (!TOOLBOX_ANALYSIS_TYPES.includes(request.analysisType))
    return failed(
      request.analysisType,
      "unsupported_request",
      "Unbekannte Analyseart – keine Analyse ausgeführt.",
      identity,
    );

  // Bestehende Administratorprüfung – unverändert, nicht aufgeweicht.
  try {
    const { data, error } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (error || data !== true)
      return failed(
        request.analysisType,
        "unauthorized",
        "Die technische Analyse ist ausschliesslich für Administratoren zugänglich.",
        identity,
      );
  } catch {
    return failed(
      request.analysisType,
      "unauthorized",
      "Berechtigung konnte nicht bestätigt werden – keine Analyse ausgeführt.",
      identity,
    );
  }

  // Fehlerisolation: auch ein Ladefehler des Adapters blockiert ORB nicht.
  try {
    const { runToolboxAnalysis } = await import("@/orb-core/toolbox/adapter.server");
    return await runToolboxAnalysis(db, {
      analysisType: request.analysisType,
      source: ORB_INTERNAL_SOURCE,
      eventId: identity.eventId,
      requestId: identity.requestId,
      ...(request.timeoutMs === undefined ? {} : { timeoutMs: request.timeoutMs }),
    });
  } catch {
    return failed(
      request.analysisType,
      "unavailable",
      "Der Analysezugang ist nicht erreichbar – ORB arbeitet normal weiter.",
      identity,
    );
  }
}

/** Nur zur Dokumentation: welche Analysearten heute tatsächlich laufen. */
export function isAnalysisAvailable(type: ToolboxAnalysisType): boolean {
  return isSupportedAnalysisType(type);
}
