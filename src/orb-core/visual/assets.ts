/**
 * ORB Visual Memory – reine Regeln (ohne DB, ohne Netzwerk).
 *
 * Bildressourcen sind eigenständige Assets. Eine Erinnerung erhält ein Bild nur
 * über eine ausdrückliche Referenz: entweder manuell oder über einen
 * `image_links`-Eintrag derselben Hintergrundanalyse, dessen wörtlicher Beleg
 * in GENAU der Nachricht steht, an der das Bild hing. Zeitliche Nähe allein
 * erzeugt nie eine Zuordnung.
 */

import type { OrbImageMime } from "@/lib/orb-attachments";

export const VISUAL_SOURCE_TYPES = ["user_upload", "orb_generated", "unknown"] as const;
export type VisualSourceType = (typeof VISUAL_SOURCE_TYPES)[number];

export const VISUAL_ORIGIN_STATUSES = ["pending", "stored", "failed"] as const;
export type VisualOriginStatus = (typeof VISUAL_ORIGIN_STATUSES)[number];

/** Höchstens so viele Bildzuordnungen übernimmt eine Analyse. */
export const IMAGE_LINK_MAX_COUNT = 9;
/** Mindestlänge eines wörtlichen Belegs (normalisiert). */
export const IMAGE_LINK_MIN_QUOTE = 4;
/** Laufzeit signierter Bild-URLs (Sekunden). */
export const VISUAL_SIGNED_URL_TTL = 600;
/** Lebenszyklus-Stufen, deren Bilder beim Abruf gezeigt werden dürfen. */
export const RETRIEVABLE_LIFECYCLES: ReadonlySet<string> = new Set(["active", "weak", "stale"]);

const EXT: Record<OrbImageMime, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
};

/** Dateiendung immer aus dem geprüften MIME-Typ – nie aus dem Dateinamen. */
export function extensionFor(mime: OrbImageMime): string {
  return EXT[mime];
}

/** Speicherpfad: `<user>/orb/<scope>/<sha256>.<ext>` (DB-Trigger prüft dasselbe). */
export function storagePathFor(input: {
  userId: string;
  scope: string;
  sha256: string;
  mimeType: OrbImageMime;
}): string {
  return `${input.userId}/orb/${input.scope}/${input.sha256}.${extensionFor(input.mimeType)}`;
}

/** SHA-256 als Hex über WebCrypto (Browser und Worker). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * WebP-Umwandlung nur für Standbilder: PNG und JPEG. GIF bleibt unverändert
 * (Animation ginge verloren), WebP ist bereits Zielformat.
 */
export function shouldConvertToWebp(mime: OrbImageMime): boolean {
  return mime === "image/png" || mime === "image/jpeg";
}

/**
 * Ergebnis einer Umwandlung übernehmen, nur wenn es wirklich WebP ist und nicht
 * grösser als das Original – sonst bleibt das geprüfte Original.
 */
export function pickConverted(
  original: { mimeType: OrbImageMime; bytes: number },
  converted: { sniffed: OrbImageMime | null; bytes: number } | null,
): "converted" | "original" {
  if (!converted || converted.sniffed !== "image/webp") return "original";
  if (converted.bytes <= 0 || converted.bytes > original.bytes) return "original";
  return "converted";
}

/** Bildmarke im Analyse-Transkript (nur kurze Labels, keine IDs, keine Bytes). */
export function imageLabel(index: number): string {
  return `img${index + 1}`;
}

export type TranscriptImage = {
  label: string;
  assetId: string;
  messageId: string;
  messageBody: string;
};

export type StoredCandidate = { key: string; nodeId: string };

export type ImageLinkDecision =
  | { ok: true; assetId: string; nodeId: string; label: string }
  | { ok: false; reason: string };

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Rohvorschläge der Analyse prüfen. Angenommen wird nur, wenn
 * - das Label zu einem gespeicherten Bild des Transkripts gehört,
 * - der Kandidat in DIESER Analyse tatsächlich gespeichert wurde,
 * - der wörtliche Beleg in der Nachricht steht, an der das Bild hing.
 */
export function validateImageLinks(
  raw: unknown,
  images: TranscriptImage[],
  stored: StoredCandidate[],
): { accepted: Extract<ImageLinkDecision, { ok: true }>[]; rejected: string[] } {
  const accepted: Extract<ImageLinkDecision, { ok: true }>[] = [];
  const rejected: string[] = [];
  if (!Array.isArray(raw)) return { accepted, rejected };
  const byLabel = new Map(images.map((i) => [i.label, i]));
  const byKey = new Map(stored.map((s) => [s.key, s.nodeId]));
  const seen = new Set<string>();
  for (const entry of raw.slice(0, IMAGE_LINK_MAX_COUNT * 2)) {
    if (accepted.length >= IMAGE_LINK_MAX_COUNT) break;
    if (!entry || typeof entry !== "object") {
      rejected.push("not_object");
      continue;
    }
    const e = entry as Record<string, unknown>;
    const label = typeof e["image_ref"] === "string" ? e["image_ref"].trim() : "";
    const key = typeof e["candidate_key"] === "string" ? e["candidate_key"].trim() : "";
    const quote = typeof e["evidence_quote"] === "string" ? norm(e["evidence_quote"]) : "";
    const img = byLabel.get(label);
    if (!img) {
      rejected.push("unknown_image");
      continue;
    }
    const nodeId = byKey.get(key);
    if (!nodeId) {
      rejected.push("candidate_not_stored");
      continue;
    }
    if (quote.length < IMAGE_LINK_MIN_QUOTE || !norm(img.messageBody).includes(quote)) {
      rejected.push("evidence_not_in_image_message");
      continue;
    }
    const pair = `${nodeId}:${img.assetId}`;
    if (seen.has(pair)) continue;
    seen.add(pair);
    accepted.push({ ok: true, assetId: img.assetId, nodeId, label });
  }
  return { accepted, rejected };
}

/** Bilder einer Erinnerung nur liefern, wenn die Erinnerung abrufbar ist. */
export function imagesRetrievableFor(lifecycle: string | null | undefined): boolean {
  return typeof lifecycle === "string" && RETRIEVABLE_LIFECYCLES.has(lifecycle);
}
