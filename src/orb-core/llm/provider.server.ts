/**
 * ORB Core – bestehende Sprachschicht (Lovable AI Gateway) als Provider.
 *
 * Diese Logik ist unverändert aus `engine.server.ts` übernommen und bleibt
 * der verpflichtende Fallback: ohne OPENAI_API_KEY läuft ORB genau wie bisher
 * über diesen Weg. Das Modell wird gestreamt, der Datenstrom serverseitig
 * gesammelt (gleiche Semantik wie zuvor).
 */

import {
  logModelCall,
  nextModelRequest,
  unattributedContext,
  type OrbEventContext,
} from "@/orb-core/observability.server";
import {
  ORB_IMAGE_MAX_COUNT,
  toImageDataUrl,
  type OrbImageAttachment,
} from "@/lib/orb-attachments";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
/** Codeanalyse (P22) – unverändert. */
const TEXT_MODEL = "openai/gpt-5.6-luna";
/** Normaler ORB-Chat – freigegebener Wechsel Astra → Luna. */
const CHAT_MODEL = "openai/gpt-5.6-luna";

export type OrbLlmStatus = "ok" | "quota" | "unavailable";

/** Diagnose ohne Inhalt: welche Schicht hat formuliert, ob gefallen wurde. */
export type OrbLlmMeta = {
  provider: "openai" | "local";
  fallbackUsed: boolean;
  reason: string | null;
  /** Anzahl der mitgesendeten Bilder (nur Diagnose, kein Inhalt). */
  imagesSent?: number;
  /** Wurde ein vorhandener Bildkontext tatsächlich ausgewertet? */
  imageContextProcessed?: boolean;
  /** B2: Abbruchgrund bei unvollständig erzeugter Antwort (sonst fehlt/null). */
  incomplete?: string | null;
  /** P22: Kennungen/Kennzahlen der Werkzeugaufrufe (kein Inhalt). */
  codeTool?: {
    capability: string;
    calls: {
      requestId: string;
      target: string;
      status: string;
      filesExamined: string[];
      findings: number;
    }[];
  };
};

export async function speakViaLovableGateway(
  system: string,
  text: string,
  /** P3 Observability: Ereigniskontext; fehlt er, gilt der Aufruf als nicht zugeordnet. */
  obs?: OrbEventContext,
  /** Bereits serverseitig geprüfte Bilder (flüchtig; nie geloggt, nie gespeichert). */
  images: OrbImageAttachment[] = [],
): Promise<{
  reply: string;
  status: OrbLlmStatus;
  imagesSent: number;
  /** B2: Abbruchgrund, wenn der Text nicht vollständig erzeugt wurde (sonst null). */
  incomplete?: string | null;
}> {
  // Nur gesendet, was die Modellschicht tatsächlich erhält (Obergrenze bleibt 3).
  const sentImages = images.slice(0, ORB_IMAGE_MAX_COUNT);
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { reply: "", status: "unavailable", imagesSent: 0 };

  // Nur Messbarkeit: Kennungen, Zeitmessung, Laufkennung des Gateways.
  const ctx = obs ?? unattributedContext();
  const req = nextModelRequest(ctx);
  const startedAt = Date.now();
  const report = (over: {
    success: boolean;
    httpStatus: number | null;
    failureKind: string | null;
    replyChars: number;
    gatewayRunId?: string | null;
  }) =>
    logModelCall({
      eventId: ctx.eventId,
      modelRequestId: req.modelRequestId,
      index: req.index,
      source: ctx.source,
      path: ctx.path,
      callType: ctx.callType,
      provider: "lovable_gateway",
      model: CHAT_MODEL,
      endpoint: `${GATEWAY}/responses`,
      durationMs: Date.now() - startedAt,
      gatewayRunId: over.gatewayRunId ?? null,
      ...over,
    });

  try {
    // Reasoning-Modell: der Aufruf muss streamen, sonst reisst die Verbindung
    // bei langen Denkphasen ab. Der Datenstrom wird serverseitig gesammelt.
    const res = await fetch(`${GATEWAY}/responses`, {
      method: "POST",
      headers: {
        "Lovable-API-Key": key,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        instructions: system,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text },
              // Responses-API-Bildblock: image_url ist ein einfacher String (Data-URL).
              ...sentImages.map((image) => ({
                type: "input_image",
                image_url: toImageDataUrl(image),
              })),
            ],
          },
        ],
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
      }),
    });
    // Vom Gateway vergebene Laufkennung – nur mitgelesen, nie selbst erzeugt.
    const runId = res.headers.get("X-Lovable-AIG-Run-ID")?.trim() || null;
    if (res.status === 402 || res.status === 403) {
      report({
        success: false,
        httpStatus: res.status,
        failureKind: "quota_or_policy",
        replyChars: 0,
        gatewayRunId: runId,
      });
      return { reply: "", status: "quota", imagesSent: 0 };
    }
    if (!res.ok || !res.body) {
      report({
        success: false,
        httpStatus: res.status,
        failureKind: res.ok ? "no_body" : "http_error",
        replyChars: 0,
        gatewayRunId: runId,
      });
      return { reply: "", status: "unavailable", imagesSent: 0 };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let reply = "";
    let completed = false;
    let incomplete: string | null = null;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            response?: { output_text?: string; incomplete_details?: { reason?: string } | null };
          };
          if (event.type === "response.output_text.delta" && event.delta) reply += event.delta;
          else if (event.type === "response.completed") {
            completed = true;
            if (event.response?.output_text) reply = event.response.output_text;
          } else if (event.type === "response.incomplete") {
            // B2: Anbieter hat vorzeitig beendet – Text behalten, kennzeichnen.
            incomplete = event.response?.incomplete_details?.reason || "incomplete";
          } else if (event.type === "response.failed" || event.type === "error") {
            incomplete = "failed";
          }
        } catch {
          // Unvollständige oder unbekannte Ereignisse werden übergangen.
        }
      }
    }

    const clean = reply.trim();
    // B2: Strom endete ohne Abschlussereignis ⇒ ebenfalls unvollständig.
    if (!completed && !incomplete && clean) incomplete = "stream_ended";
    report({
      success: clean.length > 0,
      httpStatus: res.status,
      failureKind: clean ? (incomplete ? `incomplete:${incomplete}` : null) : "empty_reply",
      replyChars: clean.length,
      gatewayRunId: runId,
    });
    // Erst eine erfolgreiche Antwort belegt, dass der Modellaufruf die Bilder erhielt.
    // Bereits erzeugter Text geht nie verloren; er wird nur gekennzeichnet.
    return clean
      ? { reply: clean, status: "ok", imagesSent: sentImages.length, incomplete }
      : { reply: "", status: "unavailable", imagesSent: 0 };
  } catch {
    report({ success: false, httpStatus: null, failureKind: "exception", replyChars: 0 });
    return { reply: "", status: "unavailable", imagesSent: 0 };
  }
}

