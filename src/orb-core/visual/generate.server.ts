/**
 * ORB P2 – Bildgenerierung (serverseitig).
 *
 * Ablauf: signierter Intent prüfen → 24-h-Limit aus orb_visual_generations →
 * Reservierungszeile (zählt sofort) → genau ein gestreamter Aufruf von
 * /v1/images/generations → Bild validieren → Zeile mit Ergebnis aktualisieren.
 * Gespeichert werden nur Kennzahlen und ein Prompt-Hash – nie Bild oder Prompt.
 */

import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { orbBuildId } from "@/orb-core/decision-trace";
import {
  VISUAL_MODEL,
  VISUAL_QUALITY,
  VISUAL_SIZE,
  VISUAL_TOKEN_TTL_MS,
  VISUAL_WINDOW_MS,
  checkVisualLimit,
  estimateVisualCost,
  validateGeneratedImage,
  type VisualIntent,
  type VisualScope,
} from "@/orb-core/visual/intent";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

type TokenPayload = VisualIntent & { uid: string; scope: VisualScope; iat: number };

function tokenKey(): Buffer | null {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  return createHash("sha256").update(`orb-visual-intent|${key}`).digest();
}

export function promptHash(prompt: string): string {
  return createHash("sha256").update(prompt.trim().toLowerCase().replace(/\s+/g, " ")).digest("hex");
}

export function signVisualIntent(
  intent: VisualIntent,
  uid: string,
  scope: VisualScope,
  now = Date.now(),
): string | null {
  const key = tokenKey();
  if (!key) return null;
  const body = Buffer.from(JSON.stringify({ ...intent, uid, scope, iat: now })).toString(
    "base64url",
  );
  const sig = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyVisualIntent(
  token: string,
  uid: string,
  scope: VisualScope,
  now = Date.now(),
): TokenPayload | null {
  const key = tokenKey();
  const [body, sig] = token.split(".");
  if (!key || !body || !sig) return null;
  const expected = createHmac("sha256", key).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (p.uid !== uid || p.scope !== scope) return null;
    if (typeof p.iat !== "number" || now - p.iat > VISUAL_TOKEN_TTL_MS || p.iat > now + 60_000)
      return null;
    return p;
  } catch {
    return null;
  }
}

export type VisualResult =
  | { status: "ok"; mimeType: string; dataBase64: string; generationId: string }
  | {
      status: "blocked" | "error";
      reason: string;
      message: string;
      generationId: string | null;
    };

const MESSAGES: Record<string, string> = {
  invalid_token: "Das Bild konnte nicht erstellt werden: die Anfrage ist abgelaufen.",
  daily_limit: "Für heute ist das Bildlimit erreicht. Morgen geht es wieder.",
  autonomous_limit: "Für heute zeige ich keine weiteren Bilder von mir aus.",
  already_shown: "Dieses Bild habe ich dir bereits gezeigt.",
  quota: "Bildgenerierung ist gerade nicht möglich (KI-Guthaben oder Limit).",
  provider_error: "Das Bild konnte nicht erstellt werden.",
  invalid_image: "Es kam kein gültiges Bild zurück.",
  unavailable: "Bildgenerierung ist gerade nicht verfügbar.",
};

const blocked = (reason: string, kind: "blocked" | "error" = "blocked", id: string | null = null): VisualResult => ({
  status: kind,
  reason,
  message: MESSAGES[reason] ?? MESSAGES["provider_error"]!,
  generationId: id,
});

/** Gestreamte Antwort lesen; liefert das abschliessende Ereignis. */
async function readImageStream(res: Response): Promise<Record<string, unknown> | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done: Record<string, unknown> | null = null;
  const handle = (line: string) => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    try {
      const ev = JSON.parse(payload) as Record<string, unknown>;
      const t = ev["type"];
      if (t === "image_generation.completed" || t === "error" || ev["error"]) done = ev;
    } catch {
      // Unvollständige Ereignisse übergehen.
    }
  };
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(handle);
  }
  if (buffer) handle(buffer);
  return done;
}

