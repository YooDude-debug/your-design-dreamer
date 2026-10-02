/**
 * ORB P2 – Visual-Intent (rein, ohne Netzwerk, ohne Datenbank).
 *
 * Das Sprachmodell darf in seiner normalen Antwort genau eine Markierung
 * `[[ORB_VISUAL {json}]]` anhängen. Sie wird hier entfernt, bevor die Antwort
 * gespeichert oder angezeigt wird, und streng geprüft. Kein zusätzlicher
 * Modellaufruf entscheidet über das Bild – nur diese Prüfung.
 */

export const VISUAL_MODEL = "openai/gpt-image-2.5-sunburst";
export const VISUAL_SIZE = "1024x1024";
export const VISUAL_QUALITY = "low";
/** Rollierendes 24-h-Fenster je Benutzer (alle Bereiche zusammen). */
export const VISUAL_DAILY_LIMIT = 10;
/** Davon höchstens so viele ohne ausdrücklichen Wunsch. */
export const VISUAL_AUTONOMOUS_DAILY_LIMIT = 3;
export const VISUAL_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Gültigkeit eines signierten Intents zwischen Antwort und Generierung. */
export const VISUAL_TOKEN_TTL_MS = 10 * 60 * 1000;
export const VISUAL_PROMPT_MIN = 12;
export const VISUAL_PROMPT_MAX = 800;
export const VISUAL_SCOPES = ["normal", "orb_core", "y_dude"] as const;
export type VisualScope = (typeof VISUAL_SCOPES)[number];

/** Kategorien mit erkennbarem visuellem Mehrwert. */
export const VISUAL_CATEGORIES = [
  "diagram",
  "process",
  "spatial",
  "comparison",
  "illustration",
] as const;
export type VisualCategory = (typeof VISUAL_CATEGORIES)[number];
export type VisualKind = "explicit" | "autonomous";

export type VisualIntent = {
  kind: VisualKind;
  category: VisualCategory;
  prompt: string;
};

const MARKER_RE = /\[\[ORB_VISUAL\s*(\{[\s\S]*?\})\s*\]\]/g;

/** Ausdrücklicher Bildwunsch im Benutzertext (serverseitig, nicht vom Modell). */
const EXPLICIT_RE =
  /\b(zeichne|zeichnen|mal(e|en)?\s+(mir|ein|eine)|skizzier\w*|visualisier\w*|illustrier\w*|(zeig|zeige)\s+(mir\s+)?(ein|eine|das|als)\s+(bild|grafik|skizze|diagramm|zeichnung)|(ein|eine)\s+(bild|grafik|skizze|diagramm|zeichnung|illustration)\s+(von|zu|davon|dazu|für)|bild\s+(erstellen|erzeugen|generieren|machen)|(erstell|erzeug|generier|mach)\w*\s+(mir\s+)?(ein|eine)\s+(bild|grafik|skizze|diagramm|zeichnung|illustration))\b/i;

export function isExplicitVisualRequest(userText: string): boolean {
  return EXPLICIT_RE.test(userText);
}