/**
 * P22 – ein Modellschritt mit genau einem Werkzeug (`orb.code_analysis`).
 * Gleicher Endpunkt, gleiches Modell, gleiches Streaming wie oben; nur die
 * Werkzeugdefinition kommt hinzu. Wird ausschliesslich bei einer
 * ausdrücklichen, admingeprüften Analyseanforderung benutzt.
 */
export function gatewayCodeToolStep(
  system: string,
  tool: unknown,
  obs?: OrbEventContext,
): (input: { items: unknown[]; toolsAllowed: boolean }) => Promise<{
  text: string;
  calls: { callId: string; name: string; arguments: string }[];
} | null> {
  return async ({ items, toolsAllowed }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return null;
    const ctx = obs ?? unattributedContext();
    const req = nextModelRequest(ctx);
    const startedAt = Date.now();
    const report = (over: {
      success: boolean;
      httpStatus: number | null;
      failureKind: string | null;
      replyChars: number;
      gatewayRunId?: string | null;
    }) =>
      logModelCall({
        eventId: ctx.eventId,
        modelRequestId: req.modelRequestId,
        index: req.index,
        source: ctx.source,
        path: ctx.path,
        callType: ctx.callType,
        provider: "lovable_gateway",
        model: TEXT_MODEL,
        endpoint: `${GATEWAY}/responses`,
        durationMs: Date.now() - startedAt,
        gatewayRunId: over.gatewayRunId ?? null,
        ...over,
      });
    try {
      const res = await fetch(`${GATEWAY}/responses`, {
        method: "POST",
        headers: {
          "Lovable-API-Key": key,
          "Content-Type": "application/json",
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: TEXT_MODEL,
          instructions: system,
          input: items,
          tools: [tool],
          tool_choice: toolsAllowed ? "auto" : "none",
          stream: true,
          store: false,
          reasoning: { effort: "low", summary: "auto" },
        }),
      });
      const runId = res.headers.get("X-Lovable-AIG-Run-ID")?.trim() || null;
      if (!res.ok || !res.body) {
        report({
          success: false,
          httpStatus: res.status,
          failureKind: "http_error",
          replyChars: 0,
          gatewayRunId: runId,
        });
        return null;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";
      const calls: { callId: string; name: string; arguments: string }[] = [];
      const seen = new Set<string>();
      const addCall = (item: {
        type?: string;
        call_id?: string;
        name?: string;
        arguments?: string;
      }) => {
        if (item.type !== "function_call" || !item.call_id || seen.has(item.call_id)) return;
        seen.add(item.call_id);
        calls.push({
          callId: item.call_id,
          name: item.name ?? "",
          arguments: item.arguments ?? "{}",
        });
      };
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const event = JSON.parse(payload) as {
              type?: string;
              delta?: string;
              item?: { type?: string; call_id?: string; name?: string; arguments?: string };
              response?: {
                output_text?: string;
                output?: { type?: string; call_id?: string; name?: string; arguments?: string }[];
              };
            };
            if (event.type === "response.output_text.delta" && event.delta) text += event.delta;
            else if (event.type === "response.output_item.done" && event.item) addCall(event.item);
            else if (event.type === "response.completed" && event.response) {
              if (event.response.output_text) text = event.response.output_text;
              for (const item of event.response.output ?? []) addCall(item);
            }
          } catch {
            // Unvollständige oder unbekannte Ereignisse werden übergangen.
          }
        }
      }
      report({
        success: text.trim().length > 0 || calls.length > 0,
        httpStatus: res.status,
        failureKind: text.trim() || calls.length ? null : "empty_reply",
        replyChars: text.trim().length,
        gatewayRunId: runId,
      });
      return { text, calls };
    } catch {
      report({ success: false, httpStatus: null, failureKind: "exception", replyChars: 0 });
      return null;
    }
  };
}
