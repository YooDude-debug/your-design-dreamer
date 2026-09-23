/**
 * ORB → Toolbox Analyse – serverseitige Schnittstelle (nur Administratoren).
 *
 * Jede Funktion erzwingt serverseitig:
 *  · angemeldeter Nutzer (requireSupabaseAuth),
 *  · Administratorrolle (bestehende `has_role`-Prüfung über assertAdmin).
 *
 * Der erste Integrationsstand ist READ-ONLY: es entsteht kein Code, kein
 * Fix-Vorschlag, keine Freigabe, keine Sandbox, kein Deployment, keine
 * Migration und kein Modellaufruf. Die einzige Schreiboperation ist der
 * Eintrag in das bereits vorhandene, anfügende Prüfprotokoll
 * (`orb_dev_audit_log`) – ohne Chattext und ohne personenbezogene Inhalte.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  TOOLBOX_ANALYSIS_TYPES,
  TOOLBOX_SOURCES,
  type ToolboxAnalysisResult,
} from "@/orb-core/toolbox/contract";

/** Fähigkeiten und harte Grenzen der Toolbox – für die Anzeige im Admin-Bereich. */
export const orbToolboxCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { toolboxCapabilities } = await import("@/orb-core/toolbox/contract");
    return toolboxCapabilities();
  });

/**
 * Eine lesende Analyse anfordern. Der angeforderte Typ wird serverseitig
 * geprüft; nicht unterstützte Typen liefern einen dokumentierten Hinweis
 * statt einer erfundenen Analyse.
 */
export const orbToolboxAnalyze = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        analysisType: z.enum(TOOLBOX_ANALYSIS_TYPES),
        source: z.enum(TOOLBOX_SOURCES),
        /** Nur technische Kennungen – niemals Nachrichtentext. */
        eventId: z.string().max(80).nullable().optional(),
        requestId: z.string().max(80).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<ToolboxAnalysisResult> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);

    const { runToolboxAnalysis } = await import("@/orb-core/toolbox/adapter.server");
    const result = await runToolboxAnalysis(context.supabase, {
      analysisType: data.analysisType,
      source: data.source,
      eventId: data.eventId ?? null,
      requestId: data.requestId ?? null,
    });

    // Anfügendes Prüfprotokoll: nur technische Kennungen, keine Inhalte.
    try {
      const { audit } = await import("@/orb-dev/repo.server");
      await audit(context.supabase, adminId, {
        action: `TOOLBOX_ANALYSIS_${result.status}`,
        fixId: null,
        previousState: null,
        newState: null,
        files: [],
        result: `${result.analysisType}: ${result.findings.length} Befund(e), ${result.recommendations.length} Empfehlung(en)`,
        metadata: {
          analysisId: result.analysisId,
          analysisType: result.analysisType,
          status: result.status,
          source: result.source,
          eventId: result.eventId,
          requestId: result.requestId,
          durationMs: result.durationMs,
          failureKind: result.failureKind,
          readOnly: true,
          codeChanged: false,
          proposalCreated: false,
          approvalCreated: false,
          deployed: false,
          modelCalls: 0,
        },
      });
    } catch {
      // Fehlerisolation: ein Protokollfehler darf die Analyse nicht aufheben.
    }

    return result;
  });

/**
 * Ausdrücklich gesperrte Toolbox-Operationen. Sie existieren, damit ein
 * manipulierter Client eine serverseitige Ablehnung erhält und diese im
 * Prüfprotokoll sichtbar wird – ausgeführt wird niemals etwas.
 */
export const orbToolboxRequestOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        operation: z.enum([
          "code_write",
          "db_write",
          "migration",
          "deployment",
          "approval",
          "config_write",
          "secret_access",
        ]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ allowed: false; reason: string }> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { checkToolboxOperationAllowed } = await import("@/orb-core/toolbox/contract");
    const { audit } = await import("@/orb-dev/repo.server");
    const decision = checkToolboxOperationAllowed(data.operation);
    await audit(context.supabase, adminId, {
      action: "TOOLBOX_OPERATION_DENIED",
      fixId: null,
      previousState: null,
      newState: null,
      files: [],
      result: decision.reason,
      metadata: { operation: data.operation, source: "orb_toolbox" },
    });
    return decision;
  });

/**
 * P21 – lesende Codeanalyse (`orb.code_analysis`) für Administratoren.
 *
 * Rein lesend: keine Datei wird geschrieben, kein Patch angewendet, keine
 * Migration, kein Deployment, keine Veröffentlichung. Zugangsdaten werden vor
 * der Ausgabe entfernt. Die einzige Schreiboperation ist der Eintrag in das
 * vorhandene, anfügende Prüfprotokoll – ohne Chattext und ohne Inhalte.
 */
export const orbToolboxCodeAnalyze = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        target: z.string().min(1).max(200),
        question: z.string().min(5).max(300),
        reason: z.string().min(12).max(300),
        requestId: z.string().regex(/^orb_ca_[0-9a-f]{8,32}$/),
        source: z.enum(["admin_ui", "admin_chat", "orb_internal"]).default("admin_ui"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);

    const { ORB_CODE_ANALYSIS_CAPABILITY_ID } = await import("@/orb-core/toolbox/code-contract");
    const { runCodeAnalysis } = await import("@/orb-core/toolbox/code-analysis.server");
    const result = await runCodeAnalysis(context.supabase, adminId, {
      capability: ORB_CODE_ANALYSIS_CAPABILITY_ID,
      mode: "read_only",
      target: data.target,
      question: data.question,
      reason: data.reason,
      requestId: data.requestId,
      source: data.source,
    });

    try {
      const { audit } = await import("@/orb-dev/repo.server");
      await audit(context.supabase, adminId, {
        action: `CODE_ANALYSIS_${result.status}`,
        fixId: null,
        previousState: null,
        newState: null,
        files: result.filesExamined.slice(0, 20),
        result: `${result.findings.length} Befund(e), ${result.proposedChange.length} Vorschlag/Vorschläge`,
        metadata: {
          requestId: result.requestId,
          capability: result.capability,
          mode: result.mode,
          source: result.source,
          target: result.target,
          status: result.status,
          durationMs: result.durationMs,
          failureKind: result.failureKind,
          readOnly: true,
          codeChanged: false,
          patchApplied: false,
          migrationRun: false,
          deployed: false,
          approvalCreated: false,
          secretsAccessed: false,
          modelCalls: 0,
        },
      });
    } catch {
      // Fehlerisolation: ein Protokollfehler darf die Analyse nicht aufheben.
    }

    return result;
  });

/** Ausdrücklich gesperrte schreibende Codeoperationen – immer Ablehnung. */
export const orbToolboxCodeWriteDenied = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        operation: z.enum([
          "write_file",
          "apply_patch",
          "migration",
          "deployment",
          "publish",
          "secret_access",
        ]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ allowed: false; reason: string }> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { requestCodeWriteOperation } = await import("@/orb-core/toolbox/code-analysis.server");
    return requestCodeWriteOperation(data.operation);
  });
