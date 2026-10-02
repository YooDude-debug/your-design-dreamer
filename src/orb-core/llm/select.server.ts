/**
 * ORB Core – Provider-Auswahl der Sprachschicht (experimenteller Bereich).
 *
 * Regeln (E-DECISION Option B):
 *  - Normaler Chat: genau ein Aufruf der bestehenden Gateway-Sprachschicht.
 *  - Kein direkter OpenAI-Aufruf, kein Fallback, keine Wiederholung.
 *  - Codeanalyse (P22) unverändert; bei Fehler → derselbe Gateway-Aufruf.
 *
 * Bildanhänge: geprüfte Bilder gehen als input_image-Blöcke an denselben
 * Gateway-Aufruf (Modell mit Bild-Eingabe). Scheitert der Aufruf, wird der
 * Bildkontext ausdrücklich als nicht verarbeitet gemeldet.
 */

import type { OrbImageAttachment } from "@/lib/orb-attachments";
import type { OrbEventContext } from "@/orb-core/observability.server";
import type { CodeToolRuntime } from "@/orb-core/llm/code-tool.server";
import {
  gatewayCodeToolStep,
  speakViaLovableGateway,
  type OrbLlmMeta,
  type OrbLlmStatus,
} from "@/orb-core/llm/provider.server";

export type OrbLlmResult = { reply: string; status: OrbLlmStatus; meta: OrbLlmMeta };

export async function generateReply(input: {
  system: string;
  text: string;
  images?: OrbImageAttachment[];
  /** P3 Observability: Ereigniskontext, nur zur Korrelation der Aufrufe. */
  obs?: OrbEventContext;
  /** P22: nur bei ausdrücklicher, admingeprüfter Codeanalyse-Anforderung gesetzt. */
  codeTool?: CodeToolRuntime | null;
}): Promise<OrbLlmResult> {
  // P22: genau ein Werkzeug (`orb.code_analysis`). Fehler ⇒ normaler Pfad.
  if (input.codeTool) {
    try {
      const { CODE_TOOL_DEFINITION, runCodeToolLoop } =
        await import("@/orb-core/llm/code-tool.server");
      const done = await runCodeToolLoop({
        userText: input.text,
        runtime: input.codeTool,
        step: gatewayCodeToolStep(input.system, CODE_TOOL_DEFINITION, input.obs),
      });
      if (done) {
        return {
          reply: done.reply,
          status: "ok",
          meta: {
            provider: "local",
            fallbackUsed: false,
            reason: null,
            imagesSent: 0,
            imageContextProcessed: false,
            codeTool: { capability: input.codeTool.capability, calls: done.traces },
          },
        };
      }
    } catch {
      // Fehlerisolation: Werkzeugpfad fällt still auf den bestehenden Pfad zurück.
    }
  }

  // E-DECISION Option B: normaler Chat nutzt ausschliesslich das Gateway.
  // Kein direkter OpenAI-Versuch mehr (22/22 × HTTP 429), keine Fallback-Kette.
  const local = await speakViaLovableGateway(
    input.system,
    input.text,
    input.obs,
    input.images ?? [],
  );
  return {
    reply: local.reply,
    status: local.status,
    meta: {
      provider: "local",
      fallbackUsed: false,
      reason: null,
      // Tatsächlicher Zustand: nur bei erfolgreicher Antwort auf einen Aufruf mit Bildern.
      imagesSent: local.imagesSent,
      imageContextProcessed: local.status === "ok" && local.imagesSent > 0,
      incomplete: local.status === "ok" ? (local.incomplete ?? null) : null,
    },
  };
}