export async function generateVisual(
  db: SupabaseClient,
  input: { userId: string; scope: VisualScope; token: string },
  deps: { fetch?: typeof fetch; now?: number } = {},
): Promise<VisualResult> {
  const now = deps.now ?? Date.now();
  const doFetch = deps.fetch ?? fetch;
  const intent = verifyVisualIntent(input.token, input.userId, input.scope, now);
  if (!intent) return blocked("invalid_token");
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return blocked("unavailable", "error");

  const hash = promptHash(intent.prompt);
  const since = new Date(now - VISUAL_WINDOW_MS).toISOString();
  const recent = await db
    .from("orb_visual_generations")
    .select("intent_kind, prompt_hash, status")
    .eq("user_id", input.userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(200);
  // Unbekannter Zählerstand ⇒ keine Generierung (keine unbegrenzten Kosten).
  if (recent.error) return blocked("unavailable", "error");
  const limit = checkVisualLimit(recent.data ?? [], { kind: intent.kind, promptHash: hash });
  if (!limit.allowed) return blocked(limit.reason);

  const buildId = orbBuildId();
  const reserved = await db
    .from("orb_visual_generations")
    .insert({
      user_id: input.userId,
      scope: input.scope,
      build_id: buildId,
      intent_kind: intent.kind,
      intent_category: intent.category,
      prompt_hash: hash,
      model: VISUAL_MODEL,
      status: "started",
    })
    .select("id")
    .single();
  if (reserved.error || !reserved.data) return blocked("unavailable", "error");
  const id = reserved.data.id as string;
  const startedAt = Date.now();

  const finish = async (fields: Record<string, unknown>) => {
    await db
      .from("orb_visual_generations")
      .update({ ...fields, duration_ms: Date.now() - startedAt })
      .eq("id", id)
      .eq("user_id", input.userId);
    console.info(
      "[orb.visual]",
      JSON.stringify({
        generationId: id,
        buildId,
        scope: input.scope,
        kind: intent.kind,
        category: intent.category,
        model: VISUAL_MODEL,
        status: fields["status"],
        failure: fields["failure_reason"] ?? null,
      }),
    );
  };

  try {
    const res = await doFetch(`${GATEWAY}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: VISUAL_MODEL,
        prompt: intent.prompt,
        size: VISUAL_SIZE,
        quality: VISUAL_QUALITY,
        stream: true,
      }),
    });
    if (res.status === 402 || res.status === 403) {
      await finish({ status: "quota", http_status: res.status, failure_reason: "quota_or_policy" });
      return blocked("quota", "error", id);
    }
    if (!res.ok) {
      await finish({ status: "provider_error", http_status: res.status, failure_reason: "http_error" });
      return blocked("provider_error", "error", id);
    }
    const ev = await readImageStream(res);
    if (!ev || ev["type"] !== "image_generation.completed") {
      await finish({
        status: "provider_error",
        http_status: res.status,
        failure_reason: ev ? "stream_error_event" : "no_completed_event",
      });
      return blocked("provider_error", "error", id);
    }
    const cost = estimateVisualCost(ev["usage"]);
    const img = validateGeneratedImage(ev["b64_json"], ev["output_format"]);
    if (!img.ok) {
      await finish({
        status: "invalid_image",
        http_status: res.status,
        failure_reason: img.reason,
        input_tokens: cost.inputTokens,
        output_tokens: cost.outputTokens,
        catalog_cost: cost.catalogCost,
      });
      return blocked("invalid_image", "error", id);
    }
    await finish({
      status: "ok",
      http_status: res.status,
      failure_reason: null,
      input_tokens: cost.inputTokens,
      output_tokens: cost.outputTokens,
      catalog_cost: cost.catalogCost,
    });
    return { status: "ok", mimeType: img.mimeType, dataBase64: img.dataBase64, generationId: id };
  } catch {
    await finish({ status: "provider_error", failure_reason: "exception" });
    return blocked("provider_error", "error", id);
  }
}