/** Entfernt jede Markierung aus der Antwort; liefert den ersten Rohwert. */
export function extractVisualMarker(reply: string): { text: string; raw: string | null } {
  let raw: string | null = null;
  const text = reply
    .replace(MARKER_RE, (_m, json: string) => {
      if (raw === null) raw = json;
      return "";
    })
    // Unvollständige Markierung nie anzeigen.
    .replace(/\[\[ORB_VISUAL[\s\S]*$/, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  return { text, raw };
}

export type VisualIntentCheck =
  | { ok: true; intent: VisualIntent }
  | { ok: false; reason: string };

/**
 * Serverseitige Prüfung. Der Modus „explicit" gilt nur, wenn der Benutzertext
 * selbst einen Bildwunsch enthält; sonst wird er als autonom behandelt.
 * Autonome Bilder brauchen eine Mehrwert-Kategorie und eine inhaltliche Eingabe.
 */
export function validateVisualIntent(
  raw: string | null,
  ctx: { userText: string; scope: string; hasImagesFromUser?: boolean },
): VisualIntentCheck {
  if (raw === null) return { ok: false, reason: "no_marker" };
  if (!(VISUAL_SCOPES as readonly string[]).includes(ctx.scope))
    return { ok: false, reason: "scope_not_allowed" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, reason: "invalid_shape" };
  const o = parsed as Record<string, unknown>;
  const category = o["category"];
  const prompt = typeof o["prompt"] === "string" ? o["prompt"].trim() : "";
  if (!(VISUAL_CATEGORIES as readonly unknown[]).includes(category))
    return { ok: false, reason: "invalid_category" };
  if (prompt.length < VISUAL_PROMPT_MIN) return { ok: false, reason: "prompt_too_short" };
  if (prompt.length > VISUAL_PROMPT_MAX) return { ok: false, reason: "prompt_too_long" };
  const explicit = isExplicitVisualRequest(ctx.userText);
  if (!explicit) {
    // Kein Bild bei gewöhnlichen Alltagsantworten: kurze Eingaben ohne Inhalt.
    const words = ctx.userText.trim().split(/\s+/).filter(Boolean).length;
    if (words < 4) return { ok: false, reason: "no_visual_value" };
  }
  return {
    ok: true,
    intent: {
      kind: explicit ? "explicit" : "autonomous",
      category: category as VisualCategory,
      prompt,
    },
  };
}

/** Limitentscheidung aus bereits geladenen Zeilen des 24-h-Fensters. */
export function checkVisualLimit(
  rows: { intent_kind: string; prompt_hash: string; status: string }[],
  intent: { kind: VisualKind; promptHash: string },
): { allowed: true } | { allowed: false; reason: "daily_limit" | "autonomous_limit" | "already_shown" } {
  if (rows.some((r) => r.prompt_hash === intent.promptHash && r.status === "ok"))
    return { allowed: false, reason: "already_shown" };
  if (rows.length >= VISUAL_DAILY_LIMIT) return { allowed: false, reason: "daily_limit" };
  if (
    intent.kind === "autonomous" &&
    rows.filter((r) => r.intent_kind === "autonomous").length >= VISUAL_AUTONOMOUS_DAILY_LIMIT
  )
    return { allowed: false, reason: "autonomous_limit" };
  return { allowed: true };
}

/** Katalogpreise (GET /v1/models, 02.10.2026) – nur Schätzung aus echter Nutzung. */
export const VISUAL_CATALOG_PRICE = {
  inputText: 0.000005,
  inputImage: 0.000008,
  outputImage: 0.00003,
};

export function estimateVisualCost(usage: unknown): {
  inputTokens: number | null;
  outputTokens: number | null;
  catalogCost: number | null;
} {
  if (!usage || typeof usage !== "object")
    return { inputTokens: null, outputTokens: null, catalogCost: null };
  const u = usage as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
  const inD = (u["input_tokens_details"] ?? {}) as Record<string, unknown>;
  const outD = (u["output_tokens_details"] ?? {}) as Record<string, unknown>;
  const inputTokens = num(u["input_tokens"]);
  const outputTokens = num(u["output_tokens"]);
  const inText = num(inD["text_tokens"]) ?? inputTokens;
  const inImage = num(inD["image_tokens"]) ?? 0;
  const outImage = num(outD["image_tokens"]) ?? outputTokens;
  if (inText === null || outImage === null) return { inputTokens, outputTokens, catalogCost: null };
  const cost =
    inText * VISUAL_CATALOG_PRICE.inputText +
    inImage * VISUAL_CATALOG_PRICE.inputImage +
    outImage * VISUAL_CATALOG_PRICE.outputImage;
  return { inputTokens, outputTokens, catalogCost: Number(cost.toFixed(8)) };
}

/** PNG/JPEG/WEBP-Signatur in Base64 prüfen – leere oder falsche Antwort = Fehler. */
export function validateGeneratedImage(
  b64: unknown,
  format: unknown,
): { ok: true; mimeType: string; dataBase64: string } | { ok: false; reason: string } {
  if (typeof b64 !== "string" || b64.length < 200) return { ok: false, reason: "empty_image" };
  if (!/^[A-Za-z0-9+/=\s]+$/.test(b64.slice(0, 2000))) return { ok: false, reason: "not_base64" };
  const head = b64.slice(0, 16);
  const mimeType = head.startsWith("iVBORw0KGgo")
    ? "image/png"
    : head.startsWith("/9j/")
      ? "image/jpeg"
      : head.startsWith("UklGR")
        ? "image/webp"
        : null;
  if (!mimeType) return { ok: false, reason: "unknown_signature" };
  if (typeof format === "string" && format && !mimeType.endsWith(format === "jpg" ? "jpeg" : format))
    return { ok: false, reason: "format_mismatch" };
  return { ok: true, mimeType, dataBase64: b64 };
}

/** Prompt-Hinweis für die Sprachschicht – nur gesetzt, wenn Bilder erlaubt sind. */
export const VISUAL_PROMPT_HINT =
  'Bilder: Nur wenn ein Bild einen konkreten Mehrwert hat (der Benutzer wünscht ausdrücklich ein Bild, oder ein Ablauf, Aufbau, räumlicher Zusammenhang oder Vergleich ist mit Worten deutlich schwerer zu verstehen), hänge ganz am Ende deiner Antwort genau eine Zeile an: [[ORB_VISUAL {"category":"diagram|process|spatial|comparison|illustration","prompt":"<englische Bildbeschreibung, ohne Text im Bild, höchstens 600 Zeichen>"}]]. Bei Alltagsantworten, Smalltalk, Gefühlen oder Fragen nach dir: niemals. Erwähne die Zeile nicht und behaupte nie, ein Bild gezeigt zu haben – das System zeigt es separat an, falls es gelingt.';
